import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://dazzling-perception-production-8e53.up.railway.app/api";

function num(v) { return typeof v === "number" ? v : (v == null ? null : Number(v)); }

function buildHeaders(token, config) {
  const h = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  if (config.mt5_account) h["X-MT5-Login"] = String(config.mt5_account);
  if (config.mt5_password) h["X-MT5-Password"] = config.mt5_password;
  if (config.mt5_server) h["X-MT5-Server"] = config.mt5_server;
  return h;
}

async function resolveBridgeToken(base44, user, cfg, useServiceRole) {
  let bridgeToken = user?.flouba_token;
  let apiKey = user?.mt5_api_key;

  if (!bridgeToken && !apiKey) {
    const provisionSecret = Deno.env.get("PROVISION_SECRET");
    if (!provisionSecret) return null;
    const provisionRes = await fetch(`${BASE}/provision/user`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${provisionSecret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ base44_user_id: user.id, email: user.email, name: user.full_name || user.email }),
    });
    const pj = await provisionRes.json().catch(() => ({}));
    if (!pj?.success || !pj?.api_key) return null;
    apiKey = pj.api_key;
    bridgeToken = pj.user_token || null;
    const upd = { mt5_api_key: apiKey };
    if (pj.user_token) upd.flouba_token = pj.user_token;
    if (pj.ea_download_url) upd.ea_download_url = pj.ea_download_url;
    if (useServiceRole) await base44.asServiceRole.entities.User.update(user.id, upd);
    else await base44.auth.updateMe(upd);
  }
  if (!bridgeToken && apiKey) {
    const tr = await fetch(`${BASE}/auth/token`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    });
    const tj = await tr.json().catch(() => ({}));
    bridgeToken = tj?.token || null;
  }
  return bridgeToken;
}

