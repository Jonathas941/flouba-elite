// ═══════════════════════════════════════════════════════════════
// Market Structure Detection Utilities
// Used by the Market Structure Scanner for multi-timeframe SMC analysis.
// All detection uses CLOSED candles only — the last (unfinished) candle
// is excluded from swing/BOS/CHOCH confirmation.
// ═══════════════════════════════════════════════════════════════

export function calcATR(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

// Find confirmed swing highs/lows using fractal pattern.
// lookback = bars on each side that must be lower (high) or higher (low).
export function findSwings(candles, lookback = 3) {
  const highs = [], lows = [];
  // Exclude the last `lookback` candles (may be unfinished)
  const end = candles.length - lookback;
  for (let i = lookback; i < end; i++) {
    let isHigh = true, isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isHigh = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isLow = false;
    }
    if (isHigh) highs.push({ index: i, time: candles[i].time, price: candles[i].high });
    if (isLow) lows.push({ index: i, time: candles[i].time, price: candles[i].low });
  }
  return { highs, lows };
}

// Detect Break of Structure using confirmed swings.
// Bullish BOS: a swing high breaks above the previous swing high.
// Bearish BOS: a swing low breaks below the previous swing low.
export function detectBOS(swings) {
  const { highs, lows } = swings;
  if (highs.length < 2 || lows.length < 2) return null;
  const lastHigh = highs[highs.length - 1];
  const prevHigh = highs[highs.length - 2];
  const lastLow = lows[lows.length - 1];
  const prevLow = lows[lows.length - 2];

  if (lastHigh.price > prevHigh.price && lastHigh.time > prevHigh.time) {
    return { direction: "Bullish", level: prevHigh.price, candle_time: lastHigh.time };
  }
  if (lastLow.price < prevLow.price && lastLow.time > prevLow.time) {
    return { direction: "Bearish", level: prevLow.price, candle_time: lastLow.time };
  }
  return null;
}

// Detect Change of Character — first opposite BOS after an established trend.
export function detectCHOCH(swings, prevTrendDir) {
  const { highs, lows } = swings;
  if (highs.length < 2 || lows.length < 2) return null;
  const lastHigh = highs[highs.length - 1];
  const prevHigh = highs[highs.length - 2];
  const lastLow = lows[lows.length - 1];
  const prevLow = lows[lows.length - 2];

  if (prevTrendDir === "Bearish" && lastHigh.price > prevHigh.price) {
    return { direction: "Bullish", level: prevHigh.price, candle_time: lastHigh.time };
  }
  if (prevTrendDir === "Bullish" && lastLow.price < prevLow.price) {
    return { direction: "Bearish", level: prevLow.price, candle_time: lastLow.time };
  }
  return null;
}

// Determine trend from swing sequence.
// Bullish: HH + HL pattern. Bearish: LH + LL pattern. Else: Consolidation.
export function detectTrend(swings) {
  const { highs, lows } = swings;
  if (highs.length < 2 || lows.length < 2) return "Consolidation";
  const lastHigh = highs[highs.length - 1];
  const prevHigh = highs[highs.length - 2];
  const lastLow = lows[lows.length - 1];
  const prevLow = lows[lows.length - 2];

  const hh = lastHigh.price > prevHigh.price;
  const hl = lastLow.price > prevLow.price;
  const lh = lastHigh.price < prevHigh.price;
  const ll = lastLow.price < prevLow.price;

  if (hh && hl) return "Bullish";
  if (lh && ll) return "Bearish";
  return "Consolidation";
}

// Detect Order Block — last opposite candle before a strong directional move.
// BUY OB: last bearish candle before a bullish impulse.
// SELL OB: last bullish candle before a bearish impulse.
export function detectOrderBlocks(candles, direction) {
  const lookback = Math.min(candles.length - 2, 20);
  for (let i = candles.length - 2; i >= Math.max(1, candles.length - lookback); i--) {
    const c = candles[i];
    const next = candles[i + 1];
    if (direction === "BUY") {
      if (c.close < c.open && next.close > next.open && next.close > c.high) {
        return { high: c.high, low: c.low, time: c.time };
      }
    } else {
      if (c.close > c.open && next.close < next.open && next.close < c.low) {
        return { high: c.high, low: c.low, time: c.time };
      }
    }
  }
  return null;
}

// Detect Fair Value Gap — 3-candle gap.
// Bullish FVG: candle A high < candle C low.
// Bearish FVG: candle A low > candle C high.
export function detectFVG(candles, direction) {
  for (let i = candles.length - 3; i >= 0; i--) {
    const a = candles[i], c = candles[i + 2];
    if (direction === "BUY") {
      if (a.high < c.low) return { high: c.low, low: a.high, index: i };
    } else {
      if (a.low > c.high) return { high: a.low, low: c.high, index: i };
    }
  }
  return null;
}

// Detect supply/demand zones — consolidation before a strong directional move.
export function detectSupplyDemand(candles, direction) {
  const lookback = Math.min(candles.length - 3, 15);
  for (let i = candles.length - 3; i >= Math.max(2, candles.length - lookback); i--) {
    const base = candles.slice(i - 2, i + 1);
    const impulse = candles[i + 1];
    const range = Math.max(...base.map(c => c.high)) - Math.min(...base.map(c => c.low));
    const body = Math.abs(impulse.close - impulse.open);
    if (body > range * 1.5) {
      const zoneHigh = Math.max(...base.map(c => c.high));
      const zoneLow = Math.min(...base.map(c => c.low));
      if (direction === "BUY" && impulse.close > impulse.open) {
        return { high: zoneHigh, low: zoneLow, time: candles[i].time, type: "demand" };
      }
      if (direction === "SELL" && impulse.close < impulse.open) {
        return { high: zoneHigh, low: zoneLow, time: candles[i].time, type: "supply" };
      }
    }
  }
  return null;
}

// Detect liquidity levels — equal highs and equal lows.
export function detectLiquidity(candles) {
  const { highs, lows } = findSwings(candles, 2);
  const tolerance = calcATR(candles) * 0.1 || 0.001;
  const equal_highs = [];
  const equal_lows = [];
  for (let i = 0; i < highs.length; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      if (Math.abs(highs[i].price - highs[j].price) <= tolerance) {
        equal_highs.push({ price: (highs[i].price + highs[j].price) / 2, time: highs[j].time });
      }
    }
  }
  for (let i = 0; i < lows.length; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      if (Math.abs(lows[i].price - lows[j].price) <= tolerance) {
        equal_lows.push({ price: (lows[i].price + lows[j].price) / 2, time: lows[j].time });
      }
    }
  }
  return { equal_highs, equal_lows };
}

// Detect premium/discount zones relative to current price.
// Premium = upper half of range (above 50% → sell zone).
// Discount = lower half of range (below 50% → buy zone).
export function detectPremiumDiscount(swings, currentPrice) {
  const { highs, lows } = swings;
  if (highs.length === 0 || lows.length === 0) return null;
  const rangeHigh = Math.max(...highs.map(h => h.price));
  const rangeLow = Math.min(...lows.map(l => l.price));
  const mid = (rangeHigh + rangeLow) / 2;
  return {
    range_high: rangeHigh,
    range_low: rangeLow,
    mid,
    premium: currentPrice > mid,
    discount: currentPrice < mid,
    fibonacci_50: mid,
    fibonacci_618: rangeLow + (rangeHigh - rangeLow) * 0.618,
    fibonacci_382: rangeLow + (rangeHigh - rangeLow) * 0.382,
  };
}