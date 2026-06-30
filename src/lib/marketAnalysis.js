/**
 * Flouba Elite — Multi-Strategy AI Trading Engine
 *
 * Strategy 1: Momentum Scalping   — London + NY, M1/M5, EMA/RSI/ADX/ATR
 * Strategy 2: Range Breakout      — Asian session range, buy/sell stop above/below
 * Strategy 3: Volatility Spike    — ATR spike above rolling average + 20-candle breakout
 * Strategy 4: Hybrid Manual       — Trader presses BUY/SELL, robot manages SL/TP/BE/TS
 *
 * AI Selector decides strategy based on market condition:
 *   Trending      → Momentum Scalping
 *   Consolidating → Range Breakout
 *   Explosive     → Volatility Spike
 *   Manual        → Hybrid
 */

export const PAIRS     = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD"];
export const TIMEFRAMES = ["M1", "M5", "M15", "H1"];

export const MODE_THRESHOLD = { Conservative: 80, Balanced: 65, Aggressive: 55, Normal: 65 };

export const BASE_SPREAD = {
  XAUUSD: 0.18, EURUSD: 0.02, GBPUSD: 0.04, USDJPY: 0.03,
  NAS100: 0.5,  US30: 1.2,    BTCUSD: 8.0,
};

export const MAX_SPREAD = {
  XAUUSD: 0.6, EURUSD: 0.08, GBPUSD: 0.12, USDJPY: 0.1,
  NAS100: 2.0, US30: 4.0,    BTCUSD: 30.0,
};

const MIN_ATR = {
  XAUUSD: 0.4,     EURUSD: 0.00015, GBPUSD: 0.0002, USDJPY: 0.02,
  NAS100: 2.0,     US30: 5.0,       BTCUSD: 80,
};

// ATR spike threshold multiplier for Volatility Spike strategy
const ATR_SPIKE_MULT = 1.6;

// ── Utilities ────────────────────────────────────────────────────────────────

