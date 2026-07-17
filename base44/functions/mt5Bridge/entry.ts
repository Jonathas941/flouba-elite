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

const BASE = (() => {
  let v = (Deno.env.get("FLOUBA_BACKEND_URL") || "").trim().replace(/\/+$/, "");
  if (v && !/^https?:\/\//i.test(v)) v = "https://" + v;
  return v;
})();

function authHeaders() {
  const apiKey = Deno.env.get("FLOUBA_BASE44_API_KEY");
  return {
    "x-api-key": apiKey || "",
    "x-request-id": crypto.randomUUID(),
    "x-timestamp": new Date().toISOString(),
    "Content-Type": "application/json",
  };
}

async function bridgeCall(method, path, body, extraHeaders) {
  if (!BASE) return { ok: false, status: 503, data: null, error: "FLOUBA_BACKEND_URL not set" };
  let res = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers: { ...authHeaders(), ...(extraHeaders || {}) },
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
      let host = null, schemeOk = false;
      try { if (BASE) { const u = new URL(BASE); host = u.host; schemeOk = u.protocol === "https:" || u.protocol === "http:"; } } catch {}
      return Response.json({ ok: r.ok, status: r.status, data: r.data ?? { healthy: r.ok }, error: r.error || null, base_set: !!BASE, base_host: host, base_valid_url: schemeOk });
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
      return Response.json({ ok: r.ok, status: r.status, data: { account: normalizeAccount(r.data) }, error: r.error || null });
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

    // ── robot_start: push config to settings, then POST /start ──
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
      const idemKey = `start-${robotId}-${Date.now()}`;
      const r = await bridgeCall("POST", `${robotPath}/start`, {
        metadata: { strategy: params.strategy, symbol: params.symbol },
      }, { "x-idempotency-key": idemKey });
      return Response.json({ ok: r.ok, status: r.status, data: { success: r.ok, command: r.data } });
    }

    // ── robot_stop ──
    if (action === "robot_stop") {
      const idemKey = `stop-${robotId}-${Date.now()}`;
      const r = await bridgeCall("POST", `${robotPath}/stop`, { metadata: {} }, { "x-idempotency-key": idemKey });
      return Response.json({ ok: r.ok, status: r.status, data: { success: r.ok, command: r.data } });
    }

    // ── close_all ──
    if (action === "close_all") {
      const idemKey = `closeall-${robotId}-${Date.now()}`;
      const r = await bridgeCall("POST", `${robotPath}/close-all`, { metadata: {} }, { "x-idempotency-key": idemKey });
      return Response.json({ ok: r.ok, status: r.status, data: { success: r.ok, command: r.data } });
    }

    // ── close single position (no dedicated endpoint in contract — use /commands queue) ──
    if (action === "close") {
      const cmd = { commandType: "CLOSE_POSITION" };
      if (params.ticket != null) cmd.brokerTicket = String(params.ticket);
      const r = await bridgeCall("POST", `${robotPath}/commands`, cmd, { "x-idempotency-key": `close-${robotId}-${params.ticket}-${Date.now()}` });
      return Response.json({ ok: r.ok, status: r.status, data: { success: r.ok, command: r.data } });
    }

    // ── buy / sell (market orders — no dedicated endpoint in contract — use /commands queue) ──
    if (action === "buy" || action === "sell") {
      const dir = action === "buy" ? "BUY" : "SELL";
      const cmd = {
        commandType: action === "buy" ? "OPEN_BUY" : "OPEN_SELL",
        direction: dir,
      };
      if (params.symbol) cmd.symbol = params.symbol;
      if (params.volume != null) cmd.lotSize = Number(params.volume);
      if (params.lot_size != null) cmd.lotSize = Number(params.lot_size);
      if (params.sl != null) cmd.stopLoss = Number(params.sl);
      if (params.tp != null) cmd.takeProfit = Number(params.tp);
      if (params.stop_loss != null) cmd.stopLoss = Number(params.stop_loss);
      if (params.take_profit != null) cmd.takeProfit = Number(params.take_profit);
      const r = await bridgeCall("POST", `${robotPath}/commands`, cmd, { "x-idempotency-key": `${dir}-${robotId}-${Date.now()}` });
      return Response.json({ ok: r.ok, status: r.status, data: { success: r.ok, command: r.data } });
    }

    // ── history (closed trades synced by the EA) ──
    if (action === "history") {
      const limit = Math.min(Number(params.limit) || 50, 200);
      const r = await bridgeCall("GET", `${robotPath}/trades?limit=${limit}`);
      return Response.json({ ok: r.ok, status: r.status, data: { trades: Array.isArray(r.data) ? r.data : (r.data?.items || []) } });
    }

    // ── Heartbeat fallback: when /indicators is unreachable (Railway stale build),
    //    assemble a degraded snapshot from the latest heartbeat record. No EMA/RSI/ADX/ATR,
    //    but spread + symbol + risk flags keep the scanner informative. ──
    async function heartbeatFallback() {
      const r = await bridgeCall("GET", `${robotPath}/heartbeat`);
      if (!r.ok || !Array.isArray(r.data) || r.data.length === 0) return null;
      const hb = r.data[0];
      return {
        _symbol: hb.currentSymbol || cfg?.active_pair || "XAUUSD",
        _receivedAt: hb.receivedAt,
        spread: hb.currentSpread != null ? Number(hb.currentSpread) : null,
        bid: null, ask: null,
        ema20: null, ema50: null, ema200: null, adx: null, rsi: null, atr: null,
        _degraded: true,
        _risk: {
          session_allowed: hb.sessionAllowed,
          spread_filter_passed: hb.spreadFilterPassed,
          risk_status: hb.riskStatus,
          open_positions: hb.openPositionCount,
          floating_profit: hb.floatingProfit != null ? Number(hb.floatingProfit) : null,
          drawdown_pct: hb.drawdownPercent != null ? Number(hb.drawdownPercent) : null,
        },
      };
    }

    // ── indicators: raw diagnostic of the EA-published indicator snapshot (heartbeat fallback) ──
    if (action === "indicators") {
      const r = await bridgeCall("GET", `${robotPath}/indicators`);
      if (r.ok) return Response.json({ ok: true, status: r.status, data: r.data, error: null });
      const hb = await heartbeatFallback();
      return Response.json({ ok: !!hb, status: hb ? 200 : r.status, data: hb, error: hb ? null : (r.error || "Indicator feed unavailable.") });
    }

    // ── symbols: live bid/ask/spread (heartbeat fallback) ──
    if (action === "symbols") {
      const indRes = await bridgeCall("GET", `${robotPath}/indicators`);
      const ind = indRes.ok ? (indRes.data || {}) : {};
      if (ind.bid == null && ind.ask == null) {
        const hb = await heartbeatFallback();
        if (hb && hb.spread != null) {
          return Response.json({
            ok: true, status: 200,
            data: {
              degraded: true,
              symbols: [{
                symbol: hb._symbol,
                bid: null, ask: null,
                spread: hb.spread,
                time: hb._receivedAt,
              }],
            },
          });
        }
        return Response.json({ ok: false, status: 200, data: null, error: indRes.error || "No live quotes yet — waiting for EA heartbeat." });
      }
      return Response.json({
        ok: true, status: 200,
        data: {
          symbols: [{
            symbol: ind._symbol || cfg?.active_pair || "XAUUSD",
            bid: ind.bid, ask: ind.ask,
            spread: ind.spread, time: ind._receivedAt,
          }],
        },
      });
    }

    // ── scanner_status: assemble a real scanner payload from EA indicators + account + positions ──
    if (action === "scanner_status") {
      const [indRes, acctRes, posRes, statusRes] = await Promise.all([
        bridgeCall("GET", `${robotPath}/indicators`),
        bridgeCall("GET", `${robotPath}/account`),
        bridgeCall("GET", `${robotPath}/positions`),
        bridgeCall("GET", `${robotPath}/status`),
      ]);
      let ind = indRes.ok ? (indRes.data || {}) : {};
      let degraded = false;
      if (ind.bid == null && ind.ema20 == null) {
        const hb = await heartbeatFallback();
        if (!hb) {
          return Response.json({ ok: false, status: 200, data: null, error: indRes.error || "Indicator feed unavailable — waiting for EA heartbeat." });
        }
        ind = hb; degraded = true;
      }
      const acct = acctRes.ok ? normalizeAccount(acctRes.data) : null;
      const positions = posRes.ok && Array.isArray(posRes.data) ? posRes.data.map(normalizePosition) : [];
      const st = statusRes.ok ? (statusRes.data || {}) : {};

      const indicators = {
        ema_20: ind.ema20, ema_50: ind.ema50, ema_200: ind.ema200,
        adx: ind.adx, adx_14: ind.adx,
        rsi: ind.rsi, rsi_14: ind.rsi,
        atr: ind.atr, atr_14: ind.atr,
        spread_pips: ind.spread, spread: ind.spread,
        bid: ind.bid, ask: ind.ask,
        ema_slope: ind.emaSlope,
      };

      const price = ind.bid ?? ind.ask;
      const ema20 = ind.ema20, ema50 = ind.ema50, ema200 = ind.ema200;
      const adx = ind.adx, rsi = ind.rsi, atr = ind.atr, spread = ind.spread;
      const robotRunning = st.status === "ONLINE" || st.robotRunning === true;

      // ── Degraded mode (no indicator feed): report live status without a confluence score ──
      if (degraded) {
        const hbRisk = ind._risk || {};
        const floatingPnl = acct ? (acct.profit ?? (acct.equity - acct.balance)) : (hbRisk.floating_profit ?? 0);
        const conditions = [
          "⚠ Indicator feed deploying — showing live heartbeat status (no confluence score).",
          `Robot ${robotRunning ? "ONLINE" : "OFFLINE"} — symbol ${ind._symbol || cfg?.active_pair || "XAUUSD"}.`,
          spread != null ? `Spread ${spread}pts.` : "Spread unavailable.",
          `Open positions: ${positions.length}.`,
          hbRisk.session_allowed != null ? `Session allowed: ${hbRisk.session_allowed ? "yes" : "no"}.` : "",
          hbRisk.spread_filter_passed != null ? `Spread filter: ${hbRisk.spread_filter_passed ? "passed" : "blocked"}.` : "",
          hbRisk.risk_status ? `Risk status: ${hbRisk.risk_status}.` : "",
        ].filter(Boolean);
        return Response.json({
          ok: true, status: 200,
          data: {
            scanner: {
              symbol: ind._symbol || cfg?.active_pair || "XAUUSD",
              strategy: cfg.adaptive_active_strategy || "auto",
              last_signal: "HOLD",
              signal_score: null,
              last_scan_time: ind._receivedAt || new Date().toISOString(),
              robot_running: robotRunning,
              open_positions_count: positions.length,
              indicators: { spread_pips: spread, spread, degraded: true },
              conditions,
              risk: {
                daily_pnl: Math.round(floatingPnl * 100) / 100,
                open_trades: positions.length,
                trading_allowed: false,
                block_reason: "Indicator feed deploying — confluence score unavailable.",
              },
              degraded: true,
              reason: `Live heartbeat mode — ${positions.length} open position(s), score pending indicator feed.`,
            },
          },
        });
      }

      // ── Lightweight confluence score + direction (heavy 8-pillar engine is tradeDecisionEngine) ──
      const conditions = [];
      let score = 0;
      let direction = "HOLD";

      if (ema20 != null && ema50 != null && price != null) {
        const bull = ema20 > ema50 && price > ema20 && price > ema50 && (ema200 == null || price > ema200);
        const bear = ema20 < ema50 && price < ema20 && price < ema50 && (ema200 == null || price < ema200);
        if (bull) { score += 25; direction = "BUY"; conditions.push("✓ EMA stack bullish (20>50, price above)"); }
        else if (bear) { score += 25; direction = "SELL"; conditions.push("✓ EMA stack bearish (20<50, price below)"); }
        else conditions.push("✗ EMA stack flat / entangled — no trend");
      } else conditions.push("✗ EMA data incomplete");

      if (adx != null) {
        if (adx >= 25) { score += 20; conditions.push(`✓ ADX ${adx.toFixed(0)} ≥ 25 — strong trend`); }
        else if (adx >= 20) { score += 12; conditions.push(`ADX ${adx.toFixed(0)} forming (20-25)`); }
        else conditions.push(`✗ ADX ${adx.toFixed(0)} < 20 — weak/no trend`);
      } else conditions.push("✗ ADX unavailable");

      if (rsi != null && direction !== "HOLD") {
        if (direction === "BUY" && rsi >= 50 && rsi <= 70) { score += 15; conditions.push(`✓ RSI ${rsi.toFixed(0)} in BUY zone (50-70)`); }
        else if (direction === "SELL" && rsi >= 30 && rsi <= 50) { score += 15; conditions.push(`✓ RSI ${rsi.toFixed(0)} in SELL zone (30-50)`); }
        else if (rsi > 70) conditions.push(`✗ RSI ${rsi.toFixed(0)} overbought — chasing`);
        else if (rsi < 30) conditions.push(`✗ RSI ${rsi.toFixed(0)} oversold — chasing`);
        else conditions.push(`RSI ${rsi.toFixed(0)} neutral for ${direction}`);
      } else if (rsi != null) conditions.push(`RSI ${rsi.toFixed(0)} — no direction yet`);

      if (atr != null && price != null && price > 0) {
        const ratio = atr / price;
        if (ratio >= 0.0004 && ratio <= 0.003) { score += 10; conditions.push(`✓ ATR ${(ratio*100).toFixed(3)}% — healthy volatility`); }
        else if (ratio < 0.0004) conditions.push(`✗ ATR ${(ratio*100).toFixed(3)}% — market too quiet`);
        else conditions.push(`✗ ATR ${(ratio*100).toFixed(2)}% — extreme volatility`);
      } else conditions.push("✗ ATR unavailable");

      const maxSpread = cfg.swing_max_spread_points ?? 30;
      if (spread != null) {
        if (spread <= maxSpread) { score += 5; conditions.push(`✓ Spread ${spread}pts ≤ ${maxSpread}`); }
        else conditions.push(`✗ Spread ${spread}pts > ${maxSpread} — too wide`);
      } else conditions.push("Spread unavailable");

      const utcMin = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
      const inLondon = utcMin >= 480 && utcMin < 720;
      const inNY = utcMin >= 720 && utcMin <= 1020;
      const inOverlap = utcMin >= 720 && utcMin <= 900;
      const inAsian = utcMin >= 1915 || utcMin <= 225;
      let sessScore = 0, sessName = "Off-Session";
      if (inOverlap) { sessScore = 5; sessName = "London/NY Overlap"; }
      else if (inNY) { sessScore = 4; sessName = "New York"; }
      else if (inLondon) { sessScore = 4; sessName = "London"; }
      else if (inAsian && cfg.asian_session !== false) { sessScore = 2; sessName = "Asian"; }
      else if (inAsian) conditions.push("✗ Asian session disabled");
      score += sessScore;
      if (sessScore > 0) conditions.push(`✓ ${sessName} session active`);
      else if (!inAsian) conditions.push("✗ Off-session — waiting for London/NY");

      score = Math.min(100, Math.round(score));
      const threshold = cfg.min_score_balanced ?? 75;
      const lastSignal = score >= threshold ? direction : "HOLD";

      const floatingPnl = acct ? (acct.profit ?? (acct.equity - acct.balance)) : 0;
      const risk = {
        daily_trades: 0,
        daily_pnl: Math.round(floatingPnl * 100) / 100,
        open_trades: positions.length,
        trading_allowed: robotRunning && score >= threshold,
        block_reason: !robotRunning ? "Robot paused" : (score < threshold ? `Score ${score} below ${threshold} threshold` : null),
      };

      return Response.json({
        ok: true,
        status: 200,
        data: {
          scanner: {
            symbol: ind._symbol || cfg?.active_pair || "XAUUSD",
            strategy: cfg.adaptive_active_strategy || "auto",
            last_signal: lastSignal,
            signal_score: score,
            last_scan_time: ind._receivedAt || new Date().toISOString(),
            robot_running: robotRunning,
            open_positions_count: positions.length,
            indicators,
            conditions,
            risk,
            reason: robotRunning
              ? `Live EA scan — ${positions.length} open position(s), score ${score}/100.`
              : "Robot is paused — press START to begin live scanning.",
          },
        },
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});