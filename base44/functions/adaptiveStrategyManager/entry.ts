import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api";

const STRATEGY = {
  swing: "Swing Trend Pullback Continuation 2026",
  smc: "Liquidity Sweep Scalping",
  tpr: "EMA Trend Progressive Recovery",
};
const KEYS = ["swing", "smc", "tpr"];
const DEFAULT_STRATEGY = STRATEGY.swing;

function keyFor(name) {
  if (name === STRATEGY.smc) return "smc";
  if (name === STRATEGY.tpr) return "tpr";
  return "swing";
}
function regimeMatchFor(k, regime) {
  if (k === "swing") return regime === "Trending";
  if (k === "smc") return regime === "Liquidity Sweep";
  if (k === "tpr") return regime === "Trending";
  return false;
}
const BAR_SECONDS = 15 * 60; // M15 working timeframe
const GLOBAL_COOLDOWN_HOURS = 8;

function num(v) { return typeof v === "number" ? v : (v == null ? null : Number(v)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function nyParts(d) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hh = parseInt(get("hour"), 10) % 24;
  const mm = parseInt(get("minute"), 10);
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    day: dayMap[get("weekday")] ?? 0,
    minutes: hh * 60 + mm,
  };
}
function nyDateKey(d) { return nyParts(new Date(d)).dateKey; }

function sessionOpen(d) {
  const { day, minutes } = nyParts(d);
  if (day === 5 && minutes >= 16 * 60 + 55) return { open: false, name: "Closed", reason: "Friday close" };
  if (day === 6) return { open: false, name: "Closed", reason: "Weekend" };
  if (day === 0 && minutes < 17 * 60 + 10) return { open: false, name: "Closed", reason: "Weekend" };
  if (minutes >= 16 * 60 + 55 && minutes <= 17 * 60 + 15) return { open: false, name: "Closed", reason: "Rollover / spread spike" };
  const inAsian = minutes >= 19 * 60 + 15 || minutes <= 3 * 60 + 45;
  const inNY = minutes >= 8 * 60 && minutes <= 12 * 60;
  if (inAsian) return { open: true, name: "Asian Session" };
  if (inNY) return { open: true, name: "London / NY Overlap" };
  return { open: false, name: "Closed", reason: "Outside enabled session" };
}

// ── Market regime detection ──────────────────────────────────────────────
function detectRegime(ind, quote, cfg) {
  const spread = quote?.spread != null ? Number(quote.spread) : null;
  const maxSpread = cfg.swing_max_spread_points ?? 30;
  const sess = sessionOpen(new Date());
  if (!sess.open) return { regime: "Session Closed", sess, spread };
  if (spread != null && spread > maxSpread) return { regime: "High Spread", sess, spread };

  const ema20 = num(ind?.ema_20 ?? ind?.ema20);
  const ema50 = num(ind?.ema_50 ?? ind?.ema50);
  const ema200 = num(ind?.ema_200 ?? ind?.ema200);
  const atr = num(ind?.atr_14 ?? ind?.atr14);
  const adx = num(ind?.adx);
  const slope = num(ind?.ema_slope ?? ind?.slope);
  const price = quote?.bid != null ? Number(quote.bid) : null;

  const adxOk = adx == null ? true : adx >= (cfg.adaptive_adx_threshold ?? 25);
  const atrOk = (atr == null || price == null) ? true : (atr / price) >= 0.0004;
  const bull = ema20 != null && ema50 != null && ema20 > ema50 && (ema200 == null || ema20 > ema200) && (slope == null || slope > 0) && atrOk && adxOk;
  const bear = ema20 != null && ema50 != null && ema20 < ema50 && (ema200 == null || ema20 < ema200) && (slope == null || slope < 0) && atrOk && adxOk;

  const sweep = ind?.liquidity_sweep === true || ind?.sweep === true ||
    (typeof ind?.signal === "string" && /sweep/i.test(ind.signal));

  if (bull || bear) return { regime: "Trending", sess, spread, dir: bull ? "Bullish" : "Bearish" };
  if (sweep && atrOk) return { regime: "Liquidity Sweep", sess, spread, dir: ind?.sweep_dir || "Neutral" };
  return { regime: "Range", sess, spread };
}

