/**
 * Strategy → internal timeframe mapping.
 * Each strategy defines its own analysis timeframes, independent of the chart's
 * PERIOD_CURRENT. The bot reads M5 / M15 / M30 / H1 data explicitly based on the
 * selected strategy, so the user can leave any chart open without affecting results.
 */

export const STRATEGY_TIMEFRAMES = {
  "Momentum Scalping":                       { main: "M5",  htf: "M15" },
  "Range Breakout":                          { main: "M15", htf: "H1"  },
  "Volatility Spike":                        { main: "M5",  htf: "M15" },
  "Hybrid Manual":                           { main: "M15", htf: "H1"  },
  "HFT Scalper":                             { main: "M1",  htf: "M5"  },
  "Grid Trading":                            { main: "M5",  htf: null  },
  "Liquidity Sweep Scalping":                { main: "M5",  htf: "M15", note: "Main signal M5, higher timeframe trend M15." },
  "Hedge Scalper":                           { main: "M5",  htf: "M15" },
  "Swing Trend Pullback Continuation 2026":  { main: "M15", confirm: "M30", htf: "H1", note: "Main M15, confirmation M30, higher trend H1." },
  "EMA Trend Progressive Recovery":          { main: "M15", htf: "H1",  note: "Trend + ATR on M15, higher trend confirmation H1." },
  "Hybrid Confluence Mode":                  { main: "M15", entry: "M5", htf: "H1", note: "Trend M15, pullback & sweep M5, structure H1." },
  "NQ London Kill Zone Breakout":            { main: "M5",  htf: null,  note: "Range, breakout and entry all on M5." },
  "Market Structure BOS Retest Scalper":      { main: "M5",  htf: "H1",  note: "Entry BOS on M5, structure on H1." },
  "Orderflow Opening Range Breakout":        { main: "M5",  htf: "M15", note: "Range + breakout + entry on M5, optional trend M15." },
  "Gold Morning Range Breakout":             { main: "M5",  htf: "M15", note: "Morning range + breakout + entry on M5, optional trend M15." },
  "Gold Daily Breakout":                      { main: "D1",  htf: "H1",  note: "Levels from closed D1 candle; breakout trigger intraday, volatility confirmed on H1." },
  "Auto (AI Select)":                         { main: "M5",  htf: "M15", note: "Adaptive — timeframes follow the AI-selected strategy. Robot default timeframe is M5." },
};

const TF_MINUTES = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440 };

export function getStrategyTimeframes(name) {
  return STRATEGY_TIMEFRAMES[name] || { main: "M5", htf: "M15" };
}

/**
 * Last completed (closed) candle time for a timeframe label, in UTC.
 * MT5 candles close at fixed boundaries, so the most recent fully-closed candle
 * ended at the previous period boundary.
 */
export function lastCandleCloseUTC(tfLabel, now = new Date()) {
  const mins = TF_MINUTES[tfLabel] || 15;
  const totalMin = Math.floor(now.getTime() / 60000);
  const lastCloseMin = Math.floor(totalMin / mins) * mins;
  return new Date(lastCloseMin * 60000);
}

/** Next candle close time (the currently forming candle's close). */
export function nextCandleCloseUTC(tfLabel, now = new Date()) {
  const mins = TF_MINUTES[tfLabel] || 15;
  const last = lastCandleCloseUTC(tfLabel, now);
  return new Date(last.getTime() + mins * 60000);
}