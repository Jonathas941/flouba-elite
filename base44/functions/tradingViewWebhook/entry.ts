import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// ── TradingView Webhook Receiver ────────────────────────────────────────────
// Accepts POST requests from TradingView alerts. Authenticates via per-user
// webhook_secret stored in TradingViewSettings. Validates risk rules, normalizes
// symbols/actions, deduplicates by alert_id, and executes trades through the
// existing Flouba Elite MT5 bridge (same command-queue as the rest of the app).

import { BRIDGE, B44, bridgeHeaders, postCommand } from "../../shared/mt5Bridge.ts";

// ── Normalize TradingView symbol ── remove exchange prefix (OANDA:, FX:, etc.)
function normalizeSymbol(raw) {
  if (!raw || typeof raw !== "string") return "";
  let s = raw.trim().toUpperCase();
  // Strip exchange prefix: "OANDA:XAUUSD" → "XAUUSD", "FX:EURUSD" → "EURUSD"
  const colonIdx = s.indexOf(":");
  if (colonIdx > 0 && colonIdx < 12) s = s.slice(colonIdx + 1);
  // Remove common broker suffixes (m, s, .r, etc.) — bridge handles base symbol
  s = s.replace(/\.R$/i, "").replace(/[MS]$/i, "");
  return s;
}

// ── Normalize action ──
function normalizeAction(raw, strategyPosition, message) {
  if (!raw) return null;
  let a = String(raw).trim().toLowerCase();

  // Check message for implicit commands
  const msg = (message || "").toLowerCase();
  if (msg.includes("order buy") || msg.includes("order:buy")) a = "buy";
  else if (msg.includes("order sell") || msg.includes("order:sell")) a = "sell";
  else if (msg.includes("exit") || msg.includes("position is 0")) a = "close";
  else if (msg.includes("close")) a = "close";

  // strategy_position 0 after an open position = exit, not new entry
  if (strategyPosition != null && Number(strategyPosition) === 0 && (a === "buy" || a === "sell")) {
    // Only treat as close if the message explicitly says exit/close
    if (msg.includes("exit") || msg.includes("close") || msg.includes("position is 0")) {
      a = "close";
    }
  }

  switch (a) {
    case "buy": case "long": return "BUY";
    case "sell": case "short": return "SELL";
    case "close": case "exit": case "flatten": return "CLOSE";
    case "close_buy": case "closebuy": return "CLOSE_BUY";
    case "close_sell": case "closesell": return "CLOSE_SELL";
    default: return null;
  }
}