function suitability(key, regime) {
  if (regime === "Trending") {
    if (key === "swing") return 100;
    if (key === "tpr") return 100;
    return 50;
  }
  if (regime === "Liquidity Sweep") return key === "smc" ? 100 : 45;
  if (regime === "Range") return key === "swing" ? 20 : key === "tpr" ? 10 : 25;
  return 0;
}

// ── Per-strategy stats from attributed closed trades ─────────────────────
function buildWindows(logs, initialStrategy, initialSince) {
  const list = [{ strategy: initialStrategy || DEFAULT_STRATEGY, start: initialSince ? new Date(initialSince).getTime() : 0 }];
  for (const l of logs) {
    const t = new Date(l.created_date || l.switched_at).getTime();
    if (!isNaN(t)) list.push({ strategy: l.to_strategy, start: t });
  }
  return list.sort((a, b) => a.start - b.start);
}

function strategyAtTime(windows, ts) {
  const t = new Date(ts).getTime();
  if (isNaN(t)) return null;
  let cur = windows[0]?.strategy || DEFAULT_STRATEGY;
  for (const w of windows) {
    if (t >= w.start) cur = w.strategy;
    else break;
  }
  return cur;
}

function computeStats(trades, balance) {
  const sorted = trades.slice().sort((a, b) => new Date(a.closed_at) - new Date(b.closed_at));
  let wins = 0, losses = 0, grossProfit = 0, grossLoss = 0, net = 0, peak = 0, maxDD = 0;
  for (const t of sorted) {
    const p = t.profit ?? 0;
    net += p;
    if (p > 0) { wins++; grossProfit += p; }
    else if (p < 0) { losses++; grossLoss += Math.abs(p); }
    if (net > peak) peak = net;
    const dd = peak - net;
    if (dd > maxDD) maxDD = dd;
  }
  const total = wins + losses;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99 : 0);

  const desc = sorted.slice().reverse();
  let consecLosses = 0;
  for (const t of desc) {
    if ((t.profit ?? 0) < 0) consecLosses++;
    else break;
  }
  const lastTradeTime = sorted.length ? sorted[sorted.length - 1].closed_at : null;

  const todayKey = nyDateKey(new Date());
  const todayTrades = sorted.filter((t) => t.closed_at && nyDateKey(t.closed_at) === todayKey);
  const profitToday = todayTrades.reduce((s, t) => s + (t.profit ?? 0), 0);

  return {
    total, wins, losses, win_rate: Math.round(winRate * 10) / 10,
    gross_profit: Math.round(grossProfit * 100) / 100,
    gross_loss: Math.round(grossLoss * 100) / 100,
    net_profit: Math.round(net * 100) / 100,
    avg_win: Math.round(avgWin * 100) / 100,
    avg_loss: Math.round(avgLoss * 100) / 100,
    profit_factor: Math.round(profitFactor * 100) / 100,
    max_drawdown: Math.round(maxDD * 100) / 100,
    consecutive_losses: consecLosses,
    last_trade_time: lastTradeTime,
    trades_today: todayTrades.length,
    profit_today: Math.round(profitToday * 100) / 100,
  };
}

function scoreStrategy(key, stats, regime, cfg) {
  const suit = suitability(key, regime);
  const minTrades = cfg.adaptive_eval_window_trades ?? 5;
  const hasPerf = stats.total >= minTrades;
  const pfScore = hasPerf ? clamp((stats.profit_factor / 2) * 100, 0, 100) : 50;
  const wrScore = hasPerf ? stats.win_rate : 50;
  const ddPct = stats.max_drawdown > 0 && stats.balance > 0 ? (stats.max_drawdown / stats.balance) * 100 : 0;
  const ddScore = hasPerf ? clamp(100 - ddPct * 10, 0, 100) : 50;
  const maxConsec = key === "swing" ? (cfg.swing_max_consecutive_losses ?? 2) : 2;
  const consecScore = clamp(100 - (stats.consecutive_losses / maxConsec) * 100, 0, 100);
  return Math.round(0.4 * suit + 0.2 * pfScore + 0.15 * wrScore + 0.15 * ddScore + 0.1 * consecScore);
}

