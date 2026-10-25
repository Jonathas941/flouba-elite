import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { postCommand, getAccount } from '../../shared/mt5Bridge.ts';

// ═══════════════════════════════════════════════════════════════
// TradingView Webhook Receiver — 3-Trade Split Execution
// POST /api/functions/tradingViewWebhook
//
// Flow: TradingView alert → webhook → validate → calculate lot from
// balance → split into 3 legs (TP1/TP2/TP3) → execute via Replit
// server → save → display.
//
// The EA trade manager on the VPS handles TP1/TP2 partial closes
// and trailing, so only one TP goes to MT5 per leg.
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

function floorLot(v) { return Math.floor(v * 100) / 100; }

// Map TradingView actions to Replit trade routes
const ROUTE_MAP = {
  BUY: "buy",
  SELL: "sell",
  CLOSE: "close-all",
  CLOSE_BUY: "close",
  CLOSE_SELL: "close",
};

export default async function(req) {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const base44 = createClientFromRequest(req);

    // ── Look up settings by webhook secret ──
    // Accepted in the JSON body ("secret") or in the webhook URL (?secret=...),
    // so a TradingView alert can carry it without changing the Pine script.
    let urlSecret = null;
    try { urlSecret = new URL(req.url).searchParams.get("secret"); } catch {}
    const secret = body.secret || urlSecret;
    if (!secret || secret.length < 8) {
      return Response.json({ success: false, status: "error", message: "Invalid or missing webhook secret" }, { status: 403 });
    }

    const settingsPage = await base44.asServiceRole.entities.TradingViewSettings.filter(
      { webhook_secret: secret }, { sort: "-created_date", limit: 1 }
    );
    const settings = settingsPage?.items?.[0] || settingsPage?.[0];
    if (!settings) {
      console.warn("[tradingViewWebhook] rejected: no TradingViewSettings matches the supplied webhook secret");
      return Response.json({ success: false, status: "error", message: "Invalid webhook secret" }, { status: 403 });
    }

    const userId = settings.created_by_id;

    // ── Parse fields ──
    const alertId = body.alert_id || `tv-${Date.now()}`;
    const mode = body.test === true ? "test" : (settings.trading_mode || "test");
    const price = num(body.price);
    const positionSize = num(body.position_size || body.strategy_position);
    const sl = num(body.sl);
    const tp1 = num(body.tp1);
    const tp2 = num(body.tp2);
    const tp3 = num(body.tp3);
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
        sl, tp1, tp2, tp3,
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
      return await reject(`Invalid or missing symbol: ${body.symbol}`, 400);
    }

    // ── Check allowed symbols ──
    const allowed = (settings.allowed_symbols || "XAUUSD").split(",").map(s => s.trim().toUpperCase());
    if (!allowed.includes(symbol)) {
      return await reject(`Symbol ${symbol} not in allowed list (${allowed.join(", ")})`, 403);
    }

    // ── Normalize action ──
    const action = normalizeAction(body.action);
    if (!action) {
      return await reject(`Invalid action: ${body.action}`, 400);
    }

    // ── Check action permissions ──
    if (action === "BUY" && !settings.allow_buy) {
      return await reject("BUY action not allowed", 403);
    }
    if (action === "SELL" && !settings.allow_sell) {
      return await reject("SELL action not allowed", 403);
    }
    if (action.startsWith("CLOSE") && !settings.allow_close) {
      return await reject("CLOSE action not allowed", 403);
    }

    // ── Dedup by alert_id ──
    const existingPage = await base44.asServiceRole.entities.TradingViewSignal.filter(
      { created_by_id: userId, alert_id: alertId }, { sort: "-created_date", limit: 1 }
    );
    const existing = existingPage?.items?.[0] || existingPage?.[0];
    if (existing) {
      return Response.json({
        success: false,
        status: "duplicate",
        alert_id: alertId,
        message: "Duplicate alert — already processed",
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // CLOSE actions — no lot calculation needed
    // ═══════════════════════════════════════════════════════════════
    if (action === "CLOSE" || action === "CLOSE_BUY" || action === "CLOSE_SELL") {
      const rawPayload = { ...body };
      delete rawPayload.secret;

      const signal = await base44.asServiceRole.entities.TradingViewSignal.create({
        created_by_id: userId,
        alert_id: alertId,
        symbol,
        action,
        quantity: num(body.quantity),
        price,
        position_size: positionSize,
        sl, tp1, tp2, tp3,
        mode,
        status: "Validated",
        message: "Close signal validated",
        raw_payload: rawPayload,
        received_at: new Date().toISOString(),
      });

      if (mode === "test") {
        await base44.asServiceRole.entities.TradingViewSignal.update(signal.id, {
          status: "Simulated",
          message: "Test mode — close simulated.",
          executed_at: new Date().toISOString(),
        });
        return Response.json({ success: true, status: "simulated", alert_id: alertId, message: "Test mode — close simulated" });
      }

      // Execute close via Replit
      const route = ROUTE_MAP[action];
      const execRes = await postCommand("", { action: route === "close-all" ? "close_all" : "close", symbol }, `tv-close-${alertId}`);

      if (execRes.ok) {
        const orderId = execRes?.data?.commandId || execRes?.data?.id || `tv-close-${alertId}`;
        await base44.asServiceRole.entities.TradingViewSignal.update(signal.id, {
          status: "Executed",
          order_id: String(orderId),
          message: `Close executed — ${action}`,
          executed_at: new Date().toISOString(),
        });
        await base44.asServiceRole.entities.Notification.create({
          created_by_id: userId,
          type: "trade", title: "Position Closed (TV Signal)",
          message: `${action} ${symbol}`,
          category: "info", read: false,
          meta: { source: "tradingview_webhook", alert_id: alertId, symbol, action },
        }).catch(() => {});
        return Response.json({ success: true, status: "executed", alert_id: alertId, order_id: String(orderId), message: "Close executed" });
      }

      await base44.asServiceRole.entities.TradingViewSignal.update(signal.id, {
        status: "Error",
        message: `Close failed: ${execRes.error}`,
        executed_at: new Date().toISOString(),
      });
      return Response.json({ success: false, status: "error", alert_id: alertId, message: `Close failed: ${execRes.error}` });
    }

    // ═══════════════════════════════════════════════════════════════
    // BUY / SELL — 3-trade split execution
    // ═══════════════════════════════════════════════════════════════

    // ── Validate SL and TP fields ──
    if (sl == null) return await reject("Missing 'sl' (stop loss) in alert JSON", 400);
    if (tp1 == null) return await reject("Missing 'tp1' in alert JSON", 400);
    if (tp2 == null) return await reject("Missing 'tp2' in alert JSON", 400);
    if (tp3 == null) return await reject("Missing 'tp3' in alert JSON", 400);

    // ── Validate SL/TP are on the correct side of entry ──
    // BUY:  sl < entry < tp1 < tp2 < tp3
    // SELL: sl > entry > tp1 > tp2 > tp3
    const entry = price ?? positionSize;
    if (entry == null) return await reject("Missing 'price' (entry) in alert JSON", 400);

    if (action === "BUY") {
      if (!(sl < entry && entry < tp1 && tp1 < tp2 && tp2 < tp3)) {
        return await reject(`Invalid SL/TP order for BUY: need sl < entry < tp1 < tp2 < tp3. Got sl=${sl}, entry=${entry}, tp1=${tp1}, tp2=${tp2}, tp3=${tp3}`, 400);
      }
    } else {
      if (!(sl > entry && entry > tp1 && tp1 > tp2 && tp2 > tp3)) {
        return await reject(`Invalid SL/TP order for SELL: need sl > entry > tp1 > tp2 > tp3. Got sl=${sl}, entry=${entry}, tp1=${tp1}, tp2=${tp2}, tp3=${tp3}`, 400);
      }
    }

    // ── Load BotSettings for lot calculation ──
    const botPage = await base44.asServiceRole.entities.BotSettings.filter(
      { created_by_id: userId }, { sort: "-created_date", limit: 1 }
    ).catch(() => ({}));
    const bot = botPage?.items?.[0] || botPage?.[0] || {};
    const robotId = String(bot.mt5_account || "");

    if (!robotId && mode === "live") {
      return await reject("No MT5 account linked — cannot execute live trade", 403);
    }

    const riskPercent = bot.tv_risk_percent ?? 1.0;
    const maxTotalLot = bot.tv_max_total_lot ?? 1.0;
    const contractSize = bot.tv_contract_size ?? 100;
    const tpSplit1 = bot.tv_tp_split_1 ?? 40;
    const tpSplit2 = bot.tv_tp_split_2 ?? 30;
    const tpSplit3 = bot.tv_tp_split_3 ?? 30;
    const maxOpenGroups = bot.tv_max_open_signal_groups ?? 1;

    // ── Get live balance from Replit server ──
    const acctRes = await getAccount(robotId);
    const balance = acctRes?.balance;
    if (!acctRes?.ok || balance == null || balance <= 0) {
      return await reject(`Cannot get live account balance: ${acctRes?.error || "balance unavailable"}`, 503);
    }

    // ── Calculate total_lot ──
    const slDistance = Math.abs(entry - sl);
    if (slDistance <= 0) return await reject("SL distance is zero — cannot calculate lot size", 400);

    const riskAmount = balance * (riskPercent / 100);
    let totalLot = riskAmount / (slDistance * contractSize);
    totalLot = Math.floor(totalLot * 100) / 100; // round DOWN to 0.01
    if (totalLot > maxTotalLot) totalLot = maxTotalLot;
    if (totalLot < 0.01) totalLot = 0.01; // minimum, but see small-account logic below

    // ── Split into 3 legs ──
    let leg1Lot = Math.floor((totalLot * tpSplit1 / 100) * 100) / 100;
    let leg2Lot = Math.floor((totalLot * tpSplit2 / 100) * 100) / 100;
    let leg3Lot = Math.floor((totalLot * tpSplit3 / 100) * 100) / 100;

    // ── Small account: only open legs that reach 0.01 ──
    const legs = [
      { lot: leg1Lot, tp: tp1, label: "TP1" },
      { lot: leg2Lot, tp: tp2, label: "TP2" },
      { lot: leg3Lot, tp: tp3, label: "TP3" },
    ].filter(l => l.lot >= 0.01);

    // If no legs reach 0.01, try opening ONE trade of 0.01 with tp = tp2
    if (legs.length === 0) {
      // Check if real risk with 0.01 lot is within risk_percent × 1.5
      const realRisk = 0.01 * slDistance * contractSize;
      if (realRisk <= riskAmount * 1.5) {
        legs.length = 0;
        legs.push({ lot: 0.01, tp: tp2, label: "TP2" });
      } else {
        return await reject(
          `lot below minimum — calculated total_lot ${totalLot.toFixed(2)} would risk $${realRisk.toFixed(2)} (limit $${(riskAmount * 1.5).toFixed(2)})`,
          400
        );
      }
    }

    // ── Check max open signal groups ──
    const openSignalsPage = await base44.asServiceRole.entities.TradingViewSignal.filter(
      { created_by_id: userId, status: { $in: ["Executed", "Partial"] } }, { sort: "-created_date", limit: 50 }
    ).catch(() => ({}));
    const openSignals = openSignalsPage?.items || openSignalsPage || [];

    // Count distinct alert_ids that have executed legs (each alert = 1 group)
    const openGroups = new Set();
    for (const s of openSignals) {
      const sLegs = s.legs;
      if (Array.isArray(sLegs) && sLegs.some(l => l.status === "opened")) {
        openGroups.add(s.alert_id);
      }
    }
    if (openGroups.size >= maxOpenGroups) {
      return await reject(
        `Max ${maxOpenGroups} open signal group(s) reached — ${openGroups.size} currently active`,
        403
      );
    }

    // ── Save validated signal ──
    const rawPayload = { ...body };
    delete rawPayload.secret;

    const signal = await base44.asServiceRole.entities.TradingViewSignal.create({
      created_by_id: userId,
      alert_id: alertId,
      symbol,
      action,
      quantity: num(body.quantity),
      price,
      position_size: positionSize,
      sl, tp1, tp2, tp3,
      total_lot: totalLot,
      mode,
      status: "Validated",
      message: `Validated — ${legs.length} leg(s), total ${legs.reduce((s, l) => s + l.lot, 0).toFixed(2)} lot`,
      raw_payload: rawPayload,
      received_at: new Date().toISOString(),
    });

    // ── TEST MODE: simulate ──
    if (mode === "test") {
      const simLegs = legs.map(l => ({ ...l, status: "simulated", order_id: null, error: null }));
      await base44.asServiceRole.entities.TradingViewSignal.update(signal.id, {
        status: "Simulated",
        legs: simLegs,
        message: `Test mode — ${simLegs.length} leg(s) simulated. Balance $${balance.toFixed(2)}, total_lot ${totalLot.toFixed(2)}.`,
        executed_at: new Date().toISOString(),
      });
      return Response.json({
        success: true,
        status: "simulated",
        alert_id: alertId,
        symbol, action,
        total_lot: totalLot,
        legs: simLegs,
        balance,
        message: "Test mode — order simulated",
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // LIVE MODE — Execute 3 legs via Replit server
    // ═══════════════════════════════════════════════════════════════
    const route = ROUTE_MAP[action]; // "buy" or "sell"
    const shortId = alertId.slice(-8);
    const executedLegs = [];
    let anyFailed = false;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const comment = `FGS|${shortId}|${leg.label}`.slice(0, 31);
      const idemKey = `tv-${route}-${robotId}-${symbol}-${alertId}-${leg.label}`;

      const command = {
        action: route,
        symbol,
        lot: leg.lot,
        sl: sl != null ? Number(sl) : undefined,
        tp: leg.tp != null ? Number(leg.tp) : undefined,
        comment,
      };

      const execRes = await postCommand(robotId, command, idemKey);

      if (execRes.ok) {
        const orderId = execRes?.data?.commandId || execRes?.data?.id || idemKey;
        executedLegs.push({ ...leg, status: "opened", order_id: String(orderId), error: null });
      } else {
        executedLegs.push({ ...leg, status: "failed", order_id: null, error: execRes.error || "Unknown error" });
        anyFailed = true;
      }
    }

    // ── Update signal record ──
    const openedCount = executedLegs.filter(l => l.status === "opened").length;
    const failedCount = executedLegs.filter(l => l.status === "failed").length;
    const finalStatus = openedCount === 0 ? "Error" : (failedCount > 0 ? "Partial" : "Executed");

    await base44.asServiceRole.entities.TradingViewSignal.update(signal.id, {
      status: finalStatus,
      legs: executedLegs,
      message: `${openedCount}/${executedLegs.length} leg(s) opened${failedCount > 0 ? ` — ${failedCount} failed` : ""}`,
      executed_at: new Date().toISOString(),
    });

    // ── Notification ──
    const notifCategory = openedCount === 0 ? "danger" : (failedCount > 0 ? "warning" : "success");
    const notifTitle = openedCount === 0
      ? "Trade Failed (TV Signal)"
      : failedCount > 0
        ? "Partial Execution (TV Signal)"
        : "Trade Executed (TV Signal)";

    const legSummary = executedLegs.map(l =>
      `${l.label}: ${l.lot} lot ${l.status}${l.error ? ` (${l.error})` : ""}`
    ).join(" | ");

    await base44.asServiceRole.entities.Notification.create({
      created_by_id: userId,
      type: "trade",
      title: notifTitle,
      message: `${action} ${symbol} • ${legSummary}`,
      category: notifCategory,
      read: false,
      meta: {
        source: "tradingview_webhook",
        alert_id: alertId,
        symbol, action,
        total_lot: totalLot,
        legs: executedLegs,
      },
    }).catch(() => {});

    return Response.json({
      success: openedCount > 0,
      status: finalStatus.toLowerCase(),
      alert_id: alertId,
      symbol, action,
      total_lot: totalLot,
      legs: executedLegs,
      balance,
      message: `${openedCount}/${executedLegs.length} leg(s) opened successfully`,
    });
  } catch (err) {
    return Response.json({ success: false, status: "error", message: err.message }, { status: 500 });
  }
}