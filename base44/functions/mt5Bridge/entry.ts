import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Flouba Lite bridge (command-queue architecture) ──────────────────────────
// Base44 authenticates to the bridge with a single shared secret (x-api-key =
// BASE44_API_KEY), not per-user tokens. Per-user identity is the robotId, which
// maps 1:1 to the user's MT5 account number (set in BotSettings.mt5_account and
// configured as the EA's Robot_Id input).
//
// The EA is the source of truth: it connects to MT5 locally, registers itself
// via /api/mt5/register, pushes account/positions/trades via sync, and polls
// /api/mt5/commands. Base44 reads synced snapshots from /api/base44/robots/:id
// and issues trade/control commands into the queue (201 = queued, not executed).

const BASE = (Deno.env.get("FLOUBA_BACKEND_URL") || "").replace(/\/$/, "");

function authHeaders() {
  const apiKey = Deno.env.get("FLOUBA_BASE44_API_KEY");
  return {
    "x-api-key": apiKey || "",
    "x-request-id": crypto.randomUUID(),
    "x-timestamp": new Date().toISOString(),
    "Content-Type": "application/json",
  };
}

async function bridgeCall(method, path, body) {
  if (!BASE) return { ok: false, status: 503, data: null, error: "FLOUBA_BACKEND_URL not set" };
  let res = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers: authHeaders(),
        ...(method !== "GET" && body != null ? { body: JSON.stringify(body) } : {}),
      });
      if (res.status !== 502 && res.status !== 503 && res.status !== 504) break;
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  if (!res) return { ok: false, status: 502, data: null, error: lastErr?.message || "Bridge unreachable" };
  const raw = await res.text();
  let json;
  try { json = JSON.parse(raw); } catch { json = { raw }; }
  if (!res.ok) {
    const err = json?.error?.message || json?.error || json?.message || `HTTP ${res.status}`;
    return { ok: false, status: res.status, data: null, error: err };
  }
  // Bridge success envelope: { success, data, meta }
  return { ok: true, status: res.status, data: json?.data ?? json };
}

// Normalize a bridge account snapshot into the dashboard's expected shape.
function normalizeAccount(a) {
  if (!a) return null;
  return {
    login: a.accountLogin ?? a.login,
    balance: a.balance,
    equity: a.equity,
    margin: a.margin,
    free_margin: a.freeMargin ?? a.free_margin,
    margin_level: a.marginLevel,
    profit: a.floatingProfit ?? a.profit ?? a.dailyProfit,
    profit_today: a.dailyProfit ?? a.dailyNetProfit,
    floating_pnl: a.floatingProfit,
    daily_drawdown: a.drawdownPercent,
    currency: a.accountCurrency,
    leverage: a.leverage,
    broker: a.brokerName,
    server: a.brokerServer,
    terminal_connected: a.terminalConnected,
    broker_connected: a.brokerConnected,
    last_sync: a.lastSyncedAt,
    connected: a.terminalConnected === true || a.balance != null,
  };
}

