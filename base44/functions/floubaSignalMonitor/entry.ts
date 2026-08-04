import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const BASE = (() => {
  let v = (Deno.env.get("FLOUBA_BACKEND_URL") || "").trim().replace(/\/+$/, "");
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  v = v.replace(/\/api$/i, "");
  return v + "/api";
})();

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

    if (!isCron) {
      const isAuth = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuth) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ═══ CRON MODE — monitor all active signals across all users ═══
    if (isCron && !body.user_id) {
      const allSignals = await base44.asServiceRole.entities.FloubaSignal.filter({
        status: { $in: ["WAITING_FOR_ENTRY", "CONFIRMED"] },
      }, "-created_date", 200);

      const allSettings = await base44.asServiceRole.entities.BotSettings.list();
      const configMap = new Map(allSettings.map(s => [s.created_by_id, s]));
      const allUsers = await base44.asServiceRole.entities.User.list();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const results = [];
      for (const signal of allSignals) {
        const config = configMap.get(signal.created_by_id);
        if (!config) continue;
        const user = userMap.get(signal.created_by_id);
        if (!user?.flouba_token) continue;

        try {
          const r = await monitorSignal(base44, signal, config, user);
          if (r) results.push({ signal_id: signal.id, user: signal.created_by_id, ...r });
        } catch (err) {
          results.push({ signal_id: signal.id, user: signal.created_by_id, error: err.message });
        }
      }
      return Response.json({ ok: true, mode: "cron", signalsChecked: results.length, results, checkedAt: new Date().toISOString() });
    }

    // ═══ MANUAL MODE — monitor current user's signals ═══
    let user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    let userId = user.id;
    // Only admins (or cron) may act on behalf of another user
    if (body.user_id && body.user_id !== userId) {
      if (!isCron && user.role !== "admin") {
        return Response.json({ error: "Forbidden: cannot monitor another user's signals" }, { status: 403 });
      }
      const target = await base44.asServiceRole.entities.User.get(body.user_id).catch(() => null);
      if (!target) return Response.json({ error: "Target user not found" }, { status: 404 });
      user = target;
      userId = target.id;
    }

    const settings = await base44.asServiceRole.entities.BotSettings.filter({ created_by_id: userId }, "-created_date", 1);
    const config = settings?.[0];
    if (!config) return Response.json({ error: "No BotSettings found" }, { status: 400 });

    const signals = await base44.asServiceRole.entities.FloubaSignal.filter({
      created_by_id: userId,
      status: { $in: ["WAITING_FOR_ENTRY", "CONFIRMED"] },
    }, "-created_date", 10);

    const results = [];
    for (const signal of signals) {
      const r = await monitorSignal(base44, signal, config, user);
      if (r) results.push({ signal_id: signal.id, ...r });
    }

    return Response.json({ ok: true, mode: "manual", signalsChecked: results.length, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

// ═══ Core: monitor a single signal — check expiration, execute if full_auto ═══
async function monitorSignal(base44, signal, config, user) {
  const now = Date.now();
  const expiry = signal.expiration_time ? new Date(signal.expiration_time).getTime() : 0;

  // 1. Check expiration first
  if (expiry > 0 && now >= expiry) {
    await base44.asServiceRole.entities.FloubaSignal.update(signal.id, {
      status: "EXPIRED",
      expired_at: new Date().toISOString(),
    });
    return { action: "expired", signal_id: signal.id };
  }

  // 2. Only auto-execute in full_auto mode with auto_trading_enabled
  if (signal.execution_mode !== "full_auto") return null;

  // 3. Fetch live quotes
  const authHeaders = buildHeaders(user.flouba_token, config);
  const quotesRes = await fetch(`${BASE}/symbols`, { headers: authHeaders }).catch(() => null);
  if (!quotesRes?.ok) return null;
  const quotesJson = await quotesRes.json().catch(() => ({}));
  const rawSyms = Array.isArray(quotesJson?.symbols) ? quotesJson.symbols : (Array.isArray(quotesJson) ? quotesJson : []);
  const symUpper = (signal.symbol || "").toUpperCase();
  const quote = rawSyms.find(s => {
    const sn = (s.symbol || s.name || "").toUpperCase();
    return sn === symUpper || sn.startsWith(symUpper);
  });
  if (!quote) return null;

  const bid = Number(quote.bid);
  const ask = Number(quote.ask);
  const spread = Math.abs(ask - bid);
  if (isNaN(bid) || isNaN(ask)) return null;

  // 4. Virtual Trigger Mode — check if price reached entry
  if (signal.entry_style === "virtual_trigger") {
    const entry = signal.entry_price;
    let triggered = false;
    if (signal.direction === "BUY") {
      // BUY: execute when ask reaches or breaks above entry
      if (ask >= entry) triggered = true;
    } else {
      // SELL: execute when bid reaches or breaks below entry
      if (bid <= entry) triggered = true;
    }

    if (!triggered) return { action: "waiting", signal_id: signal.id, bid, ask };

    // 5. Pre-execution safety checks
    const saSettings = await base44.asServiceRole.entities.SignalAssistantSettings.filter({ created_by_id: signal.created_by_id }, "-created_date", 1);
    const sa = saSettings?.[0] || {};
    if (sa.auto_trading_enabled === false) return { action: "skipped_auto_off", signal_id: signal.id };

    // Spread check
    const maxSpread = config.stop_loss ? (config.stop_loss * 0.12) : 50;
    if (spread > maxSpread) return { action: "skipped_spread", signal_id: signal.id, spread };

    // Max trades check
    const acctRes = await fetch(`${BASE}/account`, { headers: authHeaders }).catch(() => null);
    const acctJson = acctRes?.ok ? await acctRes.json().catch(() => ({})) : {};
    const openPositions = acctJson?.positions?.length || acctJson?.account?.positions || 0;
    const maxConcurrent = config.max_concurrent_trades ?? 2;
    if (openPositions >= maxConcurrent) return { action: "skipped_max_trades", signal_id: signal.id, open: openPositions };

    // Daily loss check
    const balance = acctJson?.account?.balance || 0;
    const equity = acctJson?.account?.equity || 0;
    const floatingPnl = equity - balance;
    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
    const closedTrades = await base44.asServiceRole.entities.Trade.filter({ created_by_id: signal.created_by_id, status: "Closed" }, "-closed_at", 50);
    const todayLoss = closedTrades.filter(t => t.closed_at && new Date(t.closed_at) >= startOfDay).reduce((s, t) => s + (t.profit ?? 0), 0);
    const dailyPnl = floatingPnl + todayLoss;
    const lossLimit = config.daily_loss_limit ?? 50;
    if (dailyPnl <= -lossLimit) return { action: "skipped_daily_loss", signal_id: signal.id, dailyPnl };

    // 6. Execute the trade
    const { base: baseSym, suffix } = stripSuffix(signal.symbol);
    const tradeAction = signal.direction === "BUY" ? "buy" : "sell";
    const orderBody = {
      symbol: baseSym,
      volume: signal.lot_size,
      sl: signal.stop_loss,
      tp: signal.take_profit,
      magic: signal.magic_number ?? 20260001,
      comment: signal.comment || "Flouba Gold HFT",
    };
    if (suffix) { orderBody.broker_symbol = signal.symbol; orderBody.symbol_suffix = suffix; }

    const tradeRes = await fetch(`${BASE}/trade/${tradeAction}`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(orderBody),
    }).catch(() => null);

    const tradeJson = tradeRes?.ok ? await tradeRes.json().catch(() => ({})) : {};
    const execSuccess = tradeJson?.success === true || tradeRes?.ok;

    if (execSuccess) {
      await base44.asServiceRole.entities.FloubaSignal.update(signal.id, {
        status: "EXECUTED",
        executed_at: new Date().toISOString(),
        ticket_id: tradeJson?.ticket || tradeJson?.order || null,
      });
      // Log to Trade entity
      try {
        await base44.asServiceRole.entities.Trade.create({
          pair: signal.symbol,
          direction: signal.direction === "BUY" ? "Buy" : "Sell",
          lot: signal.lot_size,
          entry_price: signal.entry_price,
          stop_loss: signal.stop_loss,
          take_profit: signal.take_profit,
          status: "Open",
          pattern: signal.strategy_name,
          opened_at: new Date().toISOString(),
          ticket_id: tradeJson?.ticket || tradeJson?.order || String(Date.now()),
        });
      } catch {}
      return { action: "executed", signal_id: signal.id, ticket: tradeJson?.ticket || tradeJson?.order };
    } else {
      return { action: "execution_failed", signal_id: signal.id, error: tradeJson?.message || tradeJson?.error || `HTTP ${tradeRes?.status}` };
    }
  }

  // 7. Broker Pending Order Mode — already placed, just wait for MT5 to fill
  // The pending order is already with the broker; check if it was filled
  return { action: "pending_waiting", signal_id: signal.id };
}