// ── Generate a unique webhook secret per user ──
function generateSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "tv_" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  try {
    // ── Extract userId from path: .../tradingViewWebhook/USER_ID ──
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const pathUserId = pathParts[pathParts.length - 1] || null;

    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const isTest = body.__test === true;
    const userId = pathUserId || body.__user_id || null;

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    // ── For test calls from the frontend, authenticate via session ──
    if (isTest) {
      const me = await base44.auth.me().catch(() => null);
      if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
      return await handleTestAlert(base44, me.id);
    }

    if (!userId) {
      return Response.json({ error: "Missing user ID in webhook path" }, { status: 400 });
    }

    // ── Load user's TradingViewSettings ──
    const settingsList = await base44.asServiceRole.entities.TradingViewSettings.filter(
      { created_by_id: userId }, "-created_date", 1
    ).catch(() => []);
    let tvSettings = settingsList?.[0];

    // Auto-create settings with a new secret if none exist
    if (!tvSettings) {
      tvSettings = await base44.asServiceRole.entities.TradingViewSettings.create({
        created_by_id: userId,
        webhook_secret: generateSecret(),
        auto_trading_enabled: false,
        trading_mode: "test",
      });
    }

    // ── Validate webhook secret ──
    const providedSecret = body.secret;
    if (!providedSecret || providedSecret !== tvSettings.webhook_secret) {
      return Response.json({ error: "Invalid or missing webhook secret" }, { status: 401 });
    }

    // ── Check auto_trading_enabled ──
    if (!tvSettings.auto_trading_enabled) {
      return Response.json({ error: "Auto trading is disabled" }, { status: 403 });
    }

    return await processAlert(base44, userId, tvSettings, body);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

// ═══ Test alert handler — simulates an XAUUSD BUY without executing ─══
async function handleTestAlert(base44, userId) {
  const settingsList = await base44.asServiceRole.entities.TradingViewSettings.filter(
    { created_by_id: userId }, "-created_date", 1
  ).catch(() => []);
  let tvSettings = settingsList?.[0];
  if (!tvSettings) {
    tvSettings = await base44.asServiceRole.entities.TradingViewSettings.create({
      created_by_id: userId,
      webhook_secret: generateSecret(),
      auto_trading_enabled: false,
      trading_mode: "test",
    });
  }

  const testBody = {
    alert_id: `test-${Date.now()}`,
    symbol: "XAUUSD",
    action: "buy",
    quantity: 0.01,
    price: 0,
    strategy_position: 0.01,
    timestamp: new Date().toISOString(),
  };

  const result = await processAlert(base44, userId, tvSettings, testBody, true);
  return Response.json(result);
}

// ═══ Core: process a TradingView alert ─══
async function processAlert(base44, userId, tvSettings, body, isTest = false) {
  const alertId = body.alert_id || `${body.symbol || "unknown"}-${body.timestamp || Date.now()}`;
  const rawSymbol = body.symbol || "";
  const symbol = normalizeSymbol(rawSymbol);
  const action = normalizeAction(body.action, body.strategy_position, body.message);

  // ── Dedup: check if alert_id already processed ──
  const existing = await base44.asServiceRole.entities.TradingViewAlert.filter(
    { created_by_id: userId, alert_id: alertId }, "-created_date", 1
  ).catch(() => []);

  if (existing?.length > 0) {
    const dup = existing[0];
    return {
      success: false,
      status: "duplicate",
      alert_id: alertId,
      message: `Duplicate alert — already processed as ${dup.status}`,
    };
  }

  // ── Save the alert as Received ──
  const sanitizedPayload = { ...body };
  delete sanitizedPayload.secret; // never store the secret

  const alertRecord = {
    alert_id: alertId,
    symbol,
    action: action || "UNKNOWN",
    requested_quantity: Number(body.quantity) || null,
    price: Number(body.price) || null,
    stop_loss: Number(body.stop_loss) || null,
    take_profit: Number(body.take_profit) || null,
    strategy_position: body.strategy_position != null ? Number(body.strategy_position) : null,
    mode: tvSettings.trading_mode || "test",
    status: "Received",
    raw_payload: sanitizedPayload,
  };

  const saved = await base44.asServiceRole.entities.TradingViewAlert.create(alertRecord);

  // ── Validate action ──
  if (!action) {
    await updateAlert(base44, saved.id, "Rejected", "Unknown or invalid action");
    return { success: false, status: "rejected", alert_id: alertId, message: "Unknown or invalid action" };
  }

  // ── Validate symbol is in allowed list ──
  const allowedSymbols = (tvSettings.allowed_symbols || "XAUUSD")
    .split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!allowedSymbols.includes(symbol)) {
    await updateAlert(base44, saved.id, "Rejected", `Symbol ${symbol} not in allowed list: ${allowedSymbols.join(", ")}`);
    return { success: false, status: "rejected", alert_id: alertId, message: `Symbol ${symbol} not allowed` };
  }

  // ── Determine lot size ──
  let lotSize;
  if (tvSettings.lot_size_mode === "fixed") {
    lotSize = Number(tvSettings.fixed_lot_size) || 0.01;
  } else {
    lotSize = Number(body.quantity) || 0.01;
  }

  // ── Validate lot size ──
  if (lotSize <= 0) {
    await updateAlert(base44, saved.id, "Rejected", "Invalid quantity");
    return { success: false, status: "rejected", alert_id: alertId, message: "Invalid quantity" };
  }
  const maxLot = Number(tvSettings.max_lot_size) || 0.1;
  if (lotSize > maxLot) {
    await updateAlert(base44, saved.id, "Rejected", `Quantity ${lotSize} exceeds max lot ${maxLot}`);
    return { success: false, status: "rejected", alert_id: alertId, message: `Quantity exceeds max lot size` };
  }

  // ── SL/TP required checks ──
  if (tvSettings.stop_loss_required && !body.stop_loss) {
    await updateAlert(base44, saved.id, "Rejected", "Stop loss required but not provided");
    return { success: false, status: "rejected", alert_id: alertId, message: "Stop loss required" };
  }
  if (tvSettings.take_profit_required && !body.take_profit) {
    await updateAlert(base44, saved.id, "Rejected", "Take profit required but not provided");
    return { success: false, status: "rejected", alert_id: alertId, message: "Take profit required" };
  }

  // ── Test mode: don't execute ──
  if (tvSettings.trading_mode === "test" || isTest) {
    await updateAlert(base44, saved.id, "Executed", "Test mode — no trade sent to MT5", lotSize, "TEST");
    return {
      success: true,
      status: "executed",
      alert_id: alertId,
      ticket: "TEST",
      message: "Test mode — alert received and validated. No trade sent to MT5.",
    };
  }

  // ── Live mode: check MT5 connection ──
  const botSettingsList = await base44.asServiceRole.entities.BotSettings.filter(
    { created_by_id: userId }, "-created_date", 1
  ).catch(() => []);
  const cfg = botSettingsList?.[0];
  const robotId = String(cfg?.mt5_account || "");
  if (!robotId) {
    await updateAlert(base44, saved.id, "Error", "MT5 account not connected");
    return { success: false, status: "error", alert_id: alertId, message: "MT5 account not connected" };
  }

  // ── Check max open trades ──
  const maxOpen = Number(tvSettings.max_open_trades) || 3;
  const openTradesList = await base44.asServiceRole.entities.Trade.filter(
    { created_by_id: userId, status: "Open" }, "-created_date", 100
  ).catch(() => []);
  if ((openTradesList?.length || 0) >= maxOpen && (action === "BUY" || action === "SELL")) {
    await updateAlert(base44, saved.id, "Rejected", `Max open trades (${maxOpen}) reached`);
    return { success: false, status: "rejected", alert_id: alertId, message: `Max open trades reached` };
  }

  // ── Execute via the Flouba Elite MT5 bridge ──
  let commandType;
  if (action === "BUY") commandType = "OPEN_BUY";
  else if (action === "SELL") commandType = "OPEN_SELL";
  else if (action === "CLOSE") commandType = "CLOSE_ALL";
  else if (action === "CLOSE_BUY") commandType = "CLOSE_BUY";
  else if (action === "CLOSE_SELL") commandType = "CLOSE_SELL";
  else {
    await updateAlert(base44, saved.id, "Rejected", `Unsupported action: ${action}`);
    return { success: false, status: "rejected", alert_id: alertId, message: `Unsupported action` };
  }

  const command = {
    commandType,
    direction: action,
    symbol,
    lotSize: lotSize,
    ...(body.stop_loss ? { stopLoss: Number(body.stop_loss) } : {}),
    ...(body.take_profit ? { takeProfit: Number(body.take_profit) } : {}),
    comment: "Flouba TradingView",
  };

  const idemKey = `${commandType}-${robotId}-${symbol}-${alertId}`;
  const execRes = await postCommand(robotId, command, idemKey);

  if (execRes.ok) {
    const ticket = execRes.data?.commandId || execRes.data?.id || String(Date.now());
    await updateAlert(base44, saved.id, "Executed", "Trade executed successfully", lotSize, ticket);
    return {
      success: true,
      status: "executed",
      alert_id: alertId,
      ticket,
      message: "Trade executed successfully",
    };
  } else {
    await updateAlert(base44, saved.id, "Error", execRes.error || "Execution failed");
    return {
      success: false,
      status: "error",
      alert_id: alertId,
      message: execRes.error || "Execution failed",
    };
  }
}

async function updateAlert(base44, alertId, status, message, executedQty, ticket) {
  const update = { status, message };
  if (executedQty != null) update.executed_quantity = executedQty;
  if (ticket != null) update.mt5_ticket = ticket;
  await base44.asServiceRole.entities.TradingViewAlert.update(alertId, update).catch(() => {});
}