// Normalize a bridge position row into the dashboard's expected shape.
function normalizePosition(p) {
  if (!p) return p;
  return {
    ...p,
    symbol: p.symbol,
    direction: p.direction,
    type: (p.direction || p.type || "").toString(),
    lot: p.volume ?? p.lotSize ?? p.lot_size ?? p.lots,
    volume: p.volume ?? p.lotSize ?? p.lot_size ?? p.lots,
    profit: p.profit ?? p.floatingProfit ?? p.unrealized_pnl,
    unrealized_pnl: p.profit ?? p.floatingProfit ?? p.unrealized_pnl,
    ticket: p.brokerTicket ?? p.ticket,
    opened_at: p.openedAt ?? p.opened_at,
    stop_loss: p.stopLoss ?? p.stop_loss,
    take_profit: p.takeProfit ?? p.take_profit,
  };
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Load the user's MT5 account → robotId. There is no per-user provisioning
    // in the new bridge; the EA registers itself and Base44 addresses it by id.
    const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id }, "-created_date", 1);
    const cfg = settings?.[0];

    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }
    const { action, ...params } = body;

    // /health/live is unauthenticated — allow it without a robotId.
    if (action === "status") {
      const r = await bridgeCall("GET", "/health/live");
      return Response.json({ ok: r.ok, status: r.status, data: r.data ?? { healthy: r.ok } });
    }

    const robotId = String(cfg?.mt5_account || "");
    if (!robotId) {
      return Response.json({
        ok: false,
        status: 200,
        data: { account: { connected: false }, positions: [], robot: { running: false } },
        error: "MT5 account not connected — link your account and the EA will register its robot.",
      }, { status: 200 });
    }

    const robotPath = `/api/base44/robots/${encodeURIComponent(robotId)}`;

    // ── account ──
    if (action === "account") {
      const r = await bridgeCall("GET", `${robotPath}/account`);
      return Response.json({ ok: r.ok, status: r.status, data: { account: normalizeAccount(r.data) } });
    }

    // ── positions ──
    if (action === "positions") {
      const r = await bridgeCall("GET", `${robotPath}/positions`);
      const positions = Array.isArray(r.data) ? r.data.map(normalizePosition) : [];
      return Response.json({ ok: r.ok, status: r.status, data: { positions } });
    }

    // ── robot_status (EA connection + trading engine state) ──
    if (action === "robot_status") {
      const r = await bridgeCall("GET", `${robotPath}/status`);
      const st = r.data || {};
      const running = st.status === "ONLINE" || st.robotRunning === true;
      return Response.json({
        ok: r.ok,
        status: r.status,
        data: {
          robot: {
            running,
            status: st.status,
            emergency_stop: st.emergencyStopActive,
            last_heartbeat: st.lastHeartbeatAt,
            config: { symbol: st.symbol || cfg?.active_pair || "XAUUSD" },
          },
        },
      });
    }

    // ── connect: the EA connects to MT5 locally; Base44 just verifies the robot exists ──
    if (action === "connect") {
      const r = await bridgeCall("GET", `${robotPath}/status`);
      return Response.json({ ok: r.ok, status: r.status, data: { connected: r.ok && r.data?.status === "ONLINE" } });
    }

    // ── robot_start: push config to settings, then issue START_ROBOT command ──
    if (action === "robot_start") {
      // Push the user's launch config into the robot's settings first.
      const settingsPatch = {};
      if (params.symbol) settingsPatch.symbol = params.symbol;
      if (params.lot_size != null) settingsPatch.lotSize = Number(params.lot_size);
      if (params.risk_percentage != null) settingsPatch.riskPercent = Number(params.risk_percentage);
      if (params.stop_loss != null) settingsPatch.stopLossPips = Number(params.stop_loss);
      if (params.take_profit != null) settingsPatch.takeProfitPips = Number(params.take_profit);
      if (params.max_concurrent_trades != null) settingsPatch.maxConcurrentTrades = Number(params.max_concurrent_trades);
      if (params.daily_profit_target != null) settingsPatch.dailyProfitTarget = Number(params.daily_profit_target);
      if (params.daily_loss_limit != null) settingsPatch.dailyLossLimit = Number(params.daily_loss_limit);
      if (params.trade_direction) settingsPatch.tradeDirection = params.trade_direction;
      if (Object.keys(settingsPatch).length > 0) {
        await bridgeCall("PUT", `${robotPath}/settings`, settingsPatch);
      }
      const r = await bridgeCall("POST", `${robotPath}/commands`, {
        commandType: "START_ROBOT",
        idempotencyKey: `start-${robotId}-${Date.now()}`,
        metadata: { strategy: params.strategy, symbol: params.symbol },
      });
      return Response.json({ ok: r.ok, status: r.status, data: { success: r.ok, command: r.data } });
    }

    // ── robot_stop ──
    if (action === "robot_stop") {
      const r = await bridgeCall("POST", `${robotPath}/commands`, {
        commandType: "STOP_ROBOT",
        idempotencyKey: `stop-${robotId}-${Date.now()}`,
      });
      return Response.json({ ok: r.ok, status: r.status, data: { success: r.ok, command: r.data } });
    }

    // ── close_all ──
    if (action === "close_all") {
      const r = await bridgeCall("POST", `${robotPath}/commands`, {
        commandType: "CLOSE_ALL_POSITIONS",
        idempotencyKey: `closeall-${robotId}-${Date.now()}`,
      });
      return Response.json({ ok: r.ok, status: r.status, data: { success: r.ok, command: r.data } });
    }

    // ── close single position ──
    if (action === "close") {
      const cmd = {
        commandType: "CLOSE_POSITION",
        idempotencyKey: `close-${robotId}-${params.ticket}-${Date.now()}`,
      };
      if (params.ticket != null) cmd.brokerTicket = String(params.ticket);
      const r = await bridgeCall("POST", `${robotPath}/commands`, cmd);
      return Response.json({ ok: r.ok, status: r.status, data: { success: r.ok, command: r.data } });
    }

    // ── buy / sell (market orders) ──
    if (action === "buy" || action === "sell") {
      const dir = action === "buy" ? "BUY" : "SELL";
      const cmd = {
        commandType: action === "buy" ? "OPEN_BUY" : "OPEN_SELL",
        direction: dir,
        idempotencyKey: `${dir}-${robotId}-${Date.now()}`,
      };
      if (params.symbol) cmd.symbol = params.symbol;
      if (params.volume != null) cmd.lotSize = Number(params.volume);
      if (params.lot_size != null) cmd.lotSize = Number(params.lot_size);
      if (params.sl != null) cmd.stopLoss = Number(params.sl);
      if (params.tp != null) cmd.takeProfit = Number(params.tp);
      if (params.stop_loss != null) cmd.stopLoss = Number(params.stop_loss);
      if (params.take_profit != null) cmd.takeProfit = Number(params.take_profit);
      const r = await bridgeCall("POST", `${robotPath}/commands`, cmd);
      return Response.json({ ok: r.ok, status: r.status, data: { success: r.ok, command: r.data } });
    }

    // ── history (closed trades synced by the EA) ──
    if (action === "history") {
      const limit = Math.min(Number(params.limit) || 50, 200);
      const r = await bridgeCall("GET", `${robotPath}/trades?limit=${limit}`);
      return Response.json({ ok: r.ok, status: r.status, data: { trades: Array.isArray(r.data) ? r.data : (r.data?.items || []) } });
    }

    // ── symbols / scanner_status: no market-data endpoint in the command-queue bridge ──
    if (action === "symbols" || action === "scanner_status") {
      return Response.json({
        ok: false,
        status: 200,
        data: null,
        error: "This bridge has no live market-data endpoint. The EA owns the terminal; quotes/scanner indicators are not published to the bridge.",
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});