function prng(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function getCurrentSession() {
  const h = new Date().getUTCHours();
  if (h >= 0  && h < 8)  return "Asian";
  if (h >= 8  && h < 12) return "London";
  if (h >= 12 && h < 16) return "London+NY";
  if (h >= 16 && h < 21) return "New York";
  return "Closed";
}

export function isSessionAllowed(allowedSessions, currentSession) {
  if (!allowedSessions || allowedSessions === "All") return true;
  if (currentSession === "Closed") return false;
  const map = {
    "London":    ["London", "London+NY"],
    "New York":  ["New York", "London+NY"],
    "London+NY": ["London+NY"],
    "Asian":     ["Asian"],
  };
  return (map[allowedSessions] || []).includes(currentSession);
}

// ── Market Condition Classifier ──────────────────────────────────────────────

/**
 * Returns: "Trending" | "Consolidating" | "Explosive"
 * Trending    → ADX > 25 and ATR above minimum
 * Explosive   → ATR significantly above rolling average (spike detected)
 * Consolidating → otherwise (low ADX / range-bound)
 */
export function classifyMarketCondition(adx, atrNum, atrAvg, pair) {
  const atrSpike = atrNum > atrAvg * ATR_SPIKE_MULT;
  if (atrSpike) return "Explosive";
  if (adx > 25 && atrNum >= MIN_ATR[pair]) return "Trending";
  return "Consolidating";
}

/**
 * AI Strategy Selector
 * Returns the strategy name the robot should use given current conditions.
 */
export function selectStrategy(condition, manualMode = false) {
  if (manualMode) return "Hybrid Manual";
  if (condition === "Trending")      return "Momentum Scalping";
  if (condition === "Consolidating") return "Range Breakout";
  if (condition === "Explosive")     return "Volatility Spike";
  return "Momentum Scalping";
}

// ── Core Analysis ─────────────────────────────────────────────────────────────

export function computeAnalysis(pair, tf, tick) {
  const base  = pair.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const tfMult = { M1: 7, M5: 17, M15: 37, H1: 71 }[tf] || 7;
  const s = base + tfMult + tick;

  // ── Indicators ──────────────────────────────────────────────────────────────
  const ema20Raw       = prng(s * 1.3);
  const ema50Raw       = prng(s * 1.7);
  const ema20AbovEma50 = ema20Raw > ema50Raw;
  const bullBias       = ema20AbovEma50;
  const direction      = bullBias ? "BUY" : "SELL";

  // RSI 20–80
  const rsi = 20 + prng(s * 3.3) * 60;

  // ADX 15–60
  const adx = 15 + prng(s * 4.1) * 45;

  // ATR
  const atrNum = pair === "XAUUSD"     ? 0.4 + prng(s * 9) * 3.5
    : pair === "NAS100" || pair === "US30" ? 2 + prng(s * 9) * 18
    : pair === "BTCUSD"                ? 60 + prng(s * 9) * 400
    : 0.00010 + prng(s * 9) * 0.0035;

  // Simulated rolling ATR average (slightly lower than current to show spikes)
  const atrAvg = atrNum * (0.7 + prng(s * 2.1) * 0.4);

  const atrVal = pair === "BTCUSD"          ? atrNum.toFixed(0)
    : ["NAS100","US30"].includes(pair)      ? atrNum.toFixed(1)
    : atrNum.toFixed(5);

  const atrAvgVal = pair === "BTCUSD"       ? atrAvg.toFixed(0)
    : ["NAS100","US30"].includes(pair)      ? atrAvg.toFixed(1)
    : atrAvg.toFixed(5);

  // Spread
  const spread = parseFloat((BASE_SPREAD[pair] * (1 + prng(s * 11) * 0.35)).toFixed(
    ["NAS100","US30","BTCUSD"].includes(pair) ? 1 : 2
  ));

  // ── Trend Strength ───────────────────────────────────────────────────────────
  const trendStrength = adx < 20 ? "Weak" : adx < 35 ? "Moderate" : "Strong";

  // ── Condition Gates ──────────────────────────────────────────────────────────
  const rsiOk    = bullBias ? rsi > 55 : rsi < 45;
  const atrOk    = atrNum >= MIN_ATR[pair];
  const adxOk    = adx > 20;
  const spreadOk = spread <= MAX_SPREAD[pair];

  // ── Market Condition & Strategy ──────────────────────────────────────────────
  const marketCondition = classifyMarketCondition(adx, atrNum, atrAvg, pair);
  const strategy = selectStrategy(marketCondition);

  // ── Strategy-specific validity ──────────────────────────────────────────────
  const session = getCurrentSession();

  // Strategy 1 — Momentum Scalping
  const momentumOk = rsiOk && adxOk && atrOk && spreadOk &&
    (["London","London+NY","New York"].includes(session)) &&
    (tf === "M1" || tf === "M5");

  // Strategy 2 — Range Breakout (Asian session setup)
  const rangeBreakoutReady = session === "Asian" && spreadOk;
  const asianHigh = parseFloat((atrNum * 1.2).toFixed(["BTCUSD"].includes(pair) ? 0 : 5));
  const asianLow  = parseFloat((atrNum * 0.8).toFixed(["BTCUSD"].includes(pair) ? 0 : 5));

  // Strategy 3 — Volatility Spike
  const atrSpike         = atrNum > atrAvg * ATR_SPIKE_MULT;
  const price20CandleBreak = prng(s * 7.3) > 0.5; // simulated breakout signal
  const volatilitySpikeOk  = atrSpike && price20CandleBreak && spreadOk;

  // Strategy 4 — Hybrid Manual (always available, driven by user press)
  // isValid for hybrid is set by caller (user action)

  // ── Quality Score ────────────────────────────────────────────────────────────
  const trend_score  = Math.min(20, Math.round((bullBias ? ema20Raw : 1 - ema20Raw) * 22));
  const adx_score    = Math.min(15, Math.round((adx / 60) * 17));
  const rsi_score    = Math.min(10, rsiOk ? Math.round(prng(s * 5.9) * 12) : Math.round(prng(s * 5.9) * 4));
  const atr_score    = Math.min(10, atrOk ? Math.round(prng(s * 4.7) * 12) : 2);
  const mom_score    = Math.min(15, Math.round(prng(s * 2.3) * 17));
  const struct_score = Math.min(15, Math.round(prng(s * 6.3) * 17));
  const sd_score     = Math.min(10, Math.round(prng(s * 7.1) * 12));
  const liq_score    = Math.min(10, Math.round(prng(s * 8.3) * 12));
  // vol_score kept for compatibility
  const vol_score    = Math.min(10, Math.round(prng(s * 3.1) * 12));
  const total = trend_score + adx_score + rsi_score + atr_score + mom_score + struct_score + sd_score + liq_score;

  // SMC
  const bos            = struct_score > 9;
  const choch          = struct_score > 11 && prng(s * 9.7) > 0.65;
  const liquiditySweep = liq_score > 7;

  // Smart SL/TP
  const slDistance = (atrNum * 1.5).toFixed(pair === "BTCUSD" ? 0 : 5);
  const tpDistance = (atrNum * 3.0).toFixed(pair === "BTCUSD" ? 0 : 5);

  const riskLevel = total >= 80 ? "Low" : total >= 60 ? "Medium" : "High";
  const marketStatus = session === "Closed" ? "Closed"
    : session === "London+NY" ? "High Activity" : "Active";

  return {
    // Scores
    trend_score, adx_score, rsi_score, atr_score, mom_score, vol_score, struct_score, sd_score, liq_score, total,
    // Indicators
    ema20Raw, ema50Raw, ema20AbovEma50, rsi, adx, atrNum, atrVal, atrAvg, atrAvgVal, atrSpike,
    // Signal
    direction, trend: bullBias ? "Uptrend" : "Downtrend",
    trendStrength,
    // Condition gates
    rsiOk, atrOk, adxOk, spreadOk, spread,
    // Market classification
    marketCondition,
    strategy,
    // Strategy validity
    momentumOk,
    rangeBreakoutReady,
    asianHigh, asianLow,
    volatilitySpikeOk,
    // Asian range (for Range Breakout display)
    price20CandleBreak,
    // SMC
    bos, choch, liquiditySweep,
    // SL/TP
    slDistance, tpDistance,
    // Meta
    riskLevel, session, marketStatus,
    isValid: false, // set by caller
  };
}

export function getBestOpportunity(allResults, tf) {
  let best = null, bestScore = -1;
  for (const pair of PAIRS) {
    const d = allResults[pair]?.[tf];
    if (d && d.total > bestScore) { bestScore = d.total; best = { pair, ...d }; }
  }
  return best;
}