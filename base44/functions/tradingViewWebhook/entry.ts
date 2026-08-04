import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ═══════════════════════════════════════════════════════════════
// TradingView Webhook Receiver — Independent from MT5
// POST /api/functions/tradingViewWebhook/:userId
//
// Flow: TradingView alert → webhook → validate → execute via
// independent trading API → save result → display on page.
// ═══════════════════════════════════════════════════════════════

// ── Symbol normalization ──────────────────────────────────────
function normalizeSymbol(raw) {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim().toUpperCase();
  // Strip exchange prefixes: OANDA:XAUUSD, FOREXCOM:XAUUSD, FX:XAUUSD
  const colonIdx = s.indexOf(":");
  if (colonIdx > 0 && colonIdx < 12) s = s.slice(colonIdx + 1);
  // Strip common suffixes
  s = s.replace(/[\.\-_]$/g, "");
  return s || null;
}

// ── Action normalization ─────────────────────────────────────
function normalizeAction(raw) {
  if (!raw) return null;
  const a = String(raw).trim().toLowerCase();
  const map = {
    buy: "BUY",
    sell: "SELL",
    close: "CLOSE",
    exit: "CLOSE",
    close_buy: "CLOSE_BUY",
    close_sell: "CLOSE_SELL",
    closebuy: "CLOSE_BUY",
    closesell: "CLOSE_SELL",
  };
  return map[a] || null;
}

