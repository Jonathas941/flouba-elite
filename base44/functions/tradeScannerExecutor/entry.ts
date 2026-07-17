import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ── Trade Decision Engine Scanner + Auto-Executor ───────────────────────────
// Polls the 8-pillar Trade Decision Engine on a schedule. When the engine
// returns a TRADE / RECOVERY_TRADE signal that passes the user's min-score
// gate AND the robot is running AND the user has AI auto-execute enabled,
// the scanner places the order through the Flouba Lite command-queue bridge
// (shared x-api-key + robotId = MT5 account), logs a Trade record, and stores
// an EXECUTED FloubaSignal. Designed to run from cron (CRON_SECRET) for all
// eligible users, or manually for the current authenticated user.

const BRIDGE = (() => {
  let v = (Deno.env.get("FLOUBA_BACKEND_URL") || "").trim().replace(/\/+$/, "");
  if (v && !/^https?:\/\//i.test(v)) v = "https://" + v;
  return v;
})();
const B44 = `${BRIDGE}/api/base44`;

function bridgeHeaders(robotId) {
  return {
    "x-api-key": Deno.env.get("FLOUBA_BASE44_API_KEY") || "",
    "x-request-id": crypto.randomUUID(),
    "x-timestamp": new Date().toISOString(),
    "Content-Type": "application/json",
    ...(robotId ? { "x-robot-id": String(robotId) } : {}),
  };
}

async function postCommand(robotId, command, idemKey) {
  if (!BRIDGE) return { ok: false, error: "FLOUBA_BACKEND_URL not set" };
  try {
    const res = await fetch(`${B44}/robots/${encodeURIComponent(String(robotId))}/commands`, {
      method: "POST",
      headers: { ...bridgeHeaders(robotId), "x-idempotency-key": idemKey },
      body: JSON.stringify(command),
    });
    const raw = await res.text();
    let json; try { json = JSON.parse(raw); } catch { json = { raw }; }
    if (!res.ok) return { ok: false, status: res.status, error: json?.error?.message || json?.error || json?.message || `HTTP ${res.status}` };
    return { ok: true, status: res.status, data: json?.data ?? json };
  } catch (e) {
    return { ok: false, error: e.message };
  }
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

    // ═══ CRON MODE — scan & execute for every eligible user ═══
    if (isCron && !body.user_id) {
      const allSettings = await base44.asServiceRole.entities.BotSettings.list();
      // Eligible: AI auto-execute enabled + MT5 account linked.
      const eligible = allSettings.filter(s =>
        s.ai_auto_execute_enabled === true &&
        s.mt5_account &&
        s.robot_status !== "Paused"
      );
      const results = [];
      for (const cfg of eligible) {
        try {
          const r = await scanAndExecute(base44, cfg, !!body.force_execute);
          results.push({ user: cfg.created_by_id, login: cfg.mt5_account, ...r });
        } catch (err) {
          results.push({ user: cfg.created_by_id, login: cfg.mt5_account, error: err.message });
        }
      }
      return Response.json({ ok: true, mode: "cron", usersChecked: results.length, results, checkedAt: new Date().toISOString() });
    }

    // ═══ MANUAL MODE — current authenticated user ═══
    if (!isCron) {
      const isAuth = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuth) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId = body.user_id || null;
    let user = null;
    if (userId) {
      user = await base44.asServiceRole.entities.User.get(userId).catch(() => null);
    } else {
      user = await base44.auth.me().catch(() => null);
      if (user) userId = user.id;
    }
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const settings = await base44.asServiceRole.entities.BotSettings.filter({ created_by_id: userId }, "-created_date", 1);
    const cfg = settings?.[0];
    if (!cfg) return Response.json({ error: "No BotSettings found" }, { status: 400 });

    const result = await scanAndExecute(base44, cfg, !!body.force_execute);
    return Response.json({ ok: true, mode: "manual", ...result });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

// ═══ Core: poll the decision engine, execute if a valid signal is produced ═══
async function scanAndExecute(base44, cfg, forceExecute) {
  // ── 1. Invoke the 8-pillar Trade Decision Engine (cron-aware) ──
  const decisionRes = await base44.functions.invoke("tradeDecisionEngine", {
    target_user_id: cfg.created_by_id,
  }).catch((e) => ({ data: { error: e.message } }));
  const decision = decisionRes?.data || decisionRes;
  if (decision?.error) return { executed: false, error: decision.error, decision: null };

  // ── 2. Gate: must be a TRADE/RECOVERY signal ──
  const isTrade = decision?.decision === "TRADE" || decision?.decision === "RECOVERY_TRADE";
  const score = decision?.score || 0;
  const minScore = forceExecute ? 0 : (cfg.ai_auto_execute_min_score ?? 70);

  if (!isTrade) {
    return {
      executed: false,
      decision: decision?.decision,
      reason: decision?.reason || "No trade signal",
      score,
      minScore,
      robot_running: decision?.robot_running,
      regime: decision?.regime,
    };
  }
  if (!forceExecute && score < minScore) {
    return {
      executed: false,
      decision: decision?.decision,
      reason: `Score ${score} below auto-execute minimum ${minScore}`,
      score,
      minScore,
    };
  }

  // ── 3. Gate: robot must be running (EA online) ──
  if (decision?.robot_running === false) {
    return {
      executed: false,
      decision: decision?.decision,
      reason: "Robot is not running — press START on the dashboard to enable live execution.",
      score,
      robot_running: false,
    };
  }

  const trade = decision?.trade;
  if (!trade?.direction) return { executed: false, reason: "No trade direction in signal", score };

  const symbol = cfg.active_pair || "XAUUSD";

  // ── 4. Dedup: skip if a trade for this symbol+direction was queued in the last 90s ──
  const since = new Date(Date.now() - 90 * 1000).toISOString();
  const recent = await base44.asServiceRole.entities.Trade.filter(
    { created_by_id: cfg.created_by_id, pair: symbol, direction: trade.direction === "BUY" ? "Buy" : "Sell", opened_at: { $gte: since } },
    "-opened_at", 1
  ).catch(() => []);
  if (recent?.length > 0) {
    return { executed: false, dedup: true, reason: `A ${trade.direction} ${symbol} order was already queued recently — skipping to avoid duplicate entry.`, score };
  }

  // ── 5. Execute via the Flouba Lite command-queue bridge ──
  const robotId = String(cfg.mt5_account);
  const commandType = trade.direction === "BUY" ? "OPEN_BUY" : "OPEN_SELL";
  const command = {
    commandType,
    direction: trade.direction,
    symbol,
    lotSize: Number(trade.lot_size),
    ...(trade.stop_loss != null ? { stopLoss: Number(trade.stop_loss) } : {}),
    ...(trade.take_profit != null ? { takeProfit: Number(trade.take_profit) } : {}),
  };
  const idemKey = `${commandType}-${robotId}-${symbol}-${Date.now()}`;
  const execRes = await postCommand(robotId, command, idemKey);
  const queued = execRes.ok === true;

  // ── 6. Persist: Trade (Open) + FloubaSignal (EXECUTED) ──
  let tradeId = null, signalId = null;
  if (queued) {
    try {
      const t = await base44.asServiceRole.entities.Trade.create({
        pair: symbol,
        direction: trade.direction === "BUY" ? "Buy" : "Sell",
        lot: trade.lot_size,
        entry_price: trade.entry,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit,
        status: "Open",
        pattern: cfg.adaptive_active_strategy || "Trade Decision Engine",
        opened_at: new Date().toISOString(),
        ticket_id: execRes?.data?.commandId || execRes?.data?.id || null,
      });
      tradeId = t?.id || null;
    } catch {}
    try {
      const sig = await base44.asServiceRole.entities.FloubaSignal.create({
        symbol,
        direction: trade.direction,
        entry_price: trade.entry,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit,
        lot_size: trade.lot_size,
        risk_percentage: cfg.risk_percentage ?? 1,
        confidence_score: score,
        signal_reason: decision?.reason || "Auto-executed by Trade Decision Engine scanner",
        market_structure_reason: decision?.regime ? `Regime: ${decision.regime}` : "Market structure analyzed",
        expiration_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        status: "EXECUTED",
        entry_style: "virtual_trigger",
        execution_mode: "full_auto",
        strategy_name: cfg.adaptive_active_strategy || "Auto",
        magic_number: 20260001,
        comment: "Flouba Auto-Execute",
        pillars: decision?.pillars || {},
        regime: decision?.regime || "",
        risk_reward: trade.risk_reward || 2,
        ticket_id: execRes?.data?.commandId || null,
        executed_at: new Date().toISOString(),
      });
      signalId = sig?.id || null;
    } catch {}
  }

  return {
    executed: queued,
    decision: decision?.decision,
    reason: decision?.reason,
    score,
    minScore,
    regime: decision?.regime,
    direction: trade.direction,
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
      command: commandType,
      queued,
      command_id: execRes?.data?.commandId || execRes?.data?.id || null,
      error: queued ? null : (execRes?.error || `HTTP ${execRes?.status}`),
    },
    trade_id: tradeId,
    signal_id: signalId,
    robot_running: decision?.robot_running,
    checked_at: new Date().toISOString(),
  };
}