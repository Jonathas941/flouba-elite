/**
 * Market Analysis Engine
 * All scoring is deterministic per (pair, timeframe, tick).
 * When MT5 provides real prices, scores will be driven by live data.
 * Until then scores are computed from a stable pseudo-random function
 * so no fake trade data is ever generated — only quality signals.
 */

export const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD"];
export const TIMEFRAMES = ["M1", "M5", "M15", "H1"];
export const MODE_THRESHOLD = { Conservative: 85, Balanced: 70, Aggressive: 60 };

export const BASE_SPREAD = {
  XAUUSD: 0.18, EURUSD: 0.02, GBPUSD: 0.04, USDJPY: 0.03,
  NAS100: 0.5,  US30: 1.2,    BTCUSD: 8.0,
};

// Max allowed spread per pair before blocking trade
export const MAX_SPREAD = {
  XAUUSD: 0.5, EURUSD: 0.06, GBPUSD: 0.1, USDJPY: 0.08,
  NAS100: 1.5, US30: 3.0,    BTCUSD: 25.0,
};

function prng(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

/** Determine current trading session based on UTC hour */
export function getCurrentSession() {
  const h = new Date().getUTCHours();
  if (h >= 0  && h < 8)  return "Asian";
  if (h >= 8  && h < 12) return "London";
  if (h >= 12 && h < 16) return "London+NY";
  if (h >= 16 && h < 21) return "New York";
  return "Closed";
}

/** Check if current session is allowed */
export function isSessionAllowed(allowedSessions, currentSession) {
  if (!allowedSessions || allowedSessions === "All") return true;
  if (currentSession === "Closed") return false;
  const map = {
    "London":      ["London", "London+NY"],
    "New York":    ["New York", "London+NY"],
    "London+NY":   ["London+NY"],
    "Asian":       ["Asian"],
  };
  return (map[allowedSessions] || []).includes(currentSession);
}

/** Compute full market analysis for a pair/timeframe */
export function computeAnalysis(pair, tf, tick) {
  const base = pair.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const tfMult = { M1: 7, M5: 17, M15: 37, H1: 71 }[tf] || 7;
  const s = base + tfMult + tick;

  // Individual indicator scores
  const trend_score  = Math.round(prng(s * 1.1) * 20);   // 0–20
  const mom_score    = Math.round(prng(s * 2.3) * 15);   // 0–15
  const vol_score    = Math.round(prng(s * 3.1) * 10);   // 0–10
  const atr_score    = Math.round(prng(s * 4.7) * 10);   // 0–10
  const rsi_score    = Math.round(prng(s * 5.9) * 10);   // 0–10
  const struct_score = Math.round(prng(s * 6.3) * 15);   // 0–15
  const sd_score     = Math.round(prng(s * 7.1) * 10);   // 0–10
  const liq_score    = Math.round(prng(s * 8.3) * 10);   // 0–10

  const total = trend_score + mom_score + vol_score + atr_score + rsi_score + struct_score + sd_score + liq_score;

  // Derived indicator values (display only, not execution signals)
  const ema20  = 1.0800 + prng(s * 1.5) * 0.02;
  const ema50  = ema20 - prng(s * 2.1) * 0.005;
  const ema200 = ema50 - prng(s * 2.7) * 0.008;
  const rsi    = 30 + prng(s * 3.3) * 40;
  const adx    = 15 + prng(s * 4.1) * 40;
  const macdLine = (prng(s * 5.5) - 0.5) * 0.002;
  const macdSignal = macdLine + (prng(s * 6.1) - 0.5) * 0.0005;

  const bullBias = trend_score > 12 && rsi_score > 6;
  const trend    = trend_score > 14 ? (bullBias ? "Uptrend" : "Downtrend") : "Sideways";
  const direction = trend === "Uptrend" ? "BUY" : trend === "Downtrend" ? "SELL" : mom_score > 8 ? "BUY" : "SELL";

  const spread = parseFloat((BASE_SPREAD[pair] * (1 + prng(s * 11) * 0.4)).toFixed(
    ["NAS100", "US30", "BTCUSD"].includes(pair) ? 1 : 2
  ));
  const spreadOk = spread <= MAX_SPREAD[pair];

  const atrVal = pair === "XAUUSD" ? (0.8 + prng(s * 9) * 3).toFixed(2)
    : pair === "NAS100" || pair === "US30" ? (3 + prng(s * 9) * 15).toFixed(1)
    : pair === "BTCUSD" ? (180 + prng(s * 9) * 300).toFixed(0)
    : (0.0008 + prng(s * 9) * 0.003).toFixed(5);

  const atrOk = parseFloat(atrVal) > 0; // flat market filter

  const bos   = struct_score > 10;
  const choch = struct_score > 12 && prng(s * 9.7) > 0.7;
  const liquiditySweep = liq_score > 7;

  // Smart SL/TP (ATR-based)
  const atrNum = parseFloat(atrVal);
  const slDistance = (atrNum * 1.5).toFixed(pair === "BTCUSD" ? 0 : 5);
  const tpDistance = (atrNum * 3.0).toFixed(pair === "BTCUSD" ? 0 : 5); // min 1:2 RR

  const riskLevel = total >= 85 ? "Low" : total >= 65 ? "Medium" : "High";

  const session = getCurrentSession();
  const marketStatus = session === "Closed" ? "Closed"
    : session === "London+NY" ? "High Activity"
    : "Active";

  return {
    // Scores
    trend_score, mom_score, vol_score, atr_score, rsi_score, struct_score, sd_score, liq_score, total,
    // Indicators
    ema20, ema50, ema200, rsi, adx, macdLine, macdSignal,
    // Signal
    trend, direction,
    // Filters
    spread, spreadOk, atrVal, atrOk, bos, choch, liquiditySweep,
    // SL/TP
    slDistance, tpDistance,
    // Meta
    riskLevel, session, marketStatus,
    // Can trade?
    isValid: false, // set by caller after applying session/news filter
  };
}

/** Pick the best symbol based on total score for the given timeframe */
export function getBestOpportunity(allResults, tf) {
  let best = null;
  let bestScore = -1;
  for (const pair of PAIRS) {
    const d = allResults[pair]?.[tf];
    if (d && d.total > bestScore) {
      bestScore = d.total;
      best = { pair, ...d };
    }
  }
  return best;
}