// ── HFT execution for a single user ──
// Ignores ALL 8 pillars. Closes any open position in profit (any amount).
// Escalates lot after each profitable close. Resets on loss. Opens new scalp immediately.
async function processHftUser(base44, user, cfg, useServiceRole) {
  if (!cfg.hft_mode_enabled) return { skipped: true, reason: "HFT disabled" };
  if (!cfg.mt5_account) return { ok: false, error: "MT5 not connected" };

  const token = await resolveBridgeToken(base44, user, cfg, useServiceRole);
  if (!token) return { ok: false, error: "Bridge auth failed" };
  const headers = buildHeaders(token, cfg);
  const symbol = cfg.active_pair || "XAUUSD";

  // Fetch live data in parallel
  const [acctRes, posRes, quotesRes, scanRes, histRes] = await Promise.all([
    fetch(`${BASE}/account`, { headers }).catch(() => null),
    fetch(`${BASE}/positions`, { headers }).catch(() => null),
    fetch(`${BASE}/symbols`, { headers }).catch(() => null),
    fetch(`${BASE}/scanner/status`, { headers }).catch(() => null),
    fetch(`${BASE}/history?limit=5`, { headers }).catch(() => null),
  ]);

  let account = null, positions = [], quote = null, ind = null, history = [];
  if (acctRes?.ok) { const j = await acctRes.json().catch(() => ({})); account = j?.account || j; }
  if (posRes?.ok) { const j = await posRes.json().catch(() => ({})); positions = j?.positions || []; }
  if (quotesRes?.ok) {
    const j = await quotesRes.json().catch(() => ({}));
    const syms = Array.isArray(j?.symbols) ? j.symbols : (Array.isArray(j) ? j : []);
    const sym = syms.find((s) => (s.symbol || "").toUpperCase() === symbol) || syms[0];
    if (sym && sym.bid != null) quote = { bid: Number(sym.bid), ask: Number(sym.ask) };
  }
  if (scanRes?.ok) { const j = await scanRes.json().catch(() => ({})); ind = j?.scanner?.indicators || j?.indicators || null; }
  if (histRes?.ok) { const j = await histRes.json().catch(() => ({})); history = j?.history || j?.deals || []; }

  if (!account?.balance) return { ok: false, error: "No live data" };
  // Danger Mode — bypass quote requirement; trade at market price without live tick

  const balance = account.balance;
  const equity = account.equity ?? balance;
  const minProfitUsd = 0.01; // Danger Mode — take ANY profit, no minimum
  const lotMult = cfg.hft_lot_multiplier ?? 1.5;
  const maxLot = cfg.hft_max_lot ?? 0.5;
  const baseLot = cfg.hft_base_lot ?? 0.01;
  let currentLot = cfg.hft_current_lot ?? baseLot;
  let consecProfits = cfg.hft_consecutive_profits ?? 0;

  const updates = {};
  const actions = [];

  // 1. Close any open position in profit (take ANY profit — no rules, no minimums)
  let profitClosed = 0;
  for (const pos of positions) {
    const profit = num(pos.profit ?? pos.unrealized_pnl);
    if (profit != null && profit >= minProfitUsd) {
      const ticket = pos.ticket ?? pos.id ?? pos.position_id;
      const closeRes = await fetch(`${BASE}/trade/close`, {
        method: "POST", headers,
        body: JSON.stringify({ ticket }),
      }).catch(() => null);
      if (closeRes?.ok) {
        profitClosed += profit;
        actions.push({ action: "close_profit", ticket, profit: Math.round(profit * 100) / 100 });
      }
    }
  }

  // 2. Escalate lot on profitable close — compound on every win
  if (profitClosed > 0) {
    consecProfits += 1;
    currentLot = Math.min(Math.round(currentLot * lotMult * 100) / 100, maxLot);
    actions.push({ action: "lot_escalate", new_lot: currentLot, consecutive_profits: consecProfits });
  }

  // 3. Detect loss from recent history — reset lot to base on any loss
  if (history.length > 0 && profitClosed === 0) {
    const latest = history[0];
    const latestProfit = num(latest?.profit);
    if (latestProfit != null && latestProfit < 0 && (consecProfits > 0 || currentLot !== baseLot)) {
      currentLot = baseLot;
      consecProfits = 0;
      actions.push({ action: "lot_reset", reason: "Loss detected — reset to base lot" });
    }
  }

  updates.hft_current_lot = currentLot;
  updates.hft_consecutive_profits = consecProfits;

  // 4. Open new scalp if no positions remain — IGNORE all rules, just trade
  const remaining = positions.filter((p) => {
    const profit = num(p.profit ?? p.unrealized_pnl);
    return !(profit != null && profit >= minProfitUsd);
  });

  if (remaining.length === 0) {
    // Direction from short-term momentum only — no 8-pillar gate
    const emaFast = num(ind?.ema_6 ?? ind?.ema_5);
    const emaSlow = num(ind?.ema_20 ?? ind?.ema_25);
    const rsi = num(ind?.rsi);

    let direction = null;
    if (emaFast != null && emaSlow != null) {
      direction = emaFast > emaSlow ? "BUY" : "SELL";
    } else if (rsi != null) {
      direction = rsi > 50 ? "BUY" : "SELL";
    }
    if (!direction) direction = "BUY"; // HFT doesn't care — just trade

    const endpoint = direction === "BUY" ? "trade/buy" : "trade/sell";
    const tradeRes = await fetch(`${BASE}/${endpoint}`, {
      method: "POST", headers,
      body: JSON.stringify({ symbol, volume: currentLot }),
    }).catch(() => null);

    const tradeJson = tradeRes?.ok ? await tradeRes.json().catch(() => ({})) : {};
    actions.push({
      action: "open_scalp",
      direction, lot: currentLot, symbol,
      success: tradeRes?.ok && tradeJson?.success !== false,
    });
  }

  // 5. Persist state
  const updateFn = useServiceRole
    ? (id, data) => base44.asServiceRole.entities.BotSettings.update(id, data)
    : (id, data) => base44.entities.BotSettings.update(id, data);
  await updateFn(cfg.id, updates);

  // 6. Log profitable closes as notifications
  if (profitClosed > 0) {
    const notif = {
      type: "trade",
      title: "HFT Profit Secured",
      message: `+$${profitClosed.toFixed(2)} closed. Lot escalated to ${currentLot}. Streak: ${consecProfits}`,
      category: "success",
      meta: { mode: "hft", profit: profitClosed, lot: currentLot },
    };
    if (useServiceRole) {
      await base44.asServiceRole.entities.Notification.create({ ...notif, created_by_id: cfg.created_by_id });
    } else {
      await base44.entities.Notification.create(notif);
    }
  }

  return {
    ok: true,
    actions,
    profit_closed: Math.round(profitClosed * 100) / 100,
    current_lot: currentLot,
    consecutive_profits: consecProfits,
    equity: Math.round(equity * 100) / 100,
    balance: Math.round(balance * 100) / 100,
    positions_open: positions.length,
  };
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    const cronSecret = Deno.env.get("CRON_SECRET");
    const secretMatch = cronSecret && (
      req.headers.get("X-Cron-Secret") === cronSecret || body.cron_secret === cronSecret
    );

    if (secretMatch) {
      // Cron — process ALL HFT-enabled users
      const allSettings = await base44.asServiceRole.entities.BotSettings.list();
      const hftUsers = allSettings.filter((s) => s.hft_mode_enabled === true && s.mt5_account);

      const allUsers = await base44.asServiceRole.entities.User.list().catch(() => []);
      const userMap = new Map(allUsers.map((u) => [u.id, u]));

      const results = [];
      for (const cfg of hftUsers) {
        const user = userMap.get(cfg.created_by_id);
        if (!user) continue;
        try {
          const r = await processHftUser(base44, user, cfg, true);
          results.push({ user: cfg.created_by_id, ...r });
        } catch (e) {
          results.push({ user: cfg.created_by_id, ok: false, error: e.message });
        }
      }
      return Response.json({ ok: true, processed: results.length, results });
    } else {
      // User call — single user
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id }, "-created_date", 1);
      const cfg = settings?.[0];
      if (!cfg) return Response.json({ ok: false, error: "No settings" });
      const r = await processHftUser(base44, user, cfg, false);
      return Response.json({ ok: true, ...r });
    }
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});