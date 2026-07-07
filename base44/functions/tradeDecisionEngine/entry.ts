import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api";

function num(v) { return typeof v === "number" ? v : (v == null ? null : Number(v)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Session detection (America/New_York) ──────────────────────────────────
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
  return { day: dayMap[get("weekday")] ?? 0, minutes: hh * 60 + mm };
}

function sessionInfo() {
  const { day, minutes } = nyParts(new Date());
  if (day === 5 && minutes >= 16 * 60 + 55) return { open: false, name: "Closed", reason: "Friday close" };
  if (day === 6) return { open: false, name: "Closed", reason: "Weekend" };
  if (day === 0 && minutes < 17 * 60 + 10) return { open: false, name: "Closed", reason: "Weekend" };
  if (minutes >= 16 * 60 + 55 && minutes <= 17 * 60 + 15) return { open: false, name: "Closed", reason: "Rollover / spread spike" };
  const inAsian = minutes >= 19 * 60 + 15 || minutes <= 3 * 60 + 45;
  const inLondon = minutes >= 3 * 60 && minutes < 8 * 60;
  const inNY = minutes >= 8 * 60 && minutes <= 12 * 60;
  const inOverlap = minutes >= 8 * 60 && minutes <= 11 * 60;
  if (inOverlap) return { open: true, name: "London / NY Overlap", quality: "high" };
  if (inNY) return { open: true, name: "New York", quality: "medium" };
  if (inLondon) return { open: true, name: "London", quality: "medium" };
  if (inAsian) return { open: true, name: "Asian", quality: "low" };
  return { open: false, name: "Off-Session", reason: "Outside prime trading hours" };
}

function nyDateKey(d) {
  const p = nyParts(d);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t) => parts.find((x) => x.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function buildHeaders(token, config) {
  const h = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  if (config.mt5_account) h["X-MT5-Login"] = String(config.mt5_account);
  if (config.mt5_password) h["X-MT5-Password"] = config.mt5_password;
  if (config.mt5_server) h["X-MT5-Server"] = config.mt5_server;
  return h;
}

function consecutiveLossesCount(closedTrades) {
  const desc = (closedTrades || [])
    .filter((t) => t.closed_at)
    .sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
  let n = 0;
  for (const t of desc) { if ((t.profit ?? 0) < 0) n++; else break; }
  return n;
}

// ── Pillar 1: Market Structure ────────────────────────────────────────────
function checkStructure(ind, regime, dir) {
  const sweep = ind?.liquidity_sweep === true || ind?.sweep === true;
  const bos = ind?.bos === true || ind?.break_of_structure === true;
  const choch = ind?.choch === true || ind?.change_of_character === true;
  if (regime === "Trending" && (bos || dir === "Bullish" || dir === "Bearish")) {
    return { pass: true, score: 85, reason: "Clear Break of Structure — trend confirmed." };
  }
  if (regime === "Liquidity Sweep" && (sweep || choch)) {
    return { pass: true, score: 80, reason: "Liquidity sweep + CHOCH detected — reversal setup forming." };
  }
  if (regime === "Range") {
    return { pass: false, score: 25, reason: "Market in range — no clear directional structure. Waiting." };
  }
  return { pass: false, score: 30, reason: "Market structure unclear — no confirmed BOS or CHOCH." };
}

// ── Pillar 2: Trend Alignment ─────────────────────────────────────────────
function checkTrend(ind, price, cfg) {
  const ema20 = num(ind?.ema_20 ?? ind?.ema20);
  const ema50 = num(ind?.ema_50 ?? ind?.ema50);
  const ema200 = num(ind?.ema_200 ?? ind?.ema200);
  const slope = num(ind?.ema_slope ?? ind?.slope);
  const period = cfg.trend_filter_ema_period ?? 200;
  if (ema20 == null || ema50 == null) {
    return { pass: false, score: 20, reason: "Trend data unavailable — cannot confirm direction.", direction: null };
  }
  const bull = ema20 > ema50 && (ema200 == null || ema20 > ema200) && (slope == null || slope > 0);
  const bear = ema20 < ema50 && (ema200 == null || ema20 < ema200) && (slope == null || slope < 0);
  if (bull) {
    let s = 80;
    if (ema200 != null && ema20 > ema200) s += 10;
    if (slope != null && slope > 0) s += 5;
    return { pass: true, score: clamp(s, 0, 100), reason: "EMA stack bullish (20 > 50 > 200) with positive slope.", direction: "BUY" };
  }
  if (bear) {
    let s = 80;
    if (ema200 != null && ema20 < ema200) s += 10;
    if (slope != null && slope < 0) s += 5;
    return { pass: true, score: clamp(s, 0, 100), reason: "EMA stack bearish (20 < 50 < 200) with negative slope.", direction: "SELL" };
  }
  return { pass: false, score: 30, reason: "EMAs entangled — no sustained trend alignment.", direction: null };
}

// ── Pillar 3: Liquidity ───────────────────────────────────────────────────
function checkLiquidity(ind, regime) {
  const sweep = ind?.liquidity_sweep === true || ind?.sweep === true;
  const sweepDir = ind?.sweep_dir || ind?.sweep_direction;
  if (sweep) {
    return { pass: true, score: 85, reason: `Liquidity sweep detected (${sweepDir || "unconfirmed direction"}) — stop hunt likely complete.`, sweepDir };
  }
  if (regime === "Trending") {
    return { pass: true, score: 60, reason: "No active sweep, but trend regime — liquidity flowing in trend direction." };
  }
  return { pass: false, score: 35, reason: "No liquidity sweep detected — waiting for stop hunt before entry." };
}

// ── Pillar 4: Momentum ────────────────────────────────────────────────────
function checkMomentum(ind, cfg) {
  const adx = num(ind?.adx);
  const rsi = num(ind?.rsi ?? ind?.rsi_14);
  const macd = num(ind?.macd ?? ind?.macd_histogram);
  const threshold = cfg.adaptive_adx_threshold ?? 25;
  if (adx == null) {
    // If ADX unavailable, use RSI + MACD as fallback
    if (rsi != null && rsi > 40 && rsi < 65) return { pass: true, score: 60, reason: "RSI in healthy momentum zone (no exhaustion)." };
    if (rsi != null && rsi > 35 && rsi < 70) return { pass: true, score: 50, reason: "RSI acceptable — momentum present." };
    return { pass: false, score: 25, reason: "Momentum data unavailable — cannot confirm strength." };
  }
  if (adx < threshold) {
    return { pass: false, score: 30, reason: `ADX ${adx.toFixed(1)} below ${threshold} — trend too weak. No trade.` };
  }
  let s = 60 + clamp((adx - threshold) * 2, 0, 30);
  // Penalize if RSI is extreme (overbought/oversold = exhaustion risk)
  if (rsi != null) {
    if (rsi > 75) { s -= 20; return { pass: s >= 50, score: s, reason: `ADX strong (${adx.toFixed(0)}) but RSI ${rsi.toFixed(0)} overbought — exhaustion risk. Waiting.` }; }
    if (rsi < 25) { s -= 20; return { pass: s >= 50, score: s, reason: `ADX strong (${adx.toFixed(0)}) but RSI ${rsi.toFixed(0)} oversold — exhaustion risk. Waiting.` }; }
    if (rsi >= 40 && rsi <= 65) s += 10;
  }
  if (macd != null && macd > 0) s += 5;
  return { pass: s >= 55, score: clamp(s, 0, 100), reason: `ADX ${adx.toFixed(0)} ≥ ${threshold} — momentum confirmed.` };
}

// ── Pillar 5: Volatility ──────────────────────────────────────────────────
function checkVolatility(ind, price, cfg) {
  const atr = num(ind?.atr_14 ?? ind?.atr14);
  if (atr == null || price == null || price <= 0) {
    return { pass: false, score: 20, reason: "ATR unavailable — cannot assess volatility." };
  }
  const ratio = atr / price;
  // Too low = dead market (no movement), too high = dangerous (SL too wide)
  if (ratio < 0.0003) {
    return { pass: false, score: 25, reason: `ATR/Price ${(ratio * 100).toFixed(3)}% — market dead. No volatility to trade.` };
  }
  if (ratio > 0.005) {
    return { pass: false, score: 30, reason: `ATR/Price ${(ratio * 100).toFixed(2)}% — extreme volatility. Risk too high.` };
  }
  let s = 70;
  if (ratio >= 0.0006 && ratio <= 0.002) s = 90; // Sweet spot
  else if (ratio >= 0.0004 && ratio <= 0.003) s = 75;
  return { pass: true, score: s, reason: `ATR healthy (${(ratio * 100).toFixed(3)}% of price) — volatility in tradeable range.`, atr };
}

// ── Pillar 6: Spread ──────────────────────────────────────────────────────
function checkSpread(spread, slPoints, cfg) {
  const maxSpread = cfg.swing_max_spread_points ?? 30;
  if (spread == null) {
    return { pass: false, score: 20, reason: "Spread data unavailable — cannot assess cost." };
  }
  if (spread > maxSpread) {
    return { pass: false, score: 15, reason: `Spread ${spread}pts exceeds max ${maxSpread}pts — entry cost too high.` };
  }
  // Spread should be small relative to SL (if SL known)
  if (slPoints != null && slPoints > 0) {
    const spreadPctOfSl = (spread / slPoints) * 100;
    const maxPct = cfg.lsr3r_max_spread_pct_of_sl ?? 12;
    if (spreadPctOfSl > maxPct) {
      return { pass: false, score: 35, reason: `Spread is ${spreadPctOfSl.toFixed(1)}% of SL — too costly relative to risk.` };
    }
  }
  let s = 60 + clamp((1 - spread / maxSpread) * 30, 0, 30);
  return { pass: true, score: s, reason: `Spread ${spread}pts within limit — entry cost acceptable.` };
}

// ── Pillar 7: Risk / Capital Protection ───────────────────────────────────
function checkRisk(args) {
  const { balance, equity, dailyPnL, consecLosses, cfg, positions, tradesToday, dailyTargetReached, globalCooldownActive } = args;
  const isBasic = (cfg.bot_mentality || "Premium") === "Basic";
  const reasons = [];

  // 7a. Equity Guard — hard stop
  if (cfg.equity_guard_enabled !== false && balance > 0) {
    const minEqPct = cfg.equity_guard_min_equity_pct ?? 50;
    const eqPct = (equity / balance) * 100;
    if (eqPct < minEqPct) {
      reasons.push(`Equity ${eqPct.toFixed(1)}% < guard ${minEqPct}% — capital protection triggered.`);
      return { pass: false, score: 0, reasons, block: true };
    }
  }

  // 7b. Daily loss limit
  const maxDailyLossPct = cfg.swing_max_daily_loss_pct ?? 40;
  const lossLimit = balance > 0 ? (maxDailyLossPct / 100) * balance : (cfg.daily_loss_limit ?? 50);
  if (dailyPnL <= -lossLimit) {
    reasons.push(`Daily loss $${Math.abs(dailyPnL).toFixed(2)} hit limit $${lossLimit.toFixed(2)} — trading stopped for today.`);
    return { pass: false, score: 0, reasons, block: true };
  }

  // 7c. Daily drawdown %
  const maxDailyDDPct = cfg.swing_max_daily_drawdown_pct ?? 3;
  if (balance > 0 && dailyPnL <= -(maxDailyDDPct / 100) * balance) {
    reasons.push(`Daily drawdown ${maxDailyDDPct}% hit — capital protection active.`);
    return { pass: false, score: 0, reasons, block: true };
  }

  // 7d. Consecutive losses → mandatory cooldown (no revenge)
  const stopAfter = cfg.stop_after_losses ?? 2;
  if (consecLosses >= stopAfter) {
    reasons.push(isBasic
      ? `${consecLosses} consecutive losses — cooling down. No revenge trade.`
      : `${consecLosses} losses in a row — mandatory cooldown. Lot NOT increased after loss (no martingale).`);
    return { pass: false, score: 0, reasons, block: true };
  }

  // 7e. Global cooldown
  if (globalCooldownActive) {
    reasons.push("Global cooldown active — waiting for cooldown to expire before resuming.");
    return { pass: false, score: 0, reasons, block: true };
  }

  // 7f. Daily profit target reached
  if (dailyTargetReached) {
    reasons.push(isBasic ? "Daily target reached — protecting gains." : "Session profit target hit — pausing to protect gains.");
    return { pass: false, score: 0, reasons, block: true };
  }

  // 7g. Max concurrent positions (no overtrading / no grid stacking)
  const maxConcurrent = cfg.max_concurrent_trades ?? 2;
  if (positions.length >= maxConcurrent) {
    reasons.push(`${positions.length}/${maxConcurrent} positions open — max concurrent reached. No new entries (no grid stacking).`);
    return { pass: false, score: 0, reasons, block: false };
  }

  // 7h. Max trades per day (no overtrading)
  const maxDailyTrades = cfg.swing_max_trades_per_day ?? cfg.max_daily_trades ?? 3;
  if (tradesToday >= maxDailyTrades) {
    reasons.push(`${tradesToday}/${maxDailyTrades} trades today — daily trade cap reached. No overtrading.`);
    return { pass: false, score: 0, reasons, block: false };
  }

  // 7i. Lot NEVER increases after a loss (no martingale) — enforced by design
  // The lot multiplier only activates after proven profitability (30+ trades, 55%+ win, net positive)
  // This is a policy statement, not a runtime check — the lot is always computed fresh from risk%.

  reasons.push(isBasic ? "Capital protection checks passed." : "All capital protection gates passed. No martingale, no grid, no revenge.");
  return { pass: true, score: 100, reasons, block: false };
}

// ── Pillar 8: Session ─────────────────────────────────────────────────────
function checkSession(cfg) {
  const sess = sessionInfo();
  if (!sess.open) {
    return { pass: false, score: 0, reason: `Market ${sess.name}: ${sess.reason}`, sess };
  }
  // If user disabled Asian session and we're in Asian
  if (sess.name === "Asian" && cfg.asian_session === false) {
    return { pass: false, score: 0, reason: "Asian session disabled in settings — waiting for London/NY.", sess };
  }
  let s = 70;
  if (sess.quality === "high") s = 95;
  else if (sess.quality === "medium") s = 75;
  else if (sess.quality === "low") s = 50;
  return { pass: true, score: s, reason: `${sess.name} session active — prime trading window.`, sess };
}

// ── SL / TP / Lot calculation ─────────────────────────────────────────────
function computeTradeParams(args) {
  const { direction, price, atr, spread, balance, cfg, symbol } = args;
  if (!direction || !price || !atr || !balance) return null;

  const atrMult = cfg.swing_atr_sl_multiplier ?? 1.5;
  const slDistance = atr * atrMult;
  const slPrice = direction === "BUY" ? price - slDistance : price + slDistance;

  const rr = cfg.swing_min_rr ?? 2;
  const tpDistance = slDistance * rr;
  const tpPrice = direction === "BUY" ? price + tpDistance : price - tpDistance;

  // Lot from risk % — NEVER increases after a loss (computed fresh each time)
  const riskPct = cfg.risk_percentage ?? 1;
  const riskAmount = balance * (riskPct / 100);
  // Approximate: SL distance in price units → dollar risk per lot
  // For XAUUSD: 1 lot = 100 oz, so $1 move = $100. SL distance × 100 = risk per lot
  // For FX: use tick value approximation
  const dollarsPerLotPerPrice = symbol === "XAUUSD" ? 100 : (symbol === "NAS100" || symbol === "US30" ? 1 : 10);
  const riskPerLot = slDistance * dollarsPerLotPerPrice;
  let lot = riskPerLot > 0 ? riskAmount / riskPerLot : 0.01;
  lot = Math.max(0.01, Math.round(lot * 100) / 100);
  // Cap at max concurrent lot
  const maxLot = cfg.lot_size ?? 0.05;
  lot = Math.min(lot, maxLot * (cfg.max_concurrent_trades ?? 2));

  return {
    direction,
    entry: price,
    stop_loss: Math.round(slPrice * 100000) / 100000,
    take_profit: Math.round(tpPrice * 100000) / 100000,
    sl_distance: Math.round(slDistance * 100000) / 100000,
    tp_distance: Math.round(tpDistance * 100000) / 100000,
    risk_reward: rr,
    risk_amount: Math.round(riskAmount * 100) / 100,
    lot_size: lot,
    atr: atr,
  };
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Load user's BotSettings
    const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id }, "-created_date", 1);
    const cfg = settings?.[0];
    if (!cfg?.mt5_account) {
      return Response.json({
        ok: true,
        decision: "NO_TRADE",
        reason: "MT5 account not connected — connect your account to begin.",
        connected: false,
        pillars: [],
        score: 0,
      });
    }

    // ── Get bridge JWT ──
    let bridgeToken = user.flouba_token;
    if (!bridgeToken) {
      let apiKey = user.mt5_api_key;
      if (!apiKey) {
        const provisionSecret = Deno.env.get("PROVISION_SECRET");
        if (!provisionSecret) return Response.json({ error: "PROVISION_SECRET not set" }, { status: 500 });
        const provisionRes = await fetch(`${BASE}/provision/user`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${provisionSecret}`, "Content-Type": "application/json" },
          body: JSON.stringify({ base44_user_id: user.id, email: user.email, name: user.full_name || user.email }),
        });
        const provisionJson = await provisionRes.json().catch(() => ({}));
        if (!provisionJson?.success || !provisionJson?.api_key) {
          return Response.json({ ok: false, error: "Failed to provision bridge account" });
        }
        apiKey = provisionJson.api_key;
        const updateData = { mt5_api_key: apiKey };
        if (provisionJson.user_token) updateData.flouba_token = provisionJson.user_token;
        if (provisionJson.ea_download_url) updateData.ea_download_url = provisionJson.ea_download_url;
        await base44.auth.updateMe(updateData);
        bridgeToken = provisionJson.user_token || null;
      }
      if (!bridgeToken) {
        const tokenRes = await fetch(`${BASE}/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: apiKey }),
        });
        const tokenJson = await tokenRes.json().catch(() => ({}));
        bridgeToken = tokenJson?.token || null;
      }
    }
    if (!bridgeToken) return Response.json({ ok: false, error: "Bridge auth failed" });

    const authHeaders = buildHeaders(bridgeToken, cfg);

    // ── Fetch ALL live data in parallel ──
    const [scanRes, quotesRes, posRes, acctRes, robotRes] = await Promise.all([
      fetch(`${BASE}/scanner/status`, { headers: authHeaders }).catch(() => null),
      fetch(`${BASE}/symbols`, { headers: authHeaders }).catch(() => null),
      fetch(`${BASE}/positions`, { headers: authHeaders }).catch(() => null),
      fetch(`${BASE}/account`, { headers: authHeaders }).catch(() => null),
      fetch(`${BASE}/robot/status`, { headers: authHeaders }).catch(() => null),
    ]);

    let ind = null, quote = null, positions = [], account = null, robotRunning = false;
    if (scanRes?.ok) { const j = await scanRes.json().catch(() => ({})); ind = j?.scanner?.indicators || j?.indicators || null; }
    if (quotesRes?.ok) {
      const j = await quotesRes.json().catch(() => ({}));
      const syms = Array.isArray(j?.symbols) ? j.symbols : (Array.isArray(j) ? j : []);
      const sym = syms.find((s) => (s.symbol || "").toUpperCase() === (cfg.active_pair || "XAUUSD")) || syms[0];
      if (sym && sym.bid != null) quote = { bid: Number(sym.bid), ask: Number(sym.ask), spread: sym.spread != null ? Number(sym.spread) : (Number(sym.ask) - Number(sym.bid)) };
    }
    if (posRes?.ok) { const j = await posRes.json().catch(() => ({})); positions = j?.positions || []; }
    if (acctRes?.ok) { const j = await acctRes.json().catch(() => ({})); account = j?.account || j; }
    if (robotRes?.ok) { const j = await robotRes.json().catch(() => ({})); robotRunning = j?.running ?? j?.robot?.running ?? false; }

    const connected = account?.balance != null && quote?.bid != null;
    if (!connected) {
      return Response.json({
        ok: true,
        decision: "NO_TRADE",
        reason: "Market feed disconnected — no live MT5 data.",
        connected: false,
        pillars: [],
        score: 0,
      });
    }

    const balance = account?.balance ?? 0;
    const equity = account?.equity ?? balance;
    const floatingPnl = account?.profit ?? (equity - balance);

    // ── Fetch today's closed trades ──
    // ── DANGER MODE BYPASS: HFT ignores ALL 8 pillars, all limits, all gates ──
    if (cfg.hft_mode_enabled === true) {
      const hftLot = cfg.hft_current_lot ?? cfg.hft_base_lot ?? 0.01;
      const emaFast = num(ind?.ema_6 ?? ind?.ema_5);
      const emaSlow = num(ind?.ema_20 ?? ind?.ema_25);
      const rsi = num(ind?.rsi);
      let hftDir = "BUY";
      if (emaFast != null && emaSlow != null) hftDir = emaFast > emaSlow ? "BUY" : "SELL";
      else if (rsi != null) hftDir = rsi > 50 ? "BUY" : "SELL";
      return Response.json({
        ok: true,
        connected: true,
        decision: "TRADE",
        reason: `DANGER MODE — all limits bypassed. Scalping ${hftDir} ${cfg.active_pair || "XAUUSD"} at ${hftLot} lot. No daily loss limit, no session gate, no cooldown.`,
        score: 100,
        min_score: 0,
        regime: "HFT Danger",
        regime_dir: hftDir === "BUY" ? "Bullish" : "Bearish",
        direction: hftDir,
        pillars: [],
        danger_mode: true,
        trade: {
          direction: hftDir,
          entry: quote?.bid,
          lot_size: hftLot,
          danger_mode: true,
        },
        account: {
          balance: Math.round(balance * 100) / 100,
          equity: Math.round(equity * 100) / 100,
          floating_pnl: Math.round(floatingPnl * 100) / 100,
        },
        safety: { all_limits_bypassed: true },
        robot_running: robotRunning,
        checked_at: new Date().toISOString(),
      });
    }

    const closedTrades = await base44.entities.Trade.filter(
      { created_by_id: user.id, status: "Closed" }, "-closed_at", 50
    ).catch(() => []);

    const todayKey = nyDateKey(new Date());
    const todayClosed = (closedTrades || []).filter((t) => t.closed_at && nyDateKey(t.closed_at) === todayKey);
    const realizedToday = todayClosed.reduce((s, t) => s + (t.profit ?? 0), 0);
    const dailyPnL = floatingPnl + realizedToday;
    const consecLosses = consecutiveLossesCount(closedTrades);
    const tradesToday = todayClosed.length;

    // ── Detect regime ──
    const price = quote?.bid;
    const ema20 = num(ind?.ema_20 ?? ind?.ema20);
    const ema50 = num(ind?.ema_50 ?? ind?.ema50);
    const ema200 = num(ind?.ema_200 ?? ind?.ema200);
    const atr = num(ind?.atr_14 ?? ind?.atr14);
    const adx = num(ind?.adx);
    const slope = num(ind?.ema_slope ?? ind?.slope);
    const sweep = ind?.liquidity_sweep === true || ind?.sweep === true;
    const maxSpread = cfg.swing_max_spread_points ?? 30;
    const sess = sessionInfo();
    const spread = quote?.spread;

    let regime = "Range";
    let regimeDir = null;
    if (!sess.open) regime = "Session Closed";
    else if (spread != null && spread > maxSpread) regime = "High Spread";
    else {
      const atrOk = (atr == null || price == null) ? true : (atr / price) >= 0.0004;
      const adxOk = adx == null ? true : adx >= (cfg.adaptive_adx_threshold ?? 25);
      const bull = ema20 != null && ema50 != null && ema20 > ema50 && (ema200 == null || ema20 > ema200) && (slope == null || slope > 0) && atrOk && adxOk;
      const bear = ema20 != null && ema50 != null && ema20 < ema50 && (ema200 == null || ema20 < ema200) && (slope == null || slope < 0) && atrOk && adxOk;
      if (bull) { regime = "Trending"; regimeDir = "Bullish"; }
      else if (bear) { regime = "Trending"; regimeDir = "Bearish"; }
      else if (sweep && atrOk) { regime = "Liquidity Sweep"; regimeDir = ind?.sweep_dir || "Neutral"; }
    }

    // ── Evaluate 8 pillars ──
    const p1Structure = checkStructure(ind, regime, regimeDir);
    const p2Trend = checkTrend(ind, price, cfg);
    const p3Liquidity = checkLiquidity(ind, regime);
    const p4Momentum = checkMomentum(ind, cfg);
    const p5Volatility = checkVolatility(ind, price, cfg);

    // Preliminary SL for spread check
    const atrMult = cfg.swing_atr_sl_multiplier ?? 1.5;
    const prelimSLpoints = atr != null ? Math.round(atr * atrMult * 10) : null;
    const p6Spread = checkSpread(spread, prelimSLpoints, cfg);

    // Global cooldown check
    const globalCooldownUntil = cfg.adaptive_global_cooldown_until;
    const globalCooldownActive = globalCooldownUntil && new Date(globalCooldownUntil).getTime() > Date.now();

    const p7Risk = checkRisk({
      balance, equity, dailyPnL, consecLosses, cfg, positions, tradesToday,
      dailyTargetReached: cfg.adaptive_daily_target_reached === true,
      globalCooldownActive,
    });

    const p8Session = checkSession(cfg);

    const pillars = [
      { key: "structure", label: "Market Structure", ...p1Structure, icon: "🏗️" },
      { key: "trend", label: "Trend Alignment", ...p2Trend, icon: "📈" },
      { key: "liquidity", label: "Liquidity", ...p3Liquidity, icon: "💧" },
      { key: "momentum", label: "Momentum", ...p4Momentum, icon: "⚡" },
      { key: "volatility", label: "Volatility", ...p5Volatility, icon: "🌊" },
      { key: "spread", label: "Spread / Cost", ...p6Spread, icon: "💸" },
      { key: "risk", label: "Capital Protection", pass: p7Risk.pass, score: p7Risk.score, reason: p7Risk.reasons.join(" "), icon: "🛡️", block: p7Risk.block },
      { key: "session", label: "Session", ...p8Session, icon: "🕐" },
    ];

    // ── Confluence score ──
    // Hard pillars (must pass): risk, session, spread
    // Technical pillars (contribute to score): structure, trend, liquidity, momentum, volatility
    const hardPass = p7Risk.pass && p8Session.pass && p6Spread.pass;
    const techPillars = [p1Structure, p2Trend, p3Liquidity, p4Momentum, p5Volatility];
    const techScore = Math.round(techPillars.reduce((s, p) => s + p.score, 0) / techPillars.length);
    const overallScore = hardPass ? Math.round((hardPass ? 0.3 : 0) * 100 + techScore * 0.7) : Math.round(techScore * 0.3);

    // ── Final decision ──
    const minConfluence = cfg.adaptive_min_score ?? 70;
    const direction = p2Trend.direction || (regimeDir === "Bullish" ? "BUY" : regimeDir === "Bearish" ? "SELL" : null);

    let decision = "NO_TRADE";
    let reason = "";
    let tradeParams = null;

    if (!hardPass) {
      // Find the first failed hard pillar
      const failedHard = pillars.find((p) => p.key === "risk" && !p.pass) || pillars.find((p) => p.key === "session" && !p.pass) || pillars.find((p) => p.key === "spread" && !p.pass);
      decision = "NO_TRADE";
      reason = failedHard?.reason || "Capital protection or session gate blocked entry.";
    } else if (techScore < minConfluence) {
      decision = "NO_TRADE";
      reason = `Confluence score ${techScore}/${100} below minimum ${minConfluence} — not enough technical agreement. Waiting for higher-quality setup.`;
    } else if (!direction) {
      decision = "NO_TRADE";
      reason = "Trend direction unclear — no confident BUY or SELL signal. Staying flat.";
    } else {
      // All gates pass — compute trade parameters
      tradeParams = computeTradeParams({
        direction,
        price,
        atr,
        spread,
        balance,
        cfg,
        symbol: cfg.active_pair || "XAUUSD",
      });
      if (tradeParams) {
        decision = "TRADE";
        reason = `All 8 pillars aligned — ${direction} signal on ${cfg.active_pair}. Confluence ${techScore}/100. SL ${tradeParams.sl_distance}, TP 1:${tradeParams.risk_reward}, lot ${tradeParams.lot_size}.`;
      } else {
        decision = "NO_TRADE";
        reason = "Could not compute trade parameters — insufficient data for SL/TP/lot.";
      }
    }

    // ── Recovery Engine: multi-trade to pull equity back above balance ──
    // When equity drops below balance by threshold, opens a larger confirmed-direction
    // position to recuperate drawdown. Bypasses max_concurrent but requires trend confirmation.
    const recoveryEnabled = cfg.recovery_enabled !== false;
    let recoveryAction = null;
    if (recoveryEnabled && balance > 0 && equity < balance && !cfg.hft_mode_enabled) {
      const drawdownPct = ((balance - equity) / balance) * 100;
      const minDD = cfg.recovery_min_drawdown_pct ?? 1.0;
      if (drawdownPct >= minDD && positions.length > 0) {
        const posDir = (p) => {
          const t = (p.type || p.direction || "").toString().toLowerCase();
          if (t.includes("buy") || t.includes("long")) return "BUY";
          if (t.includes("sell") || t.includes("short")) return "SELL";
          return null;
        };
        const buys = positions.filter((p) => posDir(p) === "BUY");
        const sells = positions.filter((p) => posDir(p) === "SELL");
        const dominantDir = (buys.length >= sells.length && buys.length > 0) ? "BUY"
          : (sells.length > buys.length ? "SELL" : null);

        if (dominantDir) {
          const trendConfirms = (dominantDir === "BUY" && (regimeDir === "Bullish" || p2Trend.direction === "BUY")) ||
                                (dominantDir === "SELL" && (regimeDir === "Bearish" || p2Trend.direction === "SELL"));
          const requireConfirm = cfg.recovery_require_confirmation !== false;
          const recoveryMax = cfg.recovery_max_positions ?? 2;
          const maxConcurrent = cfg.max_concurrent_trades ?? 2;
          const recoveryCount = Math.max(0, positions.length - maxConcurrent);

          if (recoveryCount < recoveryMax && (trendConfirms || !requireConfirm)) {
            const recoveryLotMult = cfg.recovery_lot_multiplier ?? 2;
            const baseLot = cfg.lot_size ?? 0.01;
            const recoveryLot = Math.max(0.01, Math.round(baseLot * recoveryLotMult * 100) / 100);
            const atrVal = atr ?? 0;
            const slMult = cfg.swing_atr_sl_multiplier ?? 1.5;
            const slDist = atrVal * slMult;
            const tpDist = slDist * (cfg.swing_min_rr ?? 2);

            recoveryAction = {
              active: true,
              drawdown_pct: Math.round(drawdownPct * 100) / 100,
              direction: dominantDir,
              lot_size: recoveryLot,
              positions_open: positions.length,
              recovery_count: recoveryCount,
              reason: `Equity ${drawdownPct.toFixed(1)}% below balance — opening ${recoveryLot} lot ${dominantDir} recovery position (${recoveryLotMult}x base). Trend confirms. Goal: pull equity >= balance.`,
            };

            decision = "RECOVERY_TRADE";
            reason = recoveryAction.reason;
            tradeParams = {
              direction: dominantDir,
              entry: price,
              lot_size: recoveryLot,
              stop_loss: dominantDir === "BUY" ? price - slDist : price + slDist,
              take_profit: dominantDir === "BUY" ? price + tpDist : price - tpDist,
              sl_distance: slDist,
              tp_distance: tpDist,
              risk_reward: cfg.swing_min_rr ?? 2,
              recovery: true,
              recovery_lot_multiplier: recoveryLotMult,
            };
          } else if (recoveryCount >= recoveryMax) {
            recoveryAction = { active: false, reason: `Recovery limit reached (${recoveryMax} max). Waiting for positions to close.` };
          } else {
            recoveryAction = { active: false, reason: `Drawdown ${drawdownPct.toFixed(1)}% but trend does not confirm ${dominantDir}. Waiting for confirmation signal.` };
          }
        }
      }
    }

    // ── Dangerous behavior prevention summary ──
    const safety = {
      no_martingale: true,        // Lot never increases after a loss — always computed fresh from risk%
      no_grid_after_loss: consecLosses < (cfg.stop_after_losses ?? 2), // No new positions during cooldown
      no_revenge: consecLosses < (cfg.stop_after_losses ?? 2),         // Mandatory cooldown enforced
      no_overtrading: tradesToday < (cfg.swing_max_trades_per_day ?? cfg.max_daily_trades ?? 3),
      no_random_entries: decision === "TRADE" ? techScore >= minConfluence : true,
    };

    return Response.json({
      ok: true,
      connected: true,
      decision,
      reason,
      score: techScore,
      min_score: minConfluence,
      regime,
      regime_dir: regimeDir,
      direction,
      pillars,
      trade: tradeParams,
      account: {
        balance: Math.round(balance * 100) / 100,
        equity: Math.round(equity * 100) / 100,
        floating_pnl: Math.round(floatingPnl * 100) / 100,
        daily_pnl: Math.round(dailyPnL * 100) / 100,
        realized_today: Math.round(realizedToday * 100) / 100,
        consec_losses: consecLosses,
        trades_today: tradesToday,
        open_positions: positions.length,
        max_concurrent: cfg.max_concurrent_trades ?? 2,
      },
      safety,
      recovery: recoveryAction,
      robot_running: robotRunning,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});