function buildHeaders(token, config) {
  const h = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  if (config.mt5_account) h["X-MT5-Login"] = String(config.mt5_account);
  if (config.mt5_password) h["X-MT5-Password"] = config.mt5_password;
  if (config.mt5_server) h["X-MT5-Server"] = config.mt5_server;
  return h;
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const cronSecret = Deno.env.get("CRON_SECRET");
    const secretMatch = cronSecret && (req.headers.get("X-Cron-Secret") === cronSecret || body.cron_secret === cronSecret);

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    if (!secretMatch) {
      const isAuth = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuth) return Response.json({ error: "Unauthorized — authentication required" }, { status: 403 });
      const user = await base44.auth.me().catch(() => null);
      if (user && user.role !== "admin") return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const provisionSecret = Deno.env.get("PROVISION_SECRET");
    if (!provisionSecret) return Response.json({ error: "PROVISION_SECRET not set" }, { status: 500 });

    const allSettings = await base44.asServiceRole.entities.BotSettings.list();
    if (!allSettings?.length) return Response.json({ ok: true, message: "No BotSettings found" });

    const allUsers = await base44.asServiceRole.entities.User.list();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    async function getJwt(userId, email, name) {
      let apiKey = userMap.get(userId)?.mt5_api_key;
      if (!apiKey) {
        const provisionRes = await fetch(`${BASE}/provision/user`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${provisionSecret}`, "Content-Type": "application/json" },
          body: JSON.stringify({ base44_user_id: userId, email, name: name || email }),
        });
        const provisionJson = await provisionRes.json().catch(() => ({}));
        if (!provisionJson?.success || !provisionJson?.api_key) return null;
        apiKey = provisionJson.api_key;
        const updateData = { mt5_api_key: apiKey };
        if (provisionJson.slug) updateData.mt5_slug = provisionJson.slug;
        await base44.asServiceRole.entities.User.update(userId, updateData);
        userMap.set(userId, { ...userMap.get(userId), mt5_api_key: apiKey });
      }
      const tokenRes = await fetch(`${BASE}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      const tokenJson = await tokenRes.json().catch(() => ({}));
      return tokenJson?.token || null;
    }

    const results = [];

    for (const cfg of allSettings) {
      const userId = cfg.created_by_id;
      if (!cfg.adaptive_enabled) { results.push({ user: userId, skipped: "Adaptive manager disabled" }); continue; }
      if (!cfg.mt5_account || !cfg.mt5_password || !cfg.mt5_server) { results.push({ user: userId, skipped: "No MT5 credentials" }); continue; }

      const userData = userMap.get(userId);
      const jwt = await getJwt(userId, userData?.email, userData?.full_name);
      if (!jwt) { results.push({ user: userId, skipped: "Bridge auth failed" }); continue; }
      const authHeaders = buildHeaders(jwt, cfg);

      // ── Fetch live market data ──
      let ind = null, quote = null, positions = [], account = null, robotRunning = false;
      try {
        const [scanRes, quotesRes, posRes, acctRes, robotRes] = await Promise.all([
          fetch(`${BASE}/scanner/status`, { headers: authHeaders }).catch(() => null),
          fetch(`${BASE}/symbols`, { headers: authHeaders }).catch(() => null),
          fetch(`${BASE}/positions`, { headers: authHeaders }).catch(() => null),
          fetch(`${BASE}/account`, { headers: authHeaders }).catch(() => null),
          fetch(`${BASE}/robot/status`, { headers: authHeaders }).catch(() => null),
        ]);
        if (scanRes?.ok) { const j = await scanRes.json().catch(() => ({})); ind = j?.scanner?.indicators || j?.indicators || null; }
        if (quotesRes?.ok) {
          const j = await quotesRes.json().catch(() => ({}));
          const syms = Array.isArray(j?.symbols) ? j.symbols : (Array.isArray(j) ? j : []);
          const sym = syms.find((s) => (s.symbol || "").toUpperCase() === "XAUUSD") || syms[0];
          if (sym && sym.bid != null) quote = { bid: Number(sym.bid), ask: Number(sym.ask), spread: sym.spread != null ? Number(sym.spread) : (Number(sym.ask) - Number(sym.bid)) };
        }
        if (posRes?.ok) { const j = await posRes.json().catch(() => ({})); positions = j?.positions || []; }
        if (acctRes?.ok) { const j = await acctRes.json().catch(() => ({})); account = j?.account || j; }
        if (robotRes?.ok) { const j = await robotRes.json().catch(() => ({})); robotRunning = j?.running ?? j?.robot?.running ?? false; }
      } catch { /* continue with defaults */ }

      const balance = account?.balance ?? cfg.balance ?? 0;
      const regimeInfo = detectRegime(ind, quote, cfg);
      const regime = regimeInfo.regime;

      // ── Build switch windows & attribute trades ──
      const logs = await base44.asServiceRole.entities.StrategySwitchLog.filter(
        { created_by_id: userId }, "-created_date", 500
      ).catch(() => []);
      const logsAsc = (logs || []).slice().sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const initialStrategy = cfg.adaptive_active_strategy || (logsAsc[0]?.from_strategy || DEFAULT_STRATEGY);
      const windows = buildWindows(logsAsc, initialStrategy, cfg.adaptive_active_since);

      const closedTrades = await base44.asServiceRole.entities.Trade.filter(
        { created_by_id: userId, status: "Closed" }, "-created_date", 500
      ).catch(() => []);
      const closed = (closedTrades || []).filter((t) => t.closed_at);

      const byStrategy = { swing: [], smc: [], tpr: [] };
      for (const t of closed) {
        const sName = strategyAtTime(windows, t.closed_at);
        const k = keyFor(sName);
        if (byStrategy[k]) byStrategy[k].push(t);
      }

      const stats = {};
      for (const k of KEYS) {
        stats[k] = computeStats(byStrategy[k], balance);
      }

      // ── Global consecutive losses (across all strategies, by close time) ──
      const allDesc = closed.slice().sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
      let globalConsec = 0;
      for (const t of allDesc) {
        if ((t.profit ?? 0) < 0) globalConsec++;
        else break;
      }
      const lastGlobalLoss = allDesc.find((t) => (t.profit ?? 0) < 0);
      const lastGlobalLossAt = lastGlobalLoss?.closed_at ? new Date(lastGlobalLoss.closed_at).getTime() : null;
      const globalCooldownUntil = globalConsec >= 2 && lastGlobalLossAt
        ? new Date(lastGlobalLossAt + GLOBAL_COOLDOWN_HOURS * 3600 * 1000).toISOString()
        : (cfg.adaptive_global_cooldown_until || null);
      const globalCooldownActive = globalCooldownUntil && new Date(globalCooldownUntil).getTime() > Date.now();

      // ── Per-strategy cooldown ──
      const cooldowns = {};
      for (const k of KEYS) {
        const maxConsec = k === "swing" ? (cfg.swing_max_consecutive_losses ?? 2) : k === "tpr" ? (cfg.tpr_max_consecutive_losses ?? 2) : 2;
        const cooldownH = k === "swing" ? (cfg.swing_cooldown_hours ?? 8) : k === "tpr" ? (cfg.tpr_cooldown_hours ?? 8) : 8;
        const s = stats[k];
        let cu = null;
        if (s.consecutive_losses >= maxConsec && s.last_trade_time) {
          cu = new Date(new Date(s.last_trade_time).getTime() + cooldownH * 3600 * 1000).toISOString();
        }
        cooldowns[k] = cu;
      }

      // ── Daily risk gates ──
      const todayKey = nyDateKey(new Date());
      const realizedToday = closed
        .filter((t) => nyDateKey(t.closed_at) === todayKey)
        .reduce((sum, t) => sum + (t.profit ?? 0), 0);
      const dailyLossLimit = cfg.daily_loss_limit ?? 50;
      const maxDailyLossPct = cfg.swing_max_daily_loss_pct ?? 2;
      const maxDailyDDPct = cfg.swing_max_daily_drawdown_pct ?? 3;
      const dailyLossHit = realizedToday <= -dailyLossLimit;
      const dailyLossPctHit = balance > 0 && realizedToday <= -(maxDailyLossPct / 100) * balance;
      const dailyDDHit = balance > 0 && realizedToday <= -(maxDailyDDPct / 100) * balance;

      // ── Daily profit target ──
      const targetAmount = cfg.daily_profit_target_amount ?? 100;
      const targetPct = cfg.daily_profit_target_percent ?? 0;
      const targetByAmount = targetAmount > 0 && realizedToday >= targetAmount;
      const targetByPct = targetPct > 0 && balance > 0 && realizedToday >= (targetPct / 100) * balance;
      const targetEnabled = cfg.daily_profit_target_enabled !== false;
      const stopAtTarget = cfg.stop_trading_at_daily_target !== false;
      let targetReached = false;
      if (targetEnabled && stopAtTarget && (targetByAmount || targetByPct)) targetReached = true;

      let prevReachedAt = cfg.adaptive_daily_target_reached_at || null;
      let prevReached = cfg.adaptive_daily_target_reached === true;
      if (prevReached && prevReachedAt && nyDateKey(prevReachedAt) !== todayKey) {
        prevReached = false; prevReachedAt = null;
      }
      const dailyTargetReached = targetReached || prevReached;
      const dailyTargetReachedAt = dailyTargetReached ? (targetReached ? new Date().toISOString() : prevReachedAt) : null;

      // ── Scores ──
      const scores = {};
      for (const k of KEYS) {
        stats[k].balance = balance;
        scores[k] = scoreStrategy(k, stats[k], regime, cfg);
      }

      // ── Eligibility per strategy ──
      const eligible = {};
      const pend = { strategy: cfg.adaptive_pending_strategy, since: cfg.adaptive_pending_since, bars: cfg.adaptive_pending_bars || 0 };
      const atrVal = num(ind?.atr_14 ?? ind?.atr14);
      const priceVal = quote?.bid;
      const riskTooHigh = atrVal != null && priceVal != null && (atrVal / priceVal) > 0.003;
      for (const k of KEYS) {
        const regimeMatch = regimeMatchFor(k, regime);
        const spreadOk = regimeInfo.spread == null || regimeInfo.spread <= (cfg.swing_max_spread_points ?? 30);
        const sessionOk = regimeInfo.sess.open;
        const cooldownOk = !cooldowns[k] || new Date(cooldowns[k]).getTime() <= Date.now();
        const globalOk = !globalCooldownActive;
        const riskOk = !dailyLossHit && !dailyLossPctHit && !dailyDDHit;
        const targetOk = !dailyTargetReached;
        const scoreOk = scores[k] >= (cfg.adaptive_min_score ?? 70);
        const ok = regimeMatch && spreadOk && sessionOk && cooldownOk && globalOk && riskOk && targetOk && scoreOk && !riskTooHigh;
        eligible[k] = ok;
        let reason = "Confirmation candle valid. Entry allowed.";
        if (dailyTargetReached) reason = "Trade rejected: daily target reached.";
        else if (!sessionOk) reason = "Trade rejected: late session.";
        else if (!spreadOk) reason = "Trade rejected: spread too high.";
        else if (riskTooHigh) reason = "Trade rejected: risk too high.";
        else if (!globalOk || !cooldownOk) reason = "Two losses detected. Cooling down.";
        else if (!riskOk) reason = "Capital protection mode active.";
        else if (!regimeMatch) reason = "Market structure is unclear. Waiting.";
        else if (!scoreOk) reason = "Trade rejected: setup quality too low.";
        stats[k].status_message = reason;
        stats[k].enabled = ok;
      }

      // ── Active strategy decision (generalized over all strategies) ──
      let current = cfg.adaptive_active_strategy || DEFAULT_STRATEGY;
      let currentKey = keyFor(current);

      let reason = "";
      let newActive = current;
      let switched = false;
      const threshold = cfg.adaptive_switch_threshold ?? 15;
      const barsConfirm = cfg.adaptive_bars_confirm ?? 3;

      // Best eligible rival (highest score among eligible, excluding current)
      const eligibleRivals = KEYS.filter((k) => k !== currentKey && eligible[k]);
      const bestRivalKey = eligibleRivals.length
        ? eligibleRivals.reduce((best, k) => scores[k] > scores[best] ? k : best, eligibleRivals[0])
        : null;

      if (dailyTargetReached) {
        reason = "Trade rejected: daily target reached.";
        pend.strategy = null; pend.since = null; pend.bars = 0;
      } else if (globalCooldownActive) {
        reason = "Two losses detected. Cooling down.";
      } else if (positions.length > 0) {
        reason = `Trade open — ${current} continues managing existing position. No switch while trade is open.`;
        if (!(bestRivalKey && scores[bestRivalKey] >= scores[currentKey] + threshold)) {
          pend.strategy = null; pend.since = null; pend.bars = 0;
        }
      } else {
        if (eligible[currentKey]) {
          if (bestRivalKey && scores[bestRivalKey] >= scores[currentKey] + threshold) {
            if (pend.strategy !== STRATEGY[bestRivalKey]) {
              pend.strategy = STRATEGY[bestRivalKey];
              pend.since = new Date().toISOString();
              pend.bars = 0;
              reason = `${STRATEGY[bestRivalKey]} leading by ${scores[bestRivalKey] - scores[currentKey]} pts — confirming over ${barsConfirm} bars.`;
            } else {
              const sinceMs = pend.since ? new Date(pend.since).getTime() : Date.now();
              const barsElapsed = Math.floor((Date.now() - sinceMs) / (BAR_SECONDS * 1000));
              pend.bars = barsElapsed;
              if (barsElapsed >= barsConfirm) {
                switched = true;
                newActive = STRATEGY[bestRivalKey];
                reason = `${regime} detected — ${STRATEGY[bestRivalKey]} selected (score ${scores[bestRivalKey]} vs ${scores[currentKey]}, confirmed ${barsElapsed} bars).`;
              } else {
                reason = `${STRATEGY[bestRivalKey]} leading by ${scores[bestRivalKey] - scores[currentKey]} pts — confirming ${barsElapsed}/${barsConfirm} bars.`;
              }
            }
          } else {
            pend.strategy = null; pend.since = null; pend.bars = 0;
            if (regime === "Trending") reason = `Trend market detected — ${STRATEGY.swing} selected.`;
            else if (regime === "Liquidity Sweep") reason = `Liquidity sweep detected — ${STRATEGY.smc} selected.`;
            else if (eligible[currentKey]) reason = `${current} active (score ${scores[currentKey]}).`;
            else reason = regime === "Range" ? "Market structure is unclear. Waiting." : "Break of Structure not confirmed.";
          }
        } else {
          pend.strategy = null; pend.since = null; pend.bars = 0;
          if (bestRivalKey) {
            switched = true;
            newActive = STRATEGY[bestRivalKey];
            reason = `${current} no longer eligible (${stats[currentKey].status_message}) — switched to ${STRATEGY[bestRivalKey]} (score ${scores[bestRivalKey]}).`;
          } else {
            reason = regime === "Range" ? "Market structure is unclear. Waiting." : "Break of Structure not confirmed.";
          }
        }
      }

      if (switched) {
        const toKey = keyFor(newActive);
        await base44.asServiceRole.entities.StrategySwitchLog.create({
          created_by_id: userId,
          from_strategy: current,
          to_strategy: newActive,
          reason,
          from_score: scores[currentKey],
          to_score: scores[toKey],
          regime,
          confirmed_bars: pend.bars || 0,
        }).catch(() => {});
        if (robotRunning && positions.length === 0) {
          try {
            await fetch(`${BASE}/robot/stop`, { method: "POST", headers: authHeaders, body: "{}" }).catch(() => {});
            const startPayload = {
              strategy: newActive,
              symbol: cfg.active_pair || "XAUUSD",
              trading_mode: cfg.trading_mode || "Balanced",
              lot_size: cfg.lot_size ?? 0.01,
              max_concurrent_trades: cfg.max_concurrent_trades ?? 2,
              risk_percentage: cfg.risk_percentage ?? 1,
              stop_loss: cfg.stop_loss ?? 20,
              take_profit: cfg.take_profit ?? 40,
              daily_profit_target: cfg.daily_profit_target ?? 100,
              daily_loss_limit: cfg.daily_loss_limit ?? 20,
              stop_after_losses: cfg.stop_after_losses ?? 2,
              equity_guard_enabled: cfg.equity_guard_enabled ?? true,
              equity_guard_min_equity_pct: cfg.equity_guard_min_equity_pct ?? 75,
              trend_filter_enabled: cfg.trend_filter_enabled ?? true,
              trend_filter_timeframe: cfg.trend_filter_timeframe ?? "M15",
              trend_filter_ema_period: cfg.trend_filter_ema_period ?? 200,
              break_even: cfg.break_even ?? true,
              trailing_stop: cfg.trailing_stop ?? false,
              max_spread_pips: 5,
            };
            await fetch(`${BASE}/robot/start`, { method: "POST", headers: authHeaders, body: JSON.stringify(startPayload) }).catch(() => {});
          } catch {}
        }
        current = newActive;
        currentKey = keyFor(current);
        pend.strategy = null; pend.since = null; pend.bars = 0;
      }

      // ── Upsert StrategyMetrics ──
      const existingMetrics = await base44.asServiceRole.entities.StrategyMetrics.filter(
        { created_by_id: userId }, "-created_date", 50
      ).catch(() => []);
      const metricByStrategy = {};
      for (const m of existingMetrics) metricByStrategy[m.strategy_name] = m;

      for (const k of KEYS) {
        const name = STRATEGY[k];
        const s = stats[k];
        const payload = {
          strategy_key: k,
          strategy_name: name,
          enabled: s.enabled,
          score: scores[k],
          suitability: suitability(k, regime),
          total_trades: s.total,
          wins: s.wins,
          losses: s.losses,
          win_rate: s.win_rate,
          gross_profit: s.gross_profit,
          gross_loss: s.gross_loss,
          net_profit: s.net_profit,
          avg_win: s.avg_win,
          avg_loss: s.avg_loss,
          profit_factor: s.profit_factor,
          max_drawdown: s.max_drawdown,
          consecutive_losses: s.consecutive_losses,
          last_trade_time: s.last_trade_time,
          cooldown_until: cooldowns[k],
          trades_today: s.trades_today,
          profit_today: s.profit_today,
          status_message: s.status_message,
        };
        const existing = metricByStrategy[name];
        if (existing) {
          await base44.asServiceRole.entities.StrategyMetrics.update(existing.id, payload).catch(() => {});
        } else {
          await base44.asServiceRole.entities.StrategyMetrics.create({ ...payload, created_by_id: userId }).catch(() => {});
        }
      }

      // ── Persist BotSettings adaptive state ──
      await base44.asServiceRole.entities.BotSettings.update(cfg.id, {
        adaptive_active_strategy: current,
        adaptive_active_since: switched ? new Date().toISOString() : (cfg.adaptive_active_since || new Date().toISOString()),
        adaptive_market_regime: regime,
        adaptive_reason: reason,
        adaptive_pending_strategy: pend.strategy || null,
        adaptive_pending_since: pend.since || null,
        adaptive_pending_bars: pend.bars || 0,
        adaptive_global_cooldown_until: globalCooldownUntil,
        adaptive_daily_target_reached: dailyTargetReached,
        adaptive_daily_target_reached_at: dailyTargetReachedAt,
      }).catch(() => {});

      results.push({
        user: userId,
        login: cfg.mt5_account,
        regime,
        active: current,
        switched,
        scores: { swing: scores.swing, smc: scores.smc, tpr: scores.tpr },
        eligible,
        realizedToday: Math.round(realizedToday * 100) / 100,
        dailyTargetReached,
        globalCooldownActive: !!globalCooldownActive,
        reason,
      });
    }

    return Response.json({ ok: true, checkedAt: new Date().toISOString(), results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});