function num(v) { return v == null || v === "" ? null : Number(v); }

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const userId = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

    // ── Parse body ──
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    // ── Validate user ID from path ──
    if (!userId || userId.length < 10) {
      return Response.json({ success: false, status: "error", message: "Invalid webhook URL" }, { status: 400 });
    }

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    // ── Load user's TradingViewSettings (service role — webhook is unauthenticated) ──
    const settingsList = await base44.asServiceRole.entities.TradingViewSettings.filter(
      { created_by_id: userId }, "-created_date", 1
    );
    let settings = settingsList?.[0];
    if (!settings) {
      // Auto-provision settings with a random secret
      settings = await base44.asServiceRole.entities.TradingViewSettings.create({
        created_by_id: userId,
        webhook_secret: crypto.randomUUID().replace(/-/g, ""),
        auto_trading_enabled: false,
        trading_mode: "test",
        use_alert_quantity: true,
        fixed_order_size: 0.01,
        max_order_size: 0.1,
        allowed_symbols: "XAUUSD",
        max_open_positions: 3,
        allow_buy: true,
        allow_sell: true,
        allow_close: true,
      });
    }

    // ── Validate webhook secret ──
    if (!body.secret || body.secret !== settings.webhook_secret) {
      return Response.json({ success: false, status: "error", message: "Invalid webhook secret" }, { status: 403 });
    }

    // ── Check auto trading ──
    if (!settings.auto_trading_enabled) {
      return Response.json({ success: false, status: "error", message: "Auto trading is OFF" }, { status: 403 });
    }

    // ── Normalize symbol ──
    const symbol = normalizeSymbol(body.symbol);
    if (!symbol) {
      return Response.json({ success: false, status: "error", message: "Invalid or missing symbol" }, { status: 400 });
    }

    // ── Check allowed symbols ──
    const allowed = (settings.allowed_symbols || "XAUUSD").split(",").map(s => s.trim().toUpperCase());
    if (!allowed.includes(symbol)) {
      return Response.json({ success: false, status: "error", message: `Symbol ${symbol} not allowed` }, { status: 403 });
    }

    // ── Normalize action ──
    const action = normalizeAction(body.action);
    if (!action) {
      return Response.json({ success: false, status: "error", message: `Invalid action: ${body.action}` }, { status: 400 });
    }

    // ── Check action permissions ──
    if (action === "BUY" && !settings.allow_buy) {
      return Response.json({ success: false, status: "error", message: "BUY action not allowed" }, { status: 403 });
    }
    if (action === "SELL" && !settings.allow_sell) {
      return Response.json({ success: false, status: "error", message: "SELL action not allowed" }, { status: 403 });
    }
    if (action.startsWith("CLOSE") && !settings.allow_close) {
      return Response.json({ success: false, status: "error", message: "CLOSE action not allowed" }, { status: 403 });
    }

    // ── Determine quantity ──
    let quantity = num(body.quantity);
    if (settings.use_alert_quantity) {
      if (quantity == null || quantity <= 0) {
        return Response.json({ success: false, status: "error", message: "Invalid or missing quantity" }, { status: 400 });
      }
    } else {
      quantity = settings.fixed_order_size ?? 0.01;
    }

    // ── Check max order size ──
    const maxSize = settings.max_order_size ?? 0.1;
    if (quantity > maxSize) {
      return Response.json({ success: false, status: "error", message: `Quantity ${quantity} exceeds max ${maxSize}` }, { status: 403 });
    }

    const alertId = body.alert_id || `tv-${Date.now()}`;
    const mode = settings.trading_mode || "test";
    const price = num(body.price);
    const positionSize = num(body.position_size || body.strategy_position);

    // ── Dedup: check for existing alert_id ──
    const existing = await base44.asServiceRole.entities.TradingViewSignal.filter(
      { created_by_id: userId, alert_id: alertId }, "-created_date", 1
    );
    if (existing?.length > 0) {
      return Response.json({
        success: false,
        status: "duplicate",
        alert_id: alertId,
        message: "Duplicate alert — already processed",
      });
    }

    // ── Save received signal ──
    const rawPayload = { ...body };
    delete rawPayload.secret; // Never store the secret

    const signal = await base44.asServiceRole.entities.TradingViewSignal.create({
      created_by_id: userId,
      alert_id: alertId,
      symbol,
      action,
      quantity,
      price,
      position_size: positionSize,
      mode,
      status: "Validated",
      message: "Signal validated",
      raw_payload: rawPayload,
      received_at: new Date().toISOString(),
    });

    // ── TEST MODE: simulate, don't call execution API ──
    if (mode === "test") {
      await base44.asServiceRole.entities.TradingViewSignal.update(signal.id, {
        status: "Simulated",
        message: "Test mode — order simulated. No live execution.",
        executed_at: new Date().toISOString(),
      });

      return Response.json({
        success: true,
        status: "simulated",
        alert_id: alertId,
        symbol,
        action,
        quantity,
        message: "Test mode — order simulated successfully",
      });
    }

    // ── LIVE MODE: execute via independent trading API ──
    const execRes = await base44.asServiceRole.functions.invoke("tradingExecute", {
      user_id: userId,
      alert_id: alertId,
      symbol,
      action,
      quantity,
      price,
      mode: "live",
    }).catch((e) => ({ data: { success: false, status: "error", message: e.message } }));

    const exec = execRes?.data || execRes;

    if (exec?.success && exec?.order_id) {
      await base44.asServiceRole.entities.TradingViewSignal.update(signal.id, {
        status: "Executed",
        order_id: exec.order_id,
        message: `Executed — order ID ${exec.order_id}`,
        executed_at: new Date().toISOString(),
      });

      return Response.json({
        success: true,
        status: "executed",
        alert_id: alertId,
        order_id: exec.order_id,
        symbol,
        action,
        quantity,
        message: "Order executed successfully",
      });
    }

    // ── Execution failed ──
    await base44.asServiceRole.entities.TradingViewSignal.update(signal.id, {
      status: "Error",
      message: exec?.message || "Execution API returned an error",
      executed_at: new Date().toISOString(),
    });

    return Response.json({
      success: false,
      status: "error",
      alert_id: alertId,
      message: exec?.message || "Execution API error",
    });
  } catch (err) {
    return Response.json({ success: false, status: "error", message: err.message }, { status: 500 });
  }
});

// ── Helper: ensure settings exist ──
async function ensureSettings(base44, userId) {
  const list = await base44.asServiceRole.entities.TradingViewSettings.filter(
    { created_by_id: userId }, "-created_date", 1
  );
  if (list?.[0]) return list[0];
  return await base44.asServiceRole.entities.TradingViewSettings.create({
    created_by_id: userId,
    webhook_secret: crypto.randomUUID().replace(/-/g, ""),
    auto_trading_enabled: false,
    trading_mode: "test",
    use_alert_quantity: true,
    fixed_order_size: 0.01,
    max_order_size: 0.1,
    allowed_symbols: "XAUUSD",
    max_open_positions: 3,
    allow_buy: true,
    allow_sell: true,
    allow_close: true,
  });
}

// ── Helper: get execution connection ──
async function getExecutionConnection(base44, userId) {
  const list = await base44.asServiceRole.entities.TradingExecutionConnection.filter(
    { created_by_id: userId }, "-created_date", 1
  );
  return list?.[0] || null;
}