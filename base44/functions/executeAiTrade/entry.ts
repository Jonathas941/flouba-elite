import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const BASE = (() => {
  let v = (Deno.env.get("FLOUBA_BACKEND_URL") || "").trim().replace(/\/+$/, "");
  if (v && !/^https?:\/\//i.test(v)) v = "https://" + v;
  return v;
})();

function bridgeHeaders() {
  return {
    "x-api-key": Deno.env.get("FLOUBA_BASE44_API_KEY") || "",
    "Content-Type": "application/json",
  };
}

// ── Strip broker suffix so the bridge accepts the base symbol ──
const KNOWN_BASES = ["XAUUSD","XAUEUR","EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","NAS100","US30","US500","US2000","UK100","GER40","GER30","FRA40","JPN225","AUS200","HK50","CHINA50","SWI20","USOIL","UKOIL","NATGAS","BTCUSD","ETHUSD","LTCUSD","XRPUSD","BCHUSD","ADAUSD","DOTUSD","SOLUSD","DOGUSD","BNBUSD"];
function stripSuffix(sym) {
  if (typeof sym !== "string") return { base: sym, suffix: "" };
  for (const base of KNOWN_BASES) {
    if (sym.startsWith(base) && sym.length > base.length) {
      return { base, suffix: sym.slice(base.length) };
    }
  }
  return { base: sym, suffix: "" };
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron = cronSecret && (
      req.headers.get("X-Cron-Secret") === cronSecret || body.cron_secret === cronSecret
    );

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    // ═══════════════════════════════════════════════════════════════
    // CRON MODE — iterate all users with AI auto-execute enabled
    // ═══════════════════════════════════════════════════════════════
    if (isCron && !body.user_id) {
      const allSettings = await base44.asServiceRole.entities.BotSettings.list();
      const allUsers = await base44.asServiceRole.entities.User.list();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const eligible = allSettings.filter(s =>
        s.ai_auto_execute_enabled === true &&
        s.mt5_account &&
        s.mt5_password &&
        s.mt5_server
      );

      const results = [];
      for (const config of eligible) {
        const userData = userMap.get(config.created_by_id);
        if (!userData?.flouba_token) continue;

        try {
          const result = await analyzeAndExecute(base44, config, userData, body.force_execute === true);
          results.push({ user: config.created_by_id, login: config.mt5_account, ...result });
        } catch (err) {
          results.push({ user: config.created_by_id, login: config.mt5_account, error: err.message });
        }
      }

      return Response.json({
        ok: true,
        mode: "cron",
        usersChecked: results.length,
        results,
        checkedAt: new Date().toISOString(),
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // MANUAL MODE — current authenticated user
    // ═══════════════════════════════════════════════════════════════
    // IDOR guard: a non-admin caller can only ever act as themselves.
    // body.user_id (acting on another account) is restricted to admins.
    let caller = null;
    if (!isCron) {
      caller = await base44.auth.me().catch(() => null);
      if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = isCron || caller?.role === "admin";
    const userId = (body.user_id && isAdmin) ? body.user_id : (caller ? caller.id : null);
    const user = userId
      ? await base44.asServiceRole.entities.User.get(userId).catch(() => null)
      : null;
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const settings = await base44.asServiceRole.entities.BotSettings.filter(
      { created_by_id: userId }, "-created_date", 1
    );
    const config = settings?.[0];
    if (!config) return Response.json({ error: "No BotSettings found" }, { status: 400 });

    const result = await analyzeAndExecute(base44, config, user, body.force_execute === true);

    return Response.json({ ok: true, mode: "manual", ...result });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

// ═══════════════════════════════════════════════════════════════
// Core: invoke tradeDecisionEngine for the user, execute if TRADE
// ═══════════════════════════════════════════════════════════════
async function analyzeAndExecute(base44, config, user, forceExecute) {
  // ── 1. Invoke the Trade Decision Engine (all 8 pillars, all strategies) ──
  const decisionRes = await base44.functions.invoke("tradeDecisionEngine", {
    target_user_id: config.created_by_id,
  }).catch((e) => ({ data: { error: e.message } }));

  const decision = decisionRes?.data || decisionRes;
  if (decision?.error) {
    return { executed: false, error: decision.error, decision: null };
  }

  // ── 2. Invoke the AI Strategy Selector (best strategy name across all 15) ──
  const strategyRes = await base44.functions.invoke("aiStrategySelector", {
    target_user_id: config.created_by_id,
  }).catch(() => ({ data: {} }));
  const strategyInfo = strategyRes?.data || strategyRes || {};
  const bestStrategy = strategyInfo?.strategy || config.adaptive_active_strategy || "Auto (AI Select)";

  // ── 3. Check if the decision is a TRADE signal ──
  const isTrade = decision?.decision === "TRADE" || decision?.decision === "RECOVERY_TRADE";
  const score = decision?.score || 0;
  const minScore = config.ai_auto_execute_min_score ?? 70;

  // In manual mode with force_execute, allow execution even below min score
  // In auto mode, require score >= minScore
  const scoreOk = forceExecute || score >= minScore;

  if (!isTrade || !scoreOk) {
    return {
      executed: false,
      decision: decision?.decision,
      reason: decision?.reason,
      score,
      minScore,
      bestStrategy,
      trade: decision?.trade || null,
      pillars: decision?.pillars || [],
      regime: decision?.regime,
      direction: decision?.direction,
    };
  }

  const trade = decision?.trade;
  if (!trade?.direction) {
    return {
      executed: false,
      decision: decision?.decision,
      reason: "No trade direction in signal",
      score,
      bestStrategy,
    };
  }

  // ── 4. Execute the trade via the MT5 bridge ──
  const symbol = config.active_pair || "XAUUSD";
  const robotId = String(config.mt5_account || "");
  if (!robotId) {
    return {
      executed: false,
      decision: decision?.decision,
      reason: "No MT5 account linked — cannot address robot",
      score,
      bestStrategy,
    };
  }

  const commandType = trade.direction === "BUY" ? "OPEN_BUY" : "OPEN_SELL";
  const cmdBody = {
    commandType,
    symbol,
    lotSize: Number(trade.lot_size),
    stopLoss: trade.stop_loss != null ? Number(trade.stop_loss) : undefined,
    takeProfit: trade.take_profit != null ? Number(trade.take_profit) : undefined,
  };

  const idemKey = `${commandType}-${robotId}-${Date.now()}`;
  const tradeRes = await fetch(`${BASE}/api/base44/robots/${encodeURIComponent(robotId)}/commands`, {
    method: "POST",
    headers: { ...bridgeHeaders(), "x-idempotency-key": idemKey },
    body: JSON.stringify(cmdBody),
  }).catch(() => null);

  const tradeJson = tradeRes?.ok ? await tradeRes.json().catch(() => ({})) : {};
  const cmdData = tradeJson?.data ?? tradeJson;
  const execSuccess = !!tradeRes?.ok && (tradeJson?.success === true || !!cmdData?.commandId || !!cmdData?.id);

  // ── 5. Log the trade to the Trade entity for journaling ──
  if (execSuccess) {
    try {
      await base44.asServiceRole.entities.Trade.create({
        pair: symbol,
        direction: trade.direction === "BUY" ? "Buy" : "Sell",
        lot: trade.lot_size,
        entry_price: trade.entry,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit,
        status: "Open",
        pattern: bestStrategy,
        opened_at: new Date().toISOString(),
        ticket_id: cmdData?.commandId || cmdData?.id || String(Date.now()),
      });
    } catch {}
  }

  return {
    executed: execSuccess,
    decision: decision?.decision,
    reason: decision?.reason,
    score,
    minScore,
    bestStrategy,
    bestStrategyReason: strategyInfo?.reason || null,
    trade: {
      direction: trade.direction,
      symbol,
      lot_size: trade.lot_size,
      entry: trade.entry,
      stop_loss: trade.stop_loss,
      take_profit: trade.take_profit,
      risk_reward: trade.risk_reward,
      ai_sl_mult: trade.ai_sl_mult,
      ai_rr: trade.ai_rr,
    },
    execution: {
      action: commandType,
      sent: execSuccess,
      bridge_response: tradeJson?.message || tradeJson?.error || (tradeRes ? `HTTP ${tradeRes.status}` : "no response"),
      ticket: cmdData?.commandId || cmdData?.id || null,
    },
    pillars: decision?.pillars || [],
    regime: decision?.regime,
    direction: decision?.direction,
  };
}