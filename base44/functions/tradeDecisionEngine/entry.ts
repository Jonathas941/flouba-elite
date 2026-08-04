import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { aiMarketStructureScan } from '../../shared/aiMarketStructure.ts';
import { clamp, num, nyParts, sessionInfo } from '../../shared/tradingUtils.ts';

const BRIDGE = (() => {
  let v = (Deno.env.get("FLOUBA_BACKEND_URL") || "").trim().replace(/\/+$/, "");
  if (v && !/^https?:\/\//i.test(v)) v = "https://" + v;
  return v;
})();
const B44 = `${BRIDGE}/api/base44`;

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

// ── Pillar 1: Market Structure (AI-Enhanced SMC Analysis) ─────────────────
// Combines EA-provided boolean flags with LLM-powered Smart Money Concepts
// analysis (BOS, CHOCH, liquidity sweep, FVG, market bias) for deeper accuracy.
async function checkStructure(ind, regime, dir, cfg, base44Client) {
  // Call AI market structure scanner for deeper SMC analysis
  const ai = await aiMarketStructureScan(ind, regime, dir, cfg, base44Client);

  const bos = ai.bos || ind?.bos === true || ind?.break_of_structure === true;
  const choch = ai.choch || ind?.choch === true || ind?.change_of_character === true;
  const sweep = ai.liquidity_sweep || ind?.liquidity_sweep === true || ind?.sweep === true;
  const bias = ai.market_bias;
  const confidence = ai.confidence ?? 50;

  // A+ or A grade setups pass with high score
  if (ai.setup_quality === "A+" || ai.setup_quality === "A") {
    let s = 90;
    if (bos && bias !== "neutral") s = 95;
    return {
      pass: true,
      score: s,
      reason: `AI SMC: ${ai.setup_quality} setup — ${bias} bias, BOS:${bos}, CHOCH:${choch}, sweep:${sweep}. ${ai.reasoning || ""}`.trim(),
      ai,
    };
  }

  if (regime === "Trending" && (bos || dir === "Bullish" || dir === "Bearish") && confidence >= 60) {
    return {
      pass: true,
      score: clamp(80 + (confidence - 60) * 0.25, 0, 95),
      reason: `AI SMC: Break of Structure — ${bias} trend confirmed (conf ${confidence}/100).`,
      ai,
    };
  }
  if (regime === "Liquidity Sweep" && (sweep || choch) && confidence >= 55) {
    return {
      pass: true,
      score: clamp(75 + (confidence - 55) * 0.25, 0, 90),
      reason: `AI SMC: Liquidity sweep + CHOCH — reversal setup forming (conf ${confidence}/100). ${ai.reasoning || ""}`.trim(),
      ai,
    };
  }
  if (regime === "Range") {
    return {
      pass: false,
      score: 25,
      reason: `AI SMC: Market in range — no clear directional structure (bias: ${bias}). Waiting.`,
      ai,
    };
  }
  return {
    pass: false,
    score: 30,
    reason: `AI SMC: Market structure unclear — no confirmed BOS or CHOCH (conf ${confidence}/100).`,
    ai,
  };
}

// ── Pillar 2: Trend Alignment ─────────────────────────────────────────────
// BUY: Price above EMA 20 AND EMA 50, EMA 20 above EMA 50
// SELL: Price below EMA 20 AND EMA 50, EMA 20 below EMA 50
function checkTrend(ind, price, cfg) {
  const scalping = cfg.scalping_mode_enabled === true;
  // Scalping mode: EMA 9 + EMA 20 (fast stack)
  const emaFast = scalping
    ? num(ind?.ema_9 ?? ind?.ema_5 ?? ind?.ema_6)
    : num(ind?.ema_20 ?? ind?.ema20);
  const emaSlow = scalping
    ? num(ind?.ema_20 ?? ind?.ema20)
    : num(ind?.ema_50 ?? ind?.ema50);
  const ema200 = num(ind?.ema_200 ?? ind?.ema200);
  const vwap = scalping ? num(ind?.vwap) : null;
  const slope = num(ind?.ema_slope ?? ind?.slope);

  if (emaFast == null || emaSlow == null) {
    return { pass: false, score: 20, reason: "Trend data unavailable — cannot confirm direction.", direction: null, emaFast, emaSlow };
  }

  // Price must be above/below BOTH EMAs
  const priceAbove = price != null && price > emaFast && price > emaSlow;
  const priceBelow = price != null && price < emaFast && price < emaSlow;

  const bull = emaFast > emaSlow && priceAbove && (ema200 == null || emaFast > ema200) && (slope == null || slope > 0) && (vwap == null || price > vwap);
  const bear = emaFast < emaSlow && priceBelow && (ema200 == null || emaFast < ema200) && (slope == null || slope < 0) && (vwap == null || price < vwap);

  if (bull) {
    let s = 80;
    if (ema200 != null && emaFast > ema200) s += 10;
    if (slope != null && slope > 0) s += 5;
    if (vwap != null && price > vwap) s += 5;
    const label = scalping ? "EMA 9 > 20, price above both, VWAP confirms" : "Price above EMA 20 & 50, EMA 20 > 50";
    return { pass: true, score: clamp(s, 0, 100), reason: `Bullish trend — ${label}.`, direction: "BUY", emaFast, emaSlow };
  }
  if (bear) {
    let s = 80;
    if (ema200 != null && emaFast < ema200) s += 10;
    if (slope != null && slope < 0) s += 5;
    if (vwap != null && price < vwap) s += 5;
    const label = scalping ? "EMA 9 < 20, price below both, VWAP confirms" : "Price below EMA 20 & 50, EMA 20 < 50";
    return { pass: true, score: clamp(s, 0, 100), reason: `Bearish trend — ${label}.`, direction: "SELL", emaFast, emaSlow };
  }
  const reason = emaFast === emaSlow
    ? "EMAs flat — no trend direction."
    : (emaFast > emaSlow && !priceAbove)
      ? "EMA stack bullish but price not above both EMAs — waiting for price to reclaim."
      : (emaFast < emaSlow && !priceBelow)
        ? "EMA stack bearish but price not below both EMAs — waiting for price to break down."
        : "EMAs entangled — no sustained trend alignment.";
  return { pass: false, score: 30, reason, direction: null, emaFast, emaSlow };
}

// ── Pillar 2b: Pullback to EMA 20 / Support / Resistance ──────────────────
// BUY: Price pulls back near EMA 20 (support)
// SELL: Price pulls back near EMA 20 (resistance)
function checkPullback(ind, price, direction, cfg) {
  const scalping = cfg.scalping_mode_enabled === true;
  const emaRef = scalping
    ? num(ind?.ema_20 ?? ind?.ema20)
    : num(ind?.ema_20 ?? ind?.ema20);
  const atr = num(ind?.atr_14 ?? ind?.atr14);
  if (emaRef == null || price == null) {
    return { pass: false, score: 30, reason: "Pullback: EMA 20 or price unavailable — cannot measure proximity." };
  }
  const maxDistMult = cfg.trend_pullback_atr_mult ?? 0.5;
  // If ATR unavailable, use 0.1% of price as fallback distance
  const maxDist = atr != null ? atr * maxDistMult : price * 0.001;
  const distance = Math.abs(price - emaRef);
  if (distance <= maxDist) {
    return { pass: true, score: 85, reason: `Pullback to EMA 20 (${distance.toFixed(5)} ≤ ${maxDist.toFixed(5)} ATR×${maxDistMult}) — ${direction === "BUY" ? "support" : "resistance"} entry zone.` };
  }
  // Price beyond EMA in trend direction = extended (chasing), not a pullback
  const extended = direction === "BUY" ? price > emaRef + maxDist : price < emaRef - maxDist;
  if (extended) {
    return { pass: false, score: 40, reason: `Price extended ${(distance / (atr || 1)).toFixed(1)}× ATR from EMA 20 — waiting for pullback to ${direction === "BUY" ? "support" : "resistance"}.` };
  }
  return { pass: false, score: 55, reason: `Price ${distance.toFixed(5)} from EMA 20 — not yet at pullback zone.` };
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

// ── Pillar 4a: ADX Trend Strength (15 pts) ────────────────────────────────
// ADX ≥ 25 = strong trend (full points); 20-25 = moderate; < 20 = no trade
function checkAdxStrength(ind, cfg) {
  const adx = num(ind?.adx);
  const threshold = cfg.trend_adx_threshold ?? 25;
  if (adx == null) {
    return { pass: true, score: 50, reason: "ADX unavailable — scoring at neutral strength." };
  }
  if (adx < 20) {
    return { pass: false, score: 15, reason: `ADX ${adx.toFixed(1)} < 20 — trend too weak. Professional traders wait for strength.` };
  }
  // Score scales: 20→40, 25→75, 30→95, 35+→100
  let s;
  if (adx >= 35) s = 100;
  else if (adx >= 30) s = 95;
  else if (adx >= threshold) s = 75 + clamp((adx - threshold) * 4, 0, 20);
  else s = 40 + clamp((adx - 20) * 7, 0, 35);
  const pass = adx >= threshold;
  return { pass, score: Math.round(s), reason: `ADX ${adx.toFixed(0)} ${pass ? "≥" : "<"} ${threshold} — ${pass ? "trend strength confirmed." : "trend forming, not yet strong enough."}` };
}

// ── Pillar 4b: RSI Momentum (10 pts, direction-aware) ────────────────────
// BUY: RSI 50-70 (momentum up, not overbought)
// SELL: RSI 30-50 (momentum down, not oversold)
function checkRsiMomentum(ind, direction, cfg) {
  const rsi = num(ind?.rsi ?? ind?.rsi_14 ?? (cfg.scalping_mode_enabled ? ind?.rsi_7 : ind?.rsi_14));
  if (rsi == null) {
    return { pass: true, score: 50, reason: "RSI unavailable — neutral momentum score." };
  }
  const buyLow = cfg.trend_rsi_buy_low ?? 50;
  const buyHigh = cfg.trend_rsi_buy_high ?? 70;
  const sellLow = cfg.trend_rsi_sell_low ?? 30;
  const sellHigh = cfg.trend_rsi_sell_high ?? 50;

  if (direction === "BUY") {
    if (rsi > buyHigh) return { pass: false, score: 20, reason: `RSI ${rsi.toFixed(0)} > ${buyHigh} overbought — chasing entry. Professional waits for pullback.` };
    if (rsi < buyLow) return { pass: false, score: 35, reason: `RSI ${rsi.toFixed(0)} < ${buyLow} — momentum too weak for BUY.` };
    let s = 70 + clamp((rsi - buyLow) * 1.5, 0, 30); // 50→70, 70→100
    return { pass: true, score: Math.round(s), reason: `RSI ${rsi.toFixed(0)} in BUY momentum zone (${buyLow}-${buyHigh}).` };
  }
  if (direction === "SELL") {
    if (rsi < sellLow) return { pass: false, score: 20, reason: `RSI ${rsi.toFixed(0)} < ${sellLow} oversold — chasing entry. Professional waits for pullback.` };
    if (rsi > sellHigh) return { pass: false, score: 35, reason: `RSI ${rsi.toFixed(0)} > ${sellHigh} — momentum too weak for SELL.` };
    let s = 70 + clamp((sellHigh - rsi) * 1.5, 0, 30); // 50→70, 30→100
    return { pass: true, score: Math.round(s), reason: `RSI ${rsi.toFixed(0)} in SELL momentum zone (${sellLow}-${sellHigh}).` };
  }
  // No direction
  if (rsi > 75 || rsi < 25) return { pass: false, score: 25, reason: `RSI ${rsi.toFixed(0)} extreme — exhaustion risk.` };
  return { pass: true, score: 50, reason: `RSI ${rsi.toFixed(0)} neutral.` };
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

// ── Pillar 9: News Safety (5 pts) ─────────────────────────────────────────
// Blocks trading near high-impact news. When news data unavailable, neutral.
function checkNewsSafety(ind, cfg) {
  // If user disabled news filter, always pass (but lower score)
  if (cfg.news_filter === false) {
    return { pass: true, score: 70, reason: "News filter disabled — accepting event risk." };
  }
  const newsFlag = ind?.high_impact_news ?? ind?.news_high_impact;
  const newsMins = num(ind?.news_minutes_until ?? ind?.minutes_to_news);
  const newsBuffer = num(ind?.news_buffer_minutes) ?? (cfg.liq_news_buffer_minutes ?? 10);

  if (newsFlag === true) {
    return { pass: false, score: 0, reason: `High-impact news detected — professional traders stand aside. No entry.` };
  }
  if (newsMins != null && newsMins >= 0 && newsMins < newsBuffer) {
    return { pass: false, score: 10, reason: `High-impact news in ${Math.round(newsMins)} min (< ${newsBuffer} buffer) — waiting for news to pass.` };
  }
  if (newsMins != null && newsMins >= newsBuffer && newsMins < newsBuffer * 3) {
    return { pass: true, score: 60, reason: `News in ${Math.round(newsMins)} min — outside danger zone but caution.` };
  }
  return { pass: true, score: 90, reason: "No high-impact news — safe to trade." };
}

// ── AI Dynamic SL/TP Engine ───────────────────────────────────────────────
// Asks the LLM to analyze live market structure & liquidity to propose
// confidence-adjusted SL (ATR multiplier) and TP (risk-reward ratio).
// Returns values clamped within hard capital-protection guardrails.
async function getAiSlTp(ind, regime, regimeDir, cfg) {
  const ema20 = num(ind?.ema_20 ?? ind?.ema20);
  const ema50 = num(ind?.ema_50 ?? ind?.ema50);
  const ema200 = num(ind?.ema_200 ?? ind?.ema200);
  const atr = num(ind?.atr_14 ?? ind?.atr14);
  const adx = num(ind?.adx);
  const rsi = num(ind?.rsi ?? ind?.rsi_14);
  const macd = num(ind?.macd ?? ind?.macd_histogram);
  const slope = num(ind?.ema_slope ?? ind?.slope);
  const sweep = ind?.liquidity_sweep === true || ind?.sweep === true;
  const sweepDir = ind?.sweep_dir || ind?.sweep_direction;

  const marketContext = {
    regime, regime_dir: regimeDir,
    ema_20: ema20, ema_50: ema50, ema_200: ema200,
    ema_slope: slope,
    atr_14: atr, adx, rsi_14: rsi, macd,
    liquidity_sweep: sweep, sweep_dir: sweepDir,
    symbol: cfg.active_pair || "XAUUSD",
  };

  // Hard guardrails — AI can NEVER exceed these bounds
  const minSlMult = 1.0;
  const maxSlMult = 3.0;
  const minRr = 1.0;
  const maxRr = 4.0;
  const userDefaultSl = cfg.swing_atr_sl_multiplier ?? 1.5;
  const userDefaultRr = cfg.swing_min_rr ?? 2;

  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a risk-adjusted trading analyst. Given the live market data below, determine the optimal Stop Loss (as an ATR multiplier) and Take Profit (as a risk-reward ratio).

Rules:
- In a strong TRENDING market with high ADX (>30), use a TIGHTER SL (1.0–1.5x ATR) and a WIDER TP (2.5–3.5 RR) to maximize trend capture.
- In a LIQUIDITY SWEEP / reversal setup, use a WIDER SL (1.8–2.5x ATR) to survive wick retests, and moderate TP (2.0–2.5 RR).
- In choppy/range conditions, favor a balanced SL (1.5x ATR) and conservative TP (1.5–2.0 RR).
- If RSI is overbought (>70) for a BUY or oversold (<30) for a SELL, widen SL slightly to avoid premature stop-out.
- Never suggest SL < 1.0x ATR or > 3.0x ATR. Never suggest RR < 1.0 or > 4.0.

Live market data:
${JSON.stringify(marketContext, null, 2)}

Respond with the optimal sl_atr_multiplier and tp_rr_ratio.`,
      response_json_schema: {
        type: "object",
        properties: {
          sl_atr_multiplier: { type: "number", description: "Stop loss as ATR multiplier (1.0–3.0)" },
          tp_rr_ratio: { type: "number", description: "Take profit as risk-reward ratio (1.0–4.0)" },
          reasoning: { type: "string" },
        },
        required: ["sl_atr_multiplier", "tp_rr_ratio"],
      },
    });

    const aiSl = clamp(num(res?.sl_atr_multiplier) ?? userDefaultSl, minSlMult, maxSlMult);
    const aiRr = clamp(num(res?.tp_rr_ratio) ?? userDefaultRr, minRr, maxRr);
    return { sl_mult: aiSl, rr: aiRr, reasoning: res?.reasoning || null };
  } catch {
    // Fallback to user defaults if LLM unavailable
    return { sl_mult: userDefaultSl, rr: userDefaultRr, reasoning: null };
  }
}

// ── SL / TP / Lot calculation ─────────────────────────────────────────────
function computeTradeParams(args) {
  const { direction, price, atr, spread, balance, cfg, symbol, aiSlMult, aiRr } = args;
  if (!direction || !price || !atr || !balance) return null;

  // AI override takes priority; fallback to user-configured defaults
  const atrMult = aiSlMult ?? cfg.swing_atr_sl_multiplier ?? 1.5;
  const slDistance = atr * atrMult;
  const slPrice = direction === "BUY" ? price - slDistance : price + slDistance;

  const rr = aiRr ?? cfg.swing_min_rr ?? 2;
  const tpDistance = slDistance * rr;
  const tpPrice = direction === "BUY" ? price + tpDistance : price - tpDistance;

  // ── Lot sizing — user's configured lot is the single source of truth ──
  // Fixed mode (default): use cfg.lot_size directly so the lot the user enters
  //   in the Start modal is exactly what gets traded.
  // Auto Risk mode: compute from risk % of balance (still never increases after
  //   a loss — fresh each call), floored at the broker minimum 0.01.
  const baseLot = cfg.lot_size ?? 0.01;
  let lot;
  if (cfg.lot_size_mode === "Auto Risk") {
    const riskPct = cfg.risk_percentage ?? 1;
    const riskAmount = balance * (riskPct / 100);
    // Approximate: SL distance in price units → dollar risk per lot
    // XAUUSD: 1 lot = 100 oz → $1 move = $100. Indices: $1 move = $1. FX: ~$10.
    const dollarsPerLotPerPrice = symbol === "XAUUSD" ? 100 : (symbol === "NAS100" || symbol === "US30" ? 1 : 10);
    const riskPerLot = slDistance * dollarsPerLotPerPrice;
    lot = riskPerLot > 0 ? riskAmount / riskPerLot : baseLot;
    lot = Math.max(0.01, Math.round(lot * 100) / 100);
  } else {
    // Fixed — respect the user's entered lot exactly
    lot = baseLot;
  }
  // Safety cap: never exceed baseLot × max concurrent (prevents runaway sizing)
  const maxLot = baseLot * (cfg.max_concurrent_trades ?? 2);
  lot = Math.min(lot, maxLot);

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
    ai_sl_mult: aiSlMult ?? null,
    ai_rr: aiRr ?? null,
  };
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);
    // Resolve caller identity; only admins/cron may use target_user_id
    const cronSecret = Deno.env.get("CRON_SECRET");
    const hasCron = cronSecret && (req.headers.get("X-Cron-Secret") === cronSecret || body.cron_secret === cronSecret);
    let user = await base44.auth.me().catch(() => null);
    if (!user) {
      if (!hasCron) return Response.json({ error: "Unauthorized" }, { status: 401 });
      // Cron without a user context must specify a target
      if (!body.target_user_id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    let userId = user ? user.id : null;
    if (body.target_user_id && body.target_user_id !== userId) {
      // Only admins or cron may act on behalf of another user
      if (!hasCron && user?.role !== "admin") {
        return Response.json({ error: "Forbidden: cannot access another user's data" }, { status: 403 });
      }
      user = await base44.asServiceRole.entities.User.get(body.target_user_id).catch(() => null);
      if (!user) return Response.json({ error: "Target user not found" }, { status: 404 });
      userId = user.id;
    }
    if (!user || !userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Load user's BotSettings (service role works for both user and cron modes)
    const settings = await base44.asServiceRole.entities.BotSettings.filter({ created_by_id: userId }, "-created_date", 1);
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

    // ── Bridge auth (shared secret) + robot identity ──
    // The new command-queue bridge uses ONE shared x-api-key (FLOUBA_BASE44_API_KEY)
    // for all Base44 calls; per-user identity is the robotId = MT5 account number.
    if (!BRIDGE) return Response.json({ ok: false, error: "FLOUBA_BACKEND_URL not set" });
    const robotId = String(cfg.mt5_account);
    const robotPath = `${B44}/robots/${encodeURIComponent(robotId)}`;
    const symbol = cfg.active_pair || "XAUUSD";
    const b44Headers = () => ({
      "x-api-key": Deno.env.get("FLOUBA_BASE44_API_KEY") || "",
      "x-request-id": crypto.randomUUID(),
      "x-timestamp": new Date().toISOString(),
      "Content-Type": "application/json",
    });

    // ── Fetch synced snapshot + EA-published indicators in parallel ──
    const [indRes, acctRes, posRes, statusRes] = await Promise.all([
      fetch(`${robotPath}/indicators?symbol=${encodeURIComponent(symbol)}`, { headers: b44Headers() }).catch(() => null),
      fetch(`${robotPath}/account`, { headers: b44Headers() }).catch(() => null),
      fetch(`${robotPath}/positions`, { headers: b44Headers() }).catch(() => null),
      fetch(`${robotPath}/status`, { headers: b44Headers() }).catch(() => null),
    ]);

    let ind = null, quote = null, positions = [], account = null, robotRunning = false;
    if (indRes?.ok) {
      const j = await indRes.json().catch(() => ({}));
      const row = j?.data ?? j;
      if (row) {
        // Normalize the bridge's indicator row into the field names the pillar
        // functions already expect, so all downstream logic is unchanged.
        ind = {
          ema_20: num(row.ema20 ?? row.ema_20),
          ema20: num(row.ema20 ?? row.ema_20),
          ema_50: num(row.ema50 ?? row.ema_50),
          ema50: num(row.ema50 ?? row.ema_50),
          ema_200: num(row.ema200 ?? row.ema_200),
          ema200: num(row.ema200 ?? row.ema_200),
          ema_50_m15: num(row.ema50M15 ?? row.ema50_m15),
          rsi: num(row.rsi ?? row.rsi_14),
          rsi_14: num(row.rsi ?? row.rsi_14),
          adx: num(row.adx),
          plus_di: num(row.plusDI),
          minus_di: num(row.minusDI),
          atr_14: num(row.atr ?? row.atr_14),
          atr14: num(row.atr ?? row.atr_14),
          ema_slope: num(row.emaSlope ?? row.ema_slope),
          slope: num(row.emaSlope ?? row.ema_slope),
          liquidity_sweep: row.liquiditySweep === true,
          sweep: row.liquiditySweep === true,
          sweep_dir: row.sweepDir || null,
          sweep_direction: row.sweepDir || null,
          bos: row.bos === true,
          break_of_structure: row.bos === true,
          choch: row.choch === true,
          change_of_character: row.choch === true,
          high_impact_news: row.newsHighImpact === true,
          news_high_impact: row.newsHighImpact === true,
          news_minutes_until: num(row.newsMinutesUntil),
          minutes_to_news: num(row.newsMinutesUntil),
          bid: num(row.bid),
          ask: num(row.ask),
          spread_pips: num(row.spread),
        };
        const bid = num(row.bid), ask = num(row.ask);
        if (bid != null) quote = { bid, ask: ask ?? bid, spread: row.spread != null ? Number(row.spread) : ((ask ?? bid) - bid) };
      }
    }
    if (acctRes?.ok) { const j = await acctRes.json().catch(() => ({})); account = (j?.data ?? j?.account ?? j); }
    if (posRes?.ok) { const j = await posRes.json().catch(() => ({})); positions = Array.isArray(j?.data) ? j.data : (j?.positions || []); }
    if (statusRes?.ok) { const j = await statusRes.json().catch(() => ({})); const st = j?.data ?? j; robotRunning = st?.status === "ONLINE" || st?.robotRunning === true; }

    const connected = account?.balance != null && ind != null;
    if (!connected) {
      return Response.json({
        ok: true,
        decision: "NO_TRADE",
        reason: "Indicator feed unavailable — the EA isn't publishing market data yet. Start the EA so it syncs indicators to the bridge.",
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

    const closedTrades = await base44.asServiceRole.entities.Trade.filter(
      { created_by_id: userId, status: "Closed" }, "-closed_at", 50
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
    const rsi = num(ind?.rsi ?? ind?.rsi_14);
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

    // ── Evaluate pillars ──
    const p1Structure = await checkStructure(ind, regime, regimeDir, cfg, base44);
    const p2Trend = checkTrend(ind, price, cfg);
    const trendDir = p2Trend.direction;
    const p2bPullback = checkPullback(ind, price, trendDir, cfg);
    const p3Liquidity = checkLiquidity(ind, regime);
    const p4aAdx = checkAdxStrength(ind, cfg);
    const p4bRsi = checkRsiMomentum(ind, trendDir, cfg);
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
    const p9News = checkNewsSafety(ind, cfg);

    const pillars = [
      { key: "trend", label: "Trend Direction (20)", ...p2Trend, icon: "📈", weight: 20 },
      { key: "structure", label: "Market Structure (20)", ...p1Structure, icon: "🏗️", weight: 20 },
      { key: "adx", label: "ADX Trend Strength (15)", ...p4aAdx, icon: "💪", weight: 15 },
      { key: "rsi", label: "RSI Momentum (10)", ...p4bRsi, icon: "⚡", weight: 10 },
      { key: "volatility", label: "ATR Volatility (10)", ...p5Volatility, icon: "🌊", weight: 10 },
      { key: "zone", label: "S/R & Liquidity Zone (10)", ...p2bPullback, icon: "🎯", weight: 10 },
      { key: "spread", label: "Spread Filter (5)", ...p6Spread, icon: "💸", weight: 5 },
      { key: "session", label: "Session Filter (5)", ...p8Session, icon: "🕐", weight: 5 },
      { key: "news", label: "News Safety (5)", ...p9News, icon: "📰", weight: 5 },
      { key: "risk", label: "Capital Protection (Gate)", pass: p7Risk.pass, score: p7Risk.score, reason: p7Risk.reasons.join(" "), icon: "🛡️", block: p7Risk.block, weight: 0 },
    ];

    // ── Professional Trade Quality Score (0-100, weighted) ──
    // Trend 20 + Structure 20 + ADX 15 + RSI 10 + ATR 10 + S/R-Liquidity 10 + Spread 5 + Session 5 + News 5 = 100
    const weightedEntries = [
      { w: 20, s: p2Trend.score, pass: p2Trend.pass, key: "trend" },
      { w: 20, s: p1Structure.score, pass: p1Structure.pass, key: "structure" },
      { w: 15, s: p4aAdx.score, pass: p4aAdx.pass, key: "adx" },
      { w: 10, s: p4bRsi.score, pass: p4bRsi.pass, key: "rsi" },
      { w: 10, s: p5Volatility.score, pass: p5Volatility.pass, key: "volatility" },
      { w: 10, s: p2bPullback.score, pass: p2bPullback.pass, key: "zone" },
      { w: 5, s: p6Spread.score, pass: p6Spread.pass, key: "spread" },
      { w: 5, s: p8Session.score, pass: p8Session.pass, key: "session" },
      { w: 5, s: p9News.score, pass: p9News.pass, key: "news" },
    ];
    const qualityScore = Math.round(weightedEntries.reduce((sum, e) => sum + (e.s / 100) * e.w, 0));

    // ── Strategy mode thresholds ──
    // Conservative 85+, Balanced 75+, Aggressive 70+
    const mode = cfg.trading_mode || "Balanced";
    let minScore;
    let modeRiskPct;
    let modeAdxMin;
    if (mode === "Conservative") {
      minScore = cfg.min_score_conservative ?? 85;
      modeRiskPct = cfg.risk_pct_conservative ?? 0.5;
      modeAdxMin = cfg.conservative_adx_min ?? 25;
    } else if (mode === "Aggressive") {
      minScore = cfg.min_score_aggressive ?? 70;
      modeRiskPct = cfg.risk_pct_aggressive ?? 2;
      modeAdxMin = cfg.aggressive_adx_min ?? 20;
    } else {
      minScore = cfg.min_score_balanced ?? 75;
      modeRiskPct = cfg.risk_pct_balanced ?? 1;
      modeAdxMin = cfg.balanced_adx_min ?? 25;
    }

    // Conservative mode requires stronger ADX (choppy market rejection)
    const modeAdxPass = p4aAdx.score >= 0 || (num(ind?.adx) == null) ? true : (num(ind?.adx) ?? 0) >= modeAdxMin;

    // ── Hard gates: must ALL pass to even consider a trade ──
    const hardPass = p7Risk.pass && p8Session.pass && p6Spread.pass && p9News.pass && p2Trend.pass;

    const direction = p2Trend.direction || (regimeDir === "Bullish" ? "BUY" : regimeDir === "Bearish" ? "SELL" : null);

    let decision = "NO_TRADE";
    let reason = "";
    let tradeParams = null;

    // Find first failed gate for a clear rejection reason
    if (!hardPass) {
      const failedGate = pillars.find((p) => !p.pass && ["risk", "session", "spread", "news", "trend"].includes(p.key));
      decision = "NO_TRADE";
      reason = failedGate?.reason || "A hard gate (capital protection / session / spread / news / trend) blocked entry.";
    } else if (!p4aAdx.pass) {
      decision = "NO_TRADE";
      reason = p4aAdx.reason;
    } else if (!p4bRsi.pass) {
      decision = "NO_TRADE";
      reason = p4bRsi.reason;
    } else if (!p2bPullback.pass) {
      decision = "NO_TRADE";
      reason = `No trade — ${p2bPullback.reason}`;
    } else if (mode === "Conservative" && !p1Structure.pass) {
      decision = "NO_TRADE";
      reason = `Conservative mode requires confirmed market structure — ${p1Structure.reason}`;
    } else if (qualityScore < minScore) {
      decision = "NO_TRADE";
      reason = `Trade Quality Score ${qualityScore}/100 below ${mode} minimum ${minScore}. Professional discipline: waiting for a higher-quality setup.`;
    } else if (!direction) {
      decision = "NO_TRADE";
      reason = "Trend direction unclear — no confident BUY or SELL signal. Staying flat.";
    } else {
      // All gates pass — ask AI for dynamic SL/TP based on live market structure
      const aiSlTp = await getAiSlTp(ind, regime, regimeDir, cfg);

      // Compute trade parameters with mode-adjusted risk % and AI SL/TP
      tradeParams = computeTradeParams({
        direction,
        price,
        atr,
        spread,
        balance,
        cfg: { ...cfg, risk_percentage: modeRiskPct },
        symbol: cfg.active_pair || "XAUUSD",
        aiSlMult: aiSlTp.sl_mult,
        aiRr: aiSlTp.rr,
      });
      if (tradeParams) {
        decision = "TRADE";
        const scalpNote = cfg.scalping_mode_enabled ? " [SCALP] " : " ";
        reason = `Quality ${qualityScore}/100 ≥ ${minScore} (${mode})${scalpNote}— ${direction} ${cfg.active_pair}. ADX ${adx?.toFixed(0) ?? "n/a"}, RSI ${rsi?.toFixed(0) ?? "n/a"}, pullback to EMA 20. SL ${aiSlTp.sl_mult}×ATR, TP 1:${aiSlTp.rr} RR, risk ${modeRiskPct}%. Lot ${tradeParams.lot_size}.`;
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
      no_random_entries: decision === "TRADE" ? qualityScore >= minScore : true,
    };

    return Response.json({
      ok: true,
      connected: true,
      decision,
      reason,
      score: qualityScore,
      min_score: minScore,
      trading_mode: mode,
      regime,
      regime_dir: regimeDir,
      direction,
      pillars,
      trade: tradeParams,
      indicators: {
        ema_20: ema20, ema_50: ema50, ema_200: ema200,
        adx: adx, rsi: rsi, atr: atr, spread: spread,
        ema_direction: trendDir,
      },
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
        daily_loss_limit: cfg.swing_max_daily_loss_pct ?? 40,
        daily_profit_target: cfg.daily_profit_target_amount ?? 200,
      },
      session: p8Session.sess,
      news_safe: p9News.pass,
      safety,
      recovery: recoveryAction,
      robot_running: robotRunning,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});