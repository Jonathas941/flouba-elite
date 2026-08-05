import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { postCommand } from '../../shared/mt5Bridge.ts';

// ═══════════════════════════════════════════════════════════════
// TradingView Webhook Receiver — Hybrid Auto Execution
// POST /api/functions/tradingViewWebhook
//
// Flow: TradingView alert → webhook → validate → execute via
// MT5 robot bridge OR broker API (OANDA/cTrader) → save → display.
//
// execution_target:
//   auto       → MT5 robot if BotSettings.mt5_account set, else broker API
//   mt5_robot  → force MT5 bridge (Flouba Lite command queue)
//   broker_api → force OANDA/cTrader via tradingExecute
// ═══════════════════════════════════════════════════════════════

function normalizeSymbol(raw) {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim().toUpperCase();
  const colonIdx = s.indexOf(":");
  if (colonIdx > 0 && colonIdx < 12) s = s.slice(colonIdx + 1);
  s = s.replace(/[\.\-_]$/g, "");
  return s || null;
}

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

// Map TradingView actions to MT5 bridge command types
const MT5_COMMAND_MAP = {
  BUY: "OPEN_BUY",
  SELL: "OPEN_SELL",
  CLOSE: "CLOSE_ALL",
  CLOSE_BUY: "CLOSE_BUY",
  CLOSE_SELL: "CLOSE_SELL",
};

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    // ── Look up settings by webhook secret ──
    const secret = body.secret;
    if (!secret || secret.length < 8) {
      return Response.json({ success: false, status: "error", message: "Invalid or missing webhook secret" }, { status: 403 });
    }

    const settingsList = await base44.asServiceRole.entities.TradingViewSettings.filter(
      { webhook_secret: secret }, "-created_date", 1
    );
    let settings = settingsList?.[0];
    if (!settings) {
      // Cannot attribute this to a user, so nothing can be persisted. Log it so a
      // mismatched secret is at least visible in function logs rather than silent.
      console.warn("[tradingViewWebhook] rejected: no TradingViewSettings matches the supplied webhook secret");
      return Response.json({ success: false, status: "error", message: "Invalid webhook secret" }, { status: 403 });
    }

    const userId = settings.created_by_id;

    // Identify the alert up front so REJECTIONS can be persisted too. Previously every
    // validation failure returned before any TradingViewSignal row was written, so a
    // misconfigured alert produced zero records and left nothing to debug.
    const alertId = body.alert_id || `tv-${Date.now()}`;
    const mode = settings.trading_mode || "test";
    const price = num(body.price);
    const positionSize = num(body.position_size || body.strategy_position);
    const rawPayloadBase = { ...body };
    delete rawPayloadBase.secret;

    // Persist a Rejected row, then return the error response.
    const reject = async (message, status = 400, extra = {}) => {
      await base44.asServiceRole.entities.TradingViewSignal.create({
        created_by_id: userId,
        alert_id: alertId,
        symbol: normalizeSymbol(body.symbol) || String(body.symbol || "UNKNOWN").slice(0, 32),
        action: normalizeAction(body.action) || "BUY",
        quantity: num(body.quantity),
        price,
        position_size: positionSize,
        mode,
        status: "Rejected",
        message,
        raw_payload: rawPayloadBase,
        received_at: new Date().toISOString(),
        ...extra,
      }).catch(() => {});
      console.warn("[tradingViewWebhook] rejected", { alert_id: alertId, message });
      return Response.json({ success: false, status: "error", alert_id: alertId, message }, { status });
    };

    // ── Check auto trading ──
    if (!settings.auto_trading_enabled) {
      return await reject("Auto trading is OFF for the settings row matching this webhook secret", 403);
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
    delete rawPayload.secret;

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

    // ── TEST MODE: simulate, don't execute ──
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

    // ═══════════════════════════════════════════════════════════════
    // LIVE MODE — Hybrid Auto Execution
    // ═══════════════════════════════════════════════════════════════
    const execTarget = settings.execution_target || "auto";

    // ── Check if MT5 robot is available ──
    let hasMt5 = false;
    let botSettings = null;
    if (execTarget === "auto" || execTarget === "mt5_robot") {
      // Service role bypasses RLS, so find BotSettings by app_id since
      // TradingViewSettings may have been auto-created by the service role.
      const botList = await base44.asServiceRole.entities.BotSettings.filter(
        { app_id: settings.app_id }, "-created_date", 10
      ).catch(() => []);
      botSettings = botList?.find(b => b.mt5_account) || botList?.[0];
      if (botSettings?.mt5_account) {
        hasMt5 = true;
      }
    }

    // ── Route execution ──
    const useMt5 = (execTarget === "mt5_robot") || (execTarget === "auto" && hasMt5);

    if (useMt5 && hasMt5) {
      // ═══════════════════════════════════════════════════════════════
      // MT5 Robot Bridge Execution (Flouba Lite command queue)
      // ═══════════════════════════════════════════════════════════════
      const robotId = String(botSettings.mt5_account);
      const commandType = MT5_COMMAND_MAP[action];
      if (!commandType) {
        await base44.asServiceRole.entities.TradingViewSignal.update(signal.id, {
          status: "Rejected",
          message: `Unsupported action for MT5: ${action}`,
          executed_at: new Date().toISOString(),
        });
        return Response.json({ success: false, status: "error", alert_id: alertId, message: `Unsupported action for MT5: ${action}` });
      }

      const command = {
        commandType,
        direction: action,
        symbol,
        lotSize: Number(quantity),
      };

      const idemKey = `tv-${commandType}-${robotId}-${symbol}-${alertId}`;
      const execRes = await postCommand(robotId, command, idemKey);

      if (execRes.ok) {
        const orderId = execRes?.data?.commandId || execRes?.data?.id || idemKey;
        await base44.asServiceRole.entities.TradingViewSignal.update(signal.id, {
          status: "Executed",
          order_id: String(orderId),
          message: `MT5 robot executed — command ${commandType} queued for robot ${robotId}`,
          executed_at: new Date().toISOString(),
        });

        // ── Send notification ──
        await base44.asServiceRole.entities.Notification.create({
          created_by_id: userId,
          type: "trade",
          title: "Trade Executed (MT5 Robot)",
          message: `${action} ${symbol} • ${quantity} lot • Robot ${robotId}`,
          category: "success",
          read: false,
          meta: {
            source: "tradingview_webhook",
            execution_path: "mt5_robot",
            alert_id: alertId,
            order_id: String(orderId),
            symbol,
            action,
            quantity,
          },
        }).catch(() => {});

        return Response.json({
          success: true,
          status: "executed",
          alert_id: alertId,
          order_id: String(orderId),
          execution_path: "mt5_robot",
          symbol,
          action,
          quantity,
          message: "MT5 robot executed the order successfully",
        });
      }

      // ── MT5 execution failed ──
      await base44.asServiceRole.entities.TradingViewSignal.update(signal.id, {
        status: "Error",
        message: `MT5 bridge error: ${execRes.error}`,
        executed_at: new Date().toISOString(),
      });

      return Response.json({
        success: false,
        status: "error",
        alert_id: alertId,
        execution_path: "mt5_robot",
        message: `MT5 bridge error: ${execRes.error}`,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // Broker API Execution (OANDA / cTrader via tradingExecute)
    // ═══════════════════════════════════════════════════════════════
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
        message: `Broker API executed — order ID ${exec.order_id}`,
        executed_at: new Date().toISOString(),
      });

      await base44.asServiceRole.entities.Notification.create({
        created_by_id: userId,
        type: "trade",
        title: "Trade Executed (Broker API)",
        message: `${action} ${symbol} • ${quantity} lot • Order ${exec.order_id}`,
        category: "success",
        read: false,
        meta: {
          source: "tradingview_webhook",
          execution_path: "broker_api",
          alert_id: alertId,
          order_id: exec.order_id,
          symbol,
          action,
          quantity,
        },
      }).catch(() => {});

      return Response.json({
        success: true,
        status: "executed",
        alert_id: alertId,
        order_id: exec.order_id,
        execution_path: "broker_api",
        symbol,
        action,
        quantity,
        message: "Order executed successfully via broker API",
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