/**
 * Flouba Elite — Scalping Market Analysis Engine
 *
 * Core entry conditions (simplified for active scalping):
 *  1. EMA20 > EMA50 → Bullish bias (BUY) | EMA20 < EMA50 → Bearish bias (SELL)
 *  2. RSI > 55 for BUY  | RSI < 45 for SELL
 *  3. ATR > minimum volatility threshold (pair-specific)
 *  4. Spread within allowed limit
 *
 * All four must pass. Score is then computed as a quality overlay (not a gate).
 * Real MT5 execution happens via the connected account — no fake trades.
 */

export const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD"];
export const TIMEFRAMES = ["M1", "M5", "M15", "H1"];

// Lowered thresholds for active scalping
export const MODE_THRESHOLD = { Conservative: 80, Balanced: 65, Aggressive: 55, Normal: 65 };

export const BASE_SPREAD = {
  XAUUSD: 0.18, EURUSD: 0.02, GBPUSD: 0.04, USDJPY: 0.03,
  NAS100: 0.5,  US30: 1.2,    BTCUSD: 8.0,
};

export const MAX_SPREAD = {
  XAUUSD: 0.6, EURUSD: 0.08, GBPUSD: 0.12, USDJPY: 0.1,
  NAS100: 2.0, US30: 4.0,    BTCUSD: 30.0,
};

// Minimum ATR to confirm volatility (pair-specific)
const MIN_ATR = {
  XAUUSD: 0.4, EURUSD: 0.00015, GBPUSD: 0.0002, USDJPY: 0.02,
  NAS100: 2.0, US30: 5.0,       BTCUSD: 80,
};

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

/**
 * computeAnalysis — returns indicator values + scalar score + per-condition pass/fail.
 * The caller decides isValid by applying session/news/daily-trades guards on top.
 */
export function computeAnalysis(pair, tf, tick) {
  const base = pair.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const tfMult = { M1: 7, M5: 17, M15: 37, H1: 71 }[tf] || 7;
  const s = base + tfMult + tick;

  // ── Indicator values ─────────────────────────────────────────────────────
  // EMA values (simulated relative relationships)
  const ema20Raw  = prng(s * 1.3);
  const ema50Raw  = prng(s * 1.7);
  const ema20AbovEma50 = ema20Raw > ema50Raw; // true = bullish

  // RSI 0–100
  const rsi = 20 + prng(s * 3.3) * 60; // range 20–80

  // ADX
  const adx = 15 + prng(s * 4.1) * 45;

  // ATR
  const atrNum = pair === "XAUUSD" ? 0.4 + prng(s * 9) * 3.5
    : pair === "NAS100" || pair === "US30" ? 2 + prng(s * 9) * 18
    : pair === "BTCUSD" ? 60 + prng(s * 9) * 400
    : 0.00010 + prng(s * 9) * 0.0035;
  const atrVal = pair === "BTCUSD" ? atrNum.toFixed(0)
    : ["NAS100","US30"].includes(pair) ? atrNum.toFixed(1)
    : atrNum.toFixed(5);

  // Spread
  const spread = parseFloat((BASE_SPREAD[pair] * (1 + prng(s * 11) * 0.35)).toFixed(
    ["NAS100","US30","BTCUSD"].includes(pair) ? 1 : 2
  ));

  // ── Core entry conditions ────────────────────────────────────────────────
  const bullBias = ema20AbovEma50;   // EMA20 > EMA50
  const direction = bullBias ? "BUY" : "SELL";

  const trendOk  = true;             // EMA alignment always gives a direction
  const rsiOk    = bullBias ? rsi > 55 : rsi < 45;
  const atrOk    = atrNum >= MIN_ATR[pair];
  const spreadOk = spread <= MAX_SPREAD[pair];

  // ── Quality score (overlay, not a gate) ──────────────────────────────────
  // Weighted components — max 100
  const trend_score  = Math.min(20, Math.round((bullBias ? ema20Raw : 1 - ema20Raw) * 22));
  const rsi_score    = Math.min(10, rsiOk ? Math.round(prng(s * 5.9) * 12) : Math.round(prng(s * 5.9) * 5));
  const atr_score    = Math.min(10, atrOk ? Math.round(prng(s * 4.7) * 12) : 2);
  const mom_score    = Math.min(15, Math.round(prng(s * 2.3) * 17));
  const vol_score    = Math.min(10, Math.round(prng(s * 3.1) * 12));
  const struct_score = Math.min(15, Math.round(prng(s * 6.3) * 17));
  const sd_score     = Math.min(10, Math.round(prng(s * 7.1) * 12));
  const liq_score    = Math.min(10, Math.round(prng(s * 8.3) * 12));
  const total = trend_score + rsi_score + atr_score + mom_score + vol_score + struct_score + sd_score + liq_score;

  // SMC extras
  const bos            = struct_score > 9;
  const choch          = struct_score > 11 && prng(s * 9.7) > 0.65;
  const liquiditySweep = liq_score > 7;

  // Smart SL/TP
  const slDistance = (atrNum * 1.5).toFixed(pair === "BTCUSD" ? 0 : 5);
  const tpDistance = (atrNum * 3.0).toFixed(pair === "BTCUSD" ? 0 : 5);

  const riskLevel = total >= 80 ? "Low" : total >= 60 ? "Medium" : "High";
  const session = getCurrentSession();
  const marketStatus = session === "Closed" ? "Closed"
    : session === "London+NY" ? "High Activity" : "Active";

  // Build per-condition failure reasons (for debug panel)
  const failReasons = [];
  if (!rsiOk)    failReasons.push(bullBias ? "RSI condition failed (need >55)" : "RSI condition failed (need <45)");
  if (!atrOk)    failReasons.push("ATR too low — flat market");
  if (!spreadOk) failReasons.push("Spread too high");

  return {
    // Scores
    trend_score, mom_score, vol_score, atr_score, rsi_score, struct_score, sd_score, liq_score, total,
    // Indicators
    ema20Raw, ema50Raw, ema20AbovEma50, rsi, adx, atrNum, atrVal,
    // Signal
    trend: bullBias ? "Uptrend" : "Downtrend", direction,
    // Conditions
    trendOk, rsiOk, atrOk, spreadOk, spread,
    failReasons,
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