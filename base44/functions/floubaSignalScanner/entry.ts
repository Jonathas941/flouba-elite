import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const BASE = "https://dazzling-perception-production-8e53.up.railway.app/api";

const KNOWN_BASES = ["XAUUSD","XAUEUR","EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","NAS100","US30","US500","US2000","UK100","GER40","GER30","FRA40","JPN225","AUS200","HK50","CHINA50","SWI20","USOIL","UKOIL","NATGAS","BTCUSD","ETHUSD","LTCUSD","XRPUSD","BCHUSD","ADAUSD","DOTUSD","SOLUSD","DOGUSD","BNBUSD"];
function stripSuffix(sym) {
  if (typeof sym !== "string") return { base: sym, suffix: "" };
  for (const base of KNOWN_BASES) {
    if (sym.startsWith(base) && sym.length > base.length) return { base, suffix: sym.slice(base.length) };
  }
  return { base: sym, suffix: "" };
}

function buildHeaders(token, config) {
  const h = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  if (config?.mt5_account) h["X-MT5-Login"] = String(config.mt5_account);
  if (config?.mt5_password) h["X-MT5-Password"] = config.mt5_password;
  if (config?.mt5_server) h["X-MT5-Server"] = config.mt5_server;
  return h;
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron = cronSecret && (req.headers.get("X-Cron-Secret") === cronSecret || body.cron_secret === cronSecret);

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    // ═══ CRON MODE — scan for all eligible users ═══
    if (isCron && !body.user_id) {
      const allSettings = await base44.asServiceRole.entities.BotSettings.list();
      const allSaSettings = await base44.asServiceRole.entities.SignalAssistantSettings.list();
      const allUsers = await base44.asServiceRole.entities.User.list();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const saMap = new Map(allSaSettings.map(s => [s.created_by_id, s]));

      const eligible = allSettings.filter(s =>
        s.mt5_account && s.mt5_password && s.mt5_server &&
        userMap.get(s.created_by_id)?.flouba_token
      );

      const results = [];
      for (const config of eligible) {
        const sa = saMap.get(config.created_by_id);
        if (!sa) continue;
        try {
          const r = await scanAndStore(base44, config, userMap.get(config.created_by_id), sa);
          results.push({ user: config.created_by_id, login: config.mt5_account, ...r });
        } catch (err) {
          results.push({ user: config.created_by_id, error: err.message });
        }
      }
      return Response.json({ ok: true, mode: "cron", usersChecked: results.length, results, checkedAt: new Date().toISOString() });
    }

    // ═══ MANUAL MODE — current user ═══
    if (!isCron) {
      const isAuth = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuth) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    let userId = user.id;
    // Only admins (or cron) may scan on behalf of another user
    if (body.user_id && body.user_id !== userId) {
      if (!isCron && user.role !== "admin") {
        return Response.json({ error: "Forbidden: cannot scan for another user" }, { status: 403 });
      }
      const target = await base44.asServiceRole.entities.User.get(body.user_id).catch(() => null);
      if (!target) return Response.json({ error: "Target user not found" }, { status: 404 });
      user = target;
      userId = target.id;
    }

    const settings = await base44.asServiceRole.entities.BotSettings.filter({ created_by_id: userId }, "-created_date", 1);
    const config = settings?.[0];
    if (!config) return Response.json({ error: "No BotSettings found" }, { status: 400 });

    const saSettings = await base44.asServiceRole.entities.SignalAssistantSettings.filter({ created_by_id: userId }, "-created_date", 1);
    const sa = saSettings?.[0] || { execution_mode: "signal_only", signal_expiration_minutes: 30, min_confidence_score: 70, virtual_trigger_mode: true, broker_pending_order_mode: false, magic_number: 20260001, trade_comment: "Flouba Gold HFT" };

    const result = await scanAndStore(base44, config, user, sa);
    return Response.json({ ok: true, mode: "manual", ...result });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

// ═══ Core: scan market, generate signal, store it ═══
async function scanAndStore(base44, config, user, sa) {
  // 1. Check for existing active signal — don't create duplicates
  const existing = await base44.asServiceRole.entities.FloubaSignal.filter({
    created_by_id: config.created_by_id,
    status: { $in: ["WAITING_FOR_ENTRY", "CONFIRMED"] },
  }, "-created_date", 1);

  if (existing?.length > 0) {
    return { signal_created: false, reason: "Active signal already exists", active_signal: existing[0] };
  }

  // 2. Invoke the Trade Decision Engine (8-pillar analysis)
  const decisionRes = await base44.functions.invoke("tradeDecisionEngine", {
    target_user_id: config.created_by_id,
  }).catch((e) => ({ data: { error: e.message } }));
  const decision = decisionRes?.data || decisionRes;
  if (decision?.error) return { signal_created: false, error: decision.error };

  // 3. Invoke the AI Strategy Selector
  const strategyRes = await base44.functions.invoke("aiStrategySelector", {
    target_user_id: config.created_by_id,
  }).catch(() => ({ data: {} }));
  const strategyInfo = strategyRes?.data || strategyRes || {};
  const bestStrategy = strategyInfo?.strategy || config.adaptive_active_strategy || "Auto (AI Select)";

  // 4. Check if valid signal
  const isTrade = decision?.decision === "TRADE" || decision?.decision === "RECOVERY_TRADE";
  const score = decision?.score || 0;
  const minScore = sa.min_confidence_score ?? 70;

  if (!isTrade || score < minScore) {
    return {
      signal_created: false,
      decision: decision?.decision,
      reason: decision?.reason || `Score ${score} below minimum ${minScore}`,
      score,
      minScore,
      bestStrategy,
    };
  }

  const trade = decision?.trade;
  if (!trade?.direction) return { signal_created: false, reason: "No trade direction in signal" };

  // 5. Build the signal record
  const symbol = config.active_pair || "XAUUSD";
  const expirationMin = sa.signal_expiration_minutes ?? 30;
  const expirationTime = new Date(Date.now() + expirationMin * 60 * 1000).toISOString();

  // Determine entry style
  const entryStyle = sa.broker_pending_order_mode ? "broker_pending" : "virtual_trigger";

  // Determine initial status
  const initialStatus = sa.execution_mode === "full_auto" ? "CONFIRMED" : "WAITING_FOR_ENTRY";

  const signalRecord = {
    symbol,
    direction: trade.direction,
    entry_price: trade.entry,
    stop_loss: trade.stop_loss,
    take_profit: trade.take_profit,
    lot_size: trade.lot_size,
    risk_percentage: config.risk_percentage ?? 1,
    confidence_score: score,
    signal_reason: decision?.reason || "AI confluence signal",
    market_structure_reason: decision?.regime ? `Regime: ${decision.regime}` : "Market structure analyzed",
    expiration_time: expirationTime,
    status: initialStatus,
    entry_style: entryStyle,
    execution_mode: sa.execution_mode || "signal_only",
    strategy_name: bestStrategy,
    magic_number: sa.magic_number ?? 20260001,
    comment: sa.trade_comment || "Flouba Gold HFT",
    pillars: decision?.pillars || {},
    regime: decision?.regime || "",
    risk_reward: trade.risk_reward || 2,
  };

  const created = await base44.asServiceRole.entities.FloubaSignal.create(signalRecord);

  // 6. If broker_pending_order_mode + full_auto, place the pending order now
  if (entryStyle === "broker_pending" && sa.execution_mode === "full_auto" && sa.auto_trading_enabled) {
    const bridgeToken = user.flouba_token;
    if (bridgeToken) {
      const authHeaders = buildHeaders(bridgeToken, config);
      const { base: baseSym, suffix } = stripSuffix(symbol);
      const orderType = determinePendingOrderType(trade.direction, trade.entry, decision?.account?.bid, decision?.account?.ask);
      const pendingBody = {
        symbol: baseSym,
        order_type: orderType,
        volume: trade.lot_size,
        price: trade.entry,
        sl: trade.stop_loss,
        tp: trade.take_profit,
        magic: sa.magic_number ?? 20260001,
        comment: sa.trade_comment || "Flouba Gold HFT",
        expiration: expirationTime,
      };
      if (suffix) { pendingBody.broker_symbol = symbol; pendingBody.symbol_suffix = suffix; }

      const pendingRes = await fetch(`${BASE}/trade/pending`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(pendingBody),
      }).catch(() => null);

      const pendingJson = pendingRes?.ok ? await pendingRes.json().catch(() => ({})) : {};
      if (pendingJson?.success || pendingRes?.ok) {
        await base44.asServiceRole.entities.FloubaSignal.update(created.id, {
          status: "CONFIRMED",
          ticket_id: pendingJson?.ticket || pendingJson?.order || null,
        });
      }
    }
  }

  return {
    signal_created: true,
    signal: { ...signalRecord, id: created.id },
    decision: decision?.decision,
    score,
    minScore,
    bestStrategy,
    bestStrategyReason: strategyInfo?.reason || null,
  };
}

function determinePendingOrderType(direction, entryPrice, bid, ask) {
  const currentPrice = direction === "BUY" ? (ask || bid) : (bid || ask);
  if (direction === "BUY") {
    return entryPrice > currentPrice ? "BUY_STOP" : "BUY_LIMIT";
  } else {
    return entryPrice < currentPrice ? "SELL_STOP" : "SELL_LIMIT";
  }
}