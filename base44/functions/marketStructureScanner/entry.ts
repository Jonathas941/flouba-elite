import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import {
  calcATR, findSwings, detectBOS, detectCHOCH, detectTrend,
  detectOrderBlocks, detectFVG, detectSupplyDemand, detectLiquidity,
  detectPremiumDiscount,
} from '../../shared/marketStructure.ts';
import { clamp, num, nyParts, sessionInfo } from '../../shared/tradingUtils.ts';

// ═══════════════════════════════════════════════════════════════
// Market Structure Scanner — Multi-Timeframe SMC Analysis + MT5 Pending Orders
//
// Workflow:
//   Market Scanner → Detect Structure → Confirm Setup → Calculate Entry/SL/TP
//   → Score Signal → Send Pending Order to MT5 → Wait for Price → Manage Position
//
// Actions: scan, settings, setups, approve, reject, cancel, activity
// ═══════════════════════════════════════════════════════════════

// ── Lot size calculation ──
function calculateLotSize(balance, riskPct, entry, sl, symbol) {
  if (!balance || !entry || !sl || balance <= 0) return 0.01;
  const riskAmount = balance * (riskPct / 100);
  const slDistance = Math.abs(entry - sl);
  if (slDistance <= 0) return 0.01;
  // Contract size: XAUUSD=100oz, indices=1, FX=100,000
  const contractSize = symbol.startsWith("XAU") ? 100 : (symbol.startsWith("NAS") || symbol.startsWith("US30")) ? 1 : 100000;
  const riskPerLot = slDistance * contractSize;
  const lot = riskAmount / riskPerLot;
  return Math.max(0.01, Math.round(lot * 100) / 100);
}

// ── Generate unique setup ID ──
function generateSetupId(symbol, direction, structureTf, bosTime, entryPrice) {
  const bosStr = bosTime ? new Date(bosTime * 1000).toISOString().slice(0, 10).replace(/-/g, "") : "unknown";
  const entryStr = entryPrice ? entryPrice.toFixed(2) : "0";
  return `${symbol}-${direction}-${structureTf}-${bosStr}-${entryStr}`;
}

// ── Fetch candles via mt5Bridge ──
async function fetchCandles(base44, symbol, timeframe, count) {
  try {
    const r = await base44.functions.invoke("mt5Bridge", { action: "rates", symbol, timeframe, count });
    const d = r?.data?.data;
    const raw = d?.rates || d?.candles || d?.bars || (Array.isArray(d) ? d : []);
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw.map(c => ({
      time: typeof c.time === "number" ? c.time : Math.floor(new Date(c.time).getTime() / 1000),
      open: +c.open, high: +c.high, low: +c.low, close: +c.close, volume: +c.volume || 0,
    }));
  } catch { return null; }
}

// ── Fetch live quote (bid/ask/spread) ──
async function fetchQuote(base44, symbol) {
  try {
    const r = await base44.functions.invoke("mt5Bridge", { action: "symbols" });
    const d = r?.data?.data;
    const symbolsArr = d?.symbols || (Array.isArray(d) ? d : []);
    const symObj = Array.isArray(symbolsArr) ? symbolsArr.find(s => (s.symbol || s.name) === symbol) : (d?.[symbol] || symbolsArr?.[symbol]);
    if (symObj) {
      const bid = symObj.bid ?? symObj.Bid;
      const ask = symObj.ask ?? symObj.Ask;
      if (bid != null && ask != null) {
        return { bid, ask, spread: ask - bid, price: (bid + ask) / 2 };
      }
    }
    return null;
  } catch { return null; }
}

// ── Fetch account ──
async function fetchAccount(base44) {
  try {
    const r = await base44.functions.invoke("mt5Bridge", { action: "account" });
    return r?.data?.data?.account || null;
  } catch { return null; }
}

// ── AI Fallback: When candle data is unavailable (bridge /rates returns 404),
//    use LLM with web search to analyze live market structure and generate a setup.
//    Uses gemini_3_flash (only model supporting add_context_from_internet). ──
async function aiScanFallback(symbol, cfg, base44, userId, quote) {
  const result = { symbol, found: false, setup: null, score: 0, reason: "" };
  const currentPrice = quote?.price;
  if (!currentPrice) {
    result.reason = `${symbol}: No live price available for AI scan.`;
    return result;
  }

  const sess = sessionInfo(cfg);
  // Session filter still applies
  if (!sess.open) {
    result.reason = `${symbol}: ${sess.name} — ${sess.reason}.`;
    return result;
  }

  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert Smart Money Concepts (SMC) trading analyst. Analyze the LIVE market structure for ${symbol} (XAUUSD = Gold/USD) right now.

Current price: ${currentPrice}
Spread: ${quote.spread}
Timeframe context: Trend=${cfg.trend_timeframe}, Structure=${cfg.structure_timeframe}, Entry=${cfg.entry_timeframe}

TASK: Perform a full SMC market structure analysis using current live market data from the web. Identify:
1. Break of Structure (BOS) — has price broken a prior swing high/low in the trend direction?
2. Change of Character (CHOCH) — has the trend shifted, indicating a potential reversal?
3. Liquidity Sweep — has price swept a liquidity pool (stop hunt) and reversed?
4. Fair Value Gap (FVG) — is there a visible imbalance zone nearby?
5. Order Block — is there a valid order block (last opposite candle before impulsive move)?
6. Market Bias — bullish, bearish, or neutral?
7. Entry Zone — where is the optimal entry price (order block mid, FVG mid, or key level)?
8. Stop Loss — where should the stop loss go (below/above the swing low/high)?
9. Take Profit — where should TP go (next liquidity zone or 2R minimum)?
10. Confidence score (0-100) — how confident are you in this setup?

RULES:
- Use REAL current market data from the web. Do NOT hallucinate prices.
- Entry must be at a valid SMC zone (order block, FVG, supply/demand, or key level).
- Stop loss must be beyond the swing low (BUY) or swing high (SELL).
- Risk-to-reward must be at least ${cfg.min_rr || 2}:1.
- Only return a setup if confidence >= ${cfg.min_signal_score || 70}.
- If no valid setup exists, return found=false with a clear reason.

Respond with your analysis as JSON.`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          found: { type: "boolean", description: "Whether a valid setup was found" },
          direction: { type: "string", enum: ["BUY", "SELL"], description: "Trade direction" },
          entry_price: { type: "number", description: "Entry price" },
          stop_loss: { type: "number", description: "Stop loss price" },
          take_profit: { type: "number", description: "Take profit price" },
          order_type: { type: "string", enum: ["BUY_LIMIT", "SELL_LIMIT", "BUY_STOP", "SELL_STOP"], description: "MT5 order type" },
          bos: { type: "boolean", description: "Break of Structure detected" },
          choch: { type: "boolean", description: "Change of Character detected" },
          liquidity_sweep: { type: "boolean", description: "Liquidity sweep detected" },
          fvg: { type: "boolean", description: "Fair Value Gap detected" },
          order_block: { type: "boolean", description: "Order block detected" },
          market_bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
          confidence: { type: "number", description: "Confidence score 0-100" },
          zone_high: { type: "number", description: "Upper edge of entry zone" },
          zone_low: { type: "number", description: "Lower edge of entry zone" },
          zone_type: { type: "string", enum: ["order_block", "fvg", "supply_demand", "fib", "breakout"] },
          swing_high: { type: "number", description: "Recent swing high" },
          swing_low: { type: "number", description: "Recent swing low" },
          reasoning: { type: "string", description: "Detailed SMC reasoning" },
        },
        required: ["found", "confidence", "market_bias", "reasoning"],
      },
    });

    if (!res || !res.found) {
      result.reason = `${symbol}: AI scan — no valid setup found. ${res?.reasoning || "Market conditions not optimal."}`;
      return result;
    }

    const aiScore = Math.min(100, Math.max(0, Math.round(res.confidence || 0)));
    if (aiScore < (cfg.min_signal_score || 70)) {
      result.reason = `${symbol}: AI confidence ${aiScore} below minimum ${cfg.min_signal_score}.`;
      return result;
    }

    const entryDir = res.direction;
    const entryPrice = res.entry_price;
    const stopLoss = res.stop_loss;
    const takeProfit = res.take_profit;
    const slDistance = Math.abs(entryPrice - stopLoss);
    const actualRR = slDistance > 0 ? Math.abs(takeProfit - entryPrice) / slDistance : 0;
    if (actualRR < (cfg.min_rr || 2)) {
      result.reason = `${symbol}: AI RR ${actualRR.toFixed(2)} below minimum ${cfg.min_rr}.`;
      return result;
    }

    // Determine order type
    let orderType = res.order_type;
    if (!orderType) {
      if (entryDir === "BUY") orderType = currentPrice > entryPrice ? "BUY_LIMIT" : "BUY_STOP";
      else orderType = currentPrice < entryPrice ? "SELL_LIMIT" : "SELL_STOP";
    }

    // Duplicate protection
    const setupId = `${symbol}-AI-${entryDir}-${Date.now().toString().slice(-8)}`;
    const existing = await base44.asServiceRole.entities.MarketStructureSetup.filter(
      { created_by_id: userId, setup_id: setupId }, "-created_date", 1
    ).catch(() => []);
    if (existing?.length > 0) {
      result.reason = `${symbol}: AI setup already exists.`;
      return result;
    }

    // Lot size
    const account = await fetchAccount(base44);
    const balance = account?.balance || 0;
    let lotSize = cfg.lot_size_mode === "Fixed" ? (cfg.fixed_lot_size || 0.01) : calculateLotSize(balance, cfg.risk_percentage || 1, entryPrice, stopLoss, symbol);
    lotSize = Math.min(lotSize, cfg.max_lot_size || 0.5);

    // Expiration
    let expirationTime = null;
    if (cfg.expiration_mode === "candles") {
      const tfMinutes = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440 };
      const mins = (cfg.expiration_candles || 12) * (tfMinutes[cfg.entry_timeframe] || 5);
      expirationTime = new Date(Date.now() + mins * 60000).toISOString();
    } else if (cfg.expiration_mode === "minutes") {
      expirationTime = new Date(Date.now() + (cfg.expiration_minutes || 720) * 60000).toISOString();
    } else if (cfg.expiration_mode === "session_end") {
      const { minutes } = nyParts(new Date());
      const endMins = 17 * 60;
      const remaining = endMins > minutes ? (endMins - minutes) * 60000 : 24 * 60 * 60000;
      expirationTime = new Date(Date.now() + remaining).toISOString();
    }

    const pillars = {
      trend: { pass: true, score: 20, reason: `AI: ${res.market_bias} bias confirmed.` },
      bos: { pass: res.bos === true, score: res.bos ? 15 : 0, reason: res.bos ? "BOS confirmed (AI)." : "No BOS." },
      choch: { pass: res.choch === true, score: res.choch ? 10 : 0, reason: res.choch ? "CHOCH detected (AI)." : "No CHOCH." },
      order_block: { pass: res.order_block === true, score: res.order_block ? 15 : 0, reason: res.order_block ? "Order block (AI)." : "No OB." },
      fvg: { pass: res.fvg === true, score: res.fvg ? 10 : 0, reason: res.fvg ? "FVG (AI)." : "No FVG." },
      liquidity: { pass: res.liquidity_sweep === true, score: res.liquidity_sweep ? 15 : 0, reason: res.liquidity_sweep ? "Liquidity sweep (AI)." : "No sweep." },
      rr: { pass: true, score: 10, reason: `RR ${actualRR.toFixed(2)} ≥ ${cfg.min_rr}.` },
      session: { pass: true, score: 5, reason: `${sess.name} session.` },
    };

    const setupPayload = {
      setup_id: setupId,
      symbol,
      direction: entryDir,
      order_type: orderType,
      entry_price: Math.round(entryPrice * 100000) / 100000,
      stop_loss: Math.round(stopLoss * 100000) / 100000,
      take_profit: Math.round(takeProfit * 100000) / 100000,
      signal_score: aiScore,
      status: cfg.execution_mode === "auto" && cfg.auto_execution_enabled ? "Signal Found" : "Waiting Approval",
      trend_timeframe: cfg.trend_timeframe,
      structure_timeframe: cfg.structure_timeframe,
      entry_timeframe: cfg.entry_timeframe,
      entry_method: "ai_web_scan",
      risk_reward: Math.round(actualRR * 100) / 100,
      lot_size: lotSize,
      risk_percent: cfg.risk_percentage || 1,
      expiration_time: expirationTime,
      zone_high: res.zone_high ? Math.round(res.zone_high * 100000) / 100000 : null,
      zone_low: res.zone_low ? Math.round(res.zone_low * 100000) / 100000 : null,
      zone_type: res.zone_type || "order_block",
      swing_high: res.swing_high || null,
      swing_low: res.swing_low || null,
      pillars,
      regime: res.market_bias === "bullish" ? "Bullish" : res.market_bias === "bearish" ? "Bearish" : "Range",
      comment: "Flouba AI Market Structure",
    };
    // Use user's client so created_by_id is the user's ID (visible in dashboard).
    // Fall back to asServiceRole for cron mode.
    const setup = await base44.entities.MarketStructureSetup.create(setupPayload)
      .catch(() => base44.asServiceRole.entities.MarketStructureSetup.create({ ...setupPayload, created_by_id: userId }));

    result.found = true;
    result.setup = setup;
    result.score = aiScore;
    result.reason = `${symbol}: AI ${entryDir} ${orderType} setup — score ${aiScore}/100, entry ${entryPrice.toFixed(2)}, SL ${stopLoss.toFixed(2)}, TP ${takeProfit.toFixed(2)}, RR ${actualRR.toFixed(2)}, lot ${lotSize}.`;
    return result;
  } catch (e) {
    result.reason = `${symbol}: AI scan failed — ${e.message}`;
    return result;
  }
}

// ── Scan a single symbol ──
async function scanSymbol(symbol, cfg, base44, userId) {
  const result = { symbol, found: false, setup: null, score: 0, reason: "" };

  // Fetch candles for all 3 timeframes
  const trendCandles = await fetchCandles(base44, symbol, cfg.trend_timeframe, 200);
  const structCandles = await fetchCandles(base44, symbol, cfg.structure_timeframe, 200);
  const entryCandles = await fetchCandles(base44, symbol, cfg.entry_timeframe, 200);

  // Fetch live quote
  const quote = await fetchQuote(base44, symbol);
  if (!quote) {
    result.reason = `Live quote unavailable for ${symbol}.`;
    return result;
  }

  if (!trendCandles || trendCandles.length < 30 || !structCandles || structCandles.length < 30 || !entryCandles || entryCandles.length < 20) {
    // ── AI Fallback: candle data unavailable — use LLM web search to analyze live structure ──
    return aiScanFallback(symbol, cfg, base44, userId, quote);
  }

  const currentPrice = quote.price;
  const spread = quote.spread;

  // ── 1. Higher timeframe trend ──
  const trendSwings = findSwings(trendCandles, 3);
  const trendDir = detectTrend(trendSwings);
  const trendBOS = detectBOS(trendSwings);

  // ── 2. Structure timeframe BOS/CHOCH ──
  const structSwings = findSwings(structCandles, 3);
  const structBOS = detectBOS(structSwings);
  const structTrend = detectTrend(structSwings);
  const choch = detectCHOCH(structSwings, structTrend === "Bullish" ? "Bearish" : structTrend === "Bearish" ? "Bullish" : null);

  // ── 3. Entry timeframe zones ──
  const entryDir = trendDir === "Bullish" ? "BUY" : trendDir === "Bearish" ? "SELL" : null;
  if (!entryDir) {
    result.reason = `${symbol}: HTF trend is Consolidation — no directional bias.`;
    return result;
  }

  // Check MTF alignment: HTF trend must match structure BOS direction
  const bosDir = structBOS?.direction;
  if (!bosDir || (entryDir === "BUY" && bosDir !== "Bullish") || (entryDir === "SELL" && bosDir !== "Bearish")) {
    result.reason = `${symbol}: MTF misalignment — HTF ${trendDir} but structure BOS ${bosDir || "none"}.`;
    return result;
  }

  // Detect entry zones on the entry timeframe
  const ob = detectOrderBlocks(entryCandles, entryDir);
  const fvg = detectFVG(entryCandles, entryDir);
  const sd = detectSupplyDemand(entryCandles, entryDir);
  const liq = detectLiquidity(entryCandles);
  const pd = detectPremiumDiscount(structSwings, currentPrice);
  const entrySwings = findSwings(entryCandles, 3);
  const lastSwingLow = entrySwings.lows[entrySwings.lows.length - 1];
  const lastSwingHigh = entrySwings.highs[entrySwings.highs.length - 1];
  const atr = calcATR(entryCandles, 14);

  // ── 4. Calculate entry zone based on method ──
  let zone = null;
  let zoneType = null;

  if (cfg.entry_method === "order_block_mid" && ob) {
    zone = { high: ob.high, low: ob.low };
    zoneType = "order_block";
  } else if (cfg.entry_method === "fvg_mid" && fvg) {
    zone = { high: fvg.high, low: fvg.low };
    zoneType = "fvg";
  } else if (cfg.entry_method === "supply_demand_mid" && sd) {
    zone = { high: sd.high, low: sd.low };
    zoneType = "supply_demand";
  } else if (cfg.entry_method === "fib" && pd) {
    const fibHigh = entryDir === "BUY" ? pd.fibonacci_618 : pd.fibonacci_382;
    const fibLow = entryDir === "BUY" ? pd.fibonacci_382 : pd.fibonacci_618;
    zone = { high: Math.max(fibHigh, fibLow), low: Math.min(fibHigh, fibLow) };
    zoneType = "fib";
  } else if (cfg.entry_method === "breakout_buffer" && structBOS) {
    const buffer = (cfg.breakout_buffer_points || 5) * 0.01;
    zone = entryDir === "BUY"
      ? { high: structBOS.level + buffer, low: structBOS.level }
      : { high: structBOS.level, low: structBOS.level - buffer };
    zoneType = "breakout";
  }

  // Fallback: try any available zone
  if (!zone) {
    if (ob) { zone = { high: ob.high, low: ob.low }; zoneType = "order_block"; }
    else if (fvg) { zone = { high: fvg.high, low: fvg.low }; zoneType = "fvg"; }
    else if (sd) { zone = { high: sd.high, low: sd.low }; zoneType = "supply_demand"; }
  }

  if (!zone) {
    result.reason = `${symbol}: No valid entry zone detected on ${cfg.entry_timeframe}.`;
    return result;
  }

  const entryPrice = (zone.high + zone.low) / 2;

  // ── 5. Determine order type ──
  let orderType;
  if (entryDir === "BUY") {
    orderType = currentPrice > entryPrice ? "BUY_LIMIT" : "BUY_STOP";
  } else {
    orderType = currentPrice < entryPrice ? "SELL_LIMIT" : "SELL_STOP";
  }

  // ── 6. Calculate stop loss ──
  const slBuffer = (cfg.sl_buffer_points || 5) * 0.01;
  let stopLoss;
  if (entryDir === "BUY") {
    const slRef = Math.min(zone.low, lastSwingLow?.price ?? zone.low);
    stopLoss = slRef - slBuffer;
  } else {
    const slRef = Math.max(zone.high, lastSwingHigh?.price ?? zone.high);
    stopLoss = slRef + slBuffer;
  }

  // Validate SL distance
  const slDistance = Math.abs(entryPrice - stopLoss);
  const maxSlDist = cfg.max_sl_distance || 100;
  if (slDistance > maxSlDist) {
    result.reason = `${symbol}: SL distance ${slDistance.toFixed(2)} exceeds max ${maxSlDist}.`;
    return result;
  }

  // ── 7. Calculate take profit ──
  const rr = cfg.default_rr || 2;
  let takeProfit;
  let tp1 = null, tp2 = null, tp3 = null;

  if (cfg.tp_method === "fixed_rr") {
    takeProfit = entryDir === "BUY" ? entryPrice + slDistance * rr : entryPrice - slDistance * rr;
  } else if (cfg.tp_method === "prev_swing") {
    takeProfit = entryDir === "BUY"
      ? (lastSwingHigh?.price ?? entryPrice + slDistance * rr)
      : (lastSwingLow?.price ?? entryPrice - slDistance * rr);
  } else if (cfg.tp_method === "next_liq") {
    takeProfit = entryDir === "BUY"
      ? (liq.equal_highs[0]?.price ?? entryPrice + slDistance * rr)
      : (liq.equal_lows[0]?.price ?? entryPrice - slDistance * rr);
  } else if (cfg.tp_method === "next_sr") {
    takeProfit = entryDir === "BUY"
      ? (pd?.range_high ?? entryPrice + slDistance * rr)
      : (pd?.range_low ?? entryPrice - slDistance * rr);
  } else {
    // partial
    tp1 = entryDir === "BUY" ? entryPrice + slDistance * (cfg.tp1_at_r || 1) : entryPrice - slDistance * (cfg.tp1_at_r || 1);
    tp2 = entryDir === "BUY" ? entryPrice + slDistance * (cfg.tp2_at_r || 2) : entryPrice - slDistance * (cfg.tp2_at_r || 2);
    tp3 = entryDir === "BUY"
      ? (liq.equal_highs[0]?.price ?? entryPrice + slDistance * 3)
      : (liq.equal_lows[0]?.price ?? entryPrice - slDistance * 3);
    takeProfit = tp2;
  }

  // Validate RR
  const actualRR = slDistance > 0 ? Math.abs(takeProfit - entryPrice) / slDistance : 0;
  if (actualRR < (cfg.min_rr || 2)) {
    result.reason = `${symbol}: RR ${actualRR.toFixed(2)} below minimum ${cfg.min_rr}.`;
    return result;
  }

  // ── 8. Signal scoring (0-100) ──
  let score = 0;
  const pillars = {};

  // HTF trend aligned: +20
  const trendAligned = (entryDir === "BUY" && trendDir === "Bullish") || (entryDir === "SELL" && trendDir === "Bearish");
  if (trendAligned) { score += 20; pillars.trend = { pass: true, score: 20, reason: `HTF ${cfg.trend_timeframe} trend ${trendDir} aligned.` }; }
  else { pillars.trend = { pass: false, score: 0, reason: `HTF trend ${trendDir} not aligned with ${entryDir}.` }; }

  // BOS confirmed: +15
  if (structBOS) { score += 15; pillars.bos = { pass: true, score: 15, reason: `BOS confirmed on ${cfg.structure_timeframe}.` }; }
  else { pillars.bos = { pass: false, score: 0, reason: "No BOS confirmed." }; }

  // CHOCH confirmed: +10
  if (choch) { score += 10; pillars.choch = { pass: true, score: 10, reason: "CHOCH detected." }; }
  else { pillars.choch = { pass: false, score: 0, reason: "No CHOCH." }; }

  // Valid order block: +15
  if (ob) { score += 15; pillars.order_block = { pass: true, score: 15, reason: "Valid order block detected." }; }
  else { pillars.order_block = { pass: false, score: 0, reason: "No order block." }; }

  // FVG present: +10
  if (fvg) { score += 10; pillars.fvg = { pass: true, score: 10, reason: "FVG detected." }; }
  else { pillars.fvg = { pass: false, score: 0, reason: "No FVG." }; }

  // Liquidity sweep confirmed: +15
  const liqSweep = liq.equal_highs.length > 0 || liq.equal_lows.length > 0;
  if (liqSweep) { score += 15; pillars.liquidity = { pass: true, score: 15, reason: "Liquidity levels detected." }; }
  else { pillars.liquidity = { pass: false, score: 0, reason: "No liquidity sweep." }; }

  // Good RR: +10
  if (actualRR >= (cfg.min_rr || 2)) { score += 10; pillars.rr = { pass: true, score: 10, reason: `RR ${actualRR.toFixed(2)} ≥ ${cfg.min_rr}.` }; }
  else { pillars.rr = { pass: false, score: 0, reason: `RR ${actualRR.toFixed(2)} below ${cfg.min_rr}.` }; }

  // London/NY session: +5
  const sess = sessionInfo(cfg);
  if (sess.open && (sess.name.includes("London") || sess.name.includes("New York"))) {
    score += 5; pillars.session = { pass: true, score: 5, reason: `${sess.name} session active.` };
  } else {
    pillars.session = { pass: false, score: 0, reason: `Session: ${sess.name}.` };
  }

  score = Math.min(100, score);
  result.score = score;

  // ── 9. Filters ──
  // Spread filter
  if (cfg.spread_filter && spread != null && spread > (cfg.max_spread || 30)) {
    result.reason = `${symbol}: Spread ${spread} exceeds max ${cfg.max_spread}.`;
    return result;
  }

  // Session filter
  if (!sess.open) {
    result.reason = `${symbol}: ${sess.name} — ${sess.reason}.`;
    return result;
  }
  if (sess.name === "Asian" && cfg.asian_session === false) {
    result.reason = `${symbol}: Asian session disabled.`;
    return result;
  }
  if (sess.name === "London" && cfg.london_session === false) {
    result.reason = `${symbol}: London session disabled.`;
    return result;
  }
  if (sess.name.includes("New York") && cfg.new_york_session === false) {
    result.reason = `${symbol}: NY session disabled.`;
    return result;
  }

  // Volatility/ATR filter
  if (cfg.atr_filter && atr != null && currentPrice > 0) {
    const ratio = atr / currentPrice;
    if (ratio < 0.0003) {
      result.reason = `${symbol}: ATR/Price ${(ratio * 100).toFixed(3)}% — market too quiet.`;
      return result;
    }
    if (ratio > 0.005) {
      result.reason = `${symbol}: ATR/Price ${(ratio * 100).toFixed(2)}% — extreme volatility.`;
      return result;
    }
  }

  // Min signal score
  if (score < (cfg.min_signal_score || 70)) {
    result.reason = `${symbol}: Signal score ${score} below minimum ${cfg.min_signal_score}.`;
    return result;
  }

  // ── 10. Duplicate protection ──
  const bosTime = structBOS?.candle_time;
  const setupId = generateSetupId(symbol, entryDir, cfg.structure_timeframe, bosTime, entryPrice);

  const existing = await base44.asServiceRole.entities.MarketStructureSetup.filter(
    { created_by_id: userId, setup_id: setupId }, "-created_date", 1
  ).catch(() => []);
  if (existing?.length > 0) {
    result.reason = `${symbol}: Duplicate setup ${setupId} — already exists.`;
    return result;
  }

  // Check max pending orders
  const pendingCount = await base44.asServiceRole.entities.MarketStructureSetup.filter(
    { created_by_id: userId, status: { $in: ["Waiting Approval", "Pending Order Placed"] } }, "-created_date", 100
  ).catch(() => []);
  if (pendingCount?.length >= (cfg.max_pending_orders || 3)) {
    result.reason = `${symbol}: Max pending orders (${cfg.max_pending_orders}) reached.`;
    return result;
  }

  // ── 11. Calculate lot size ──
  const account = await fetchAccount(base44);
  const balance = account?.balance || 0;
  let lotSize;
  if (cfg.lot_size_mode === "Fixed") {
    lotSize = cfg.fixed_lot_size || 0.01;
  } else {
    lotSize = calculateLotSize(balance, cfg.risk_percentage || 1, entryPrice, stopLoss, symbol);
  }
  lotSize = Math.min(lotSize, cfg.max_lot_size || 0.5);

  // ── 12. Calculate expiration ──
  let expirationTime = null;
  if (cfg.expiration_mode === "candles") {
    const tfMinutes = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440 };
    const mins = (cfg.expiration_candles || 12) * (tfMinutes[cfg.entry_timeframe] || 5);
    expirationTime = new Date(Date.now() + mins * 60000).toISOString();
  } else if (cfg.expiration_mode === "minutes") {
    expirationTime = new Date(Date.now() + (cfg.expiration_minutes || 720) * 60000).toISOString();
  } else if (cfg.expiration_mode === "session_end") {
    // End of current NY session (17:00 ET)
    const { minutes } = nyParts(new Date());
    const endMins = 17 * 60;
    const remaining = endMins > minutes ? (endMins - minutes) * 60000 : 24 * 60 * 60000;
    expirationTime = new Date(Date.now() + remaining).toISOString();
  }

  // ── 13. Create setup record ──
  const setup = await base44.asServiceRole.entities.MarketStructureSetup.create({
    created_by_id: userId,
    setup_id: setupId,
    symbol,
    direction: entryDir,
    order_type: orderType,
    entry_price: Math.round(entryPrice * 100000) / 100000,
    stop_loss: Math.round(stopLoss * 100000) / 100000,
    take_profit: Math.round(takeProfit * 100000) / 100000,
    tp1: tp1 ? Math.round(tp1 * 100000) / 100000 : null,
    tp2: tp2 ? Math.round(tp2 * 100000) / 100000 : null,
    tp3: tp3 ? Math.round(tp3 * 100000) / 100000 : null,
    signal_score: score,
    status: cfg.execution_mode === "auto" && cfg.auto_execution_enabled ? "Signal Found" : "Waiting Approval",
    trend_timeframe: cfg.trend_timeframe,
    structure_timeframe: cfg.structure_timeframe,
    entry_timeframe: cfg.entry_timeframe,
    entry_method: cfg.entry_method,
    risk_reward: Math.round(actualRR * 100) / 100,
    lot_size: lotSize,
    risk_percent: cfg.risk_percentage || 1,
    expiration_time: expirationTime,
    bos_time: bosTime ? new Date(bosTime * 1000).toISOString() : null,
    bos_level: structBOS?.level || null,
    choch_level: choch?.level || null,
    zone_high: Math.round(zone.high * 100000) / 100000,
    zone_low: Math.round(zone.low * 100000) / 100000,
    zone_type: zoneType,
    swing_high: lastSwingHigh?.price || null,
    swing_low: lastSwingLow?.price || null,
    pillars,
    regime: trendDir,
    comment: "Flouba Market Structure",
  });

  result.found = true;
  result.setup = setup;
  result.reason = `${symbol}: ${entryDir} ${orderType} setup found — score ${score}/100, entry ${entryPrice.toFixed(2)}, SL ${stopLoss.toFixed(2)}, TP ${takeProfit.toFixed(2)}, RR ${actualRR.toFixed(2)}, lot ${lotSize}.`;

  return result;
}

// ── Send pending order to MT5 ──
async function sendPendingOrder(base44, setup, cfg) {
  const res = await base44.functions.invoke("mt5Bridge", {
    action: "pending_order",
    symbol: setup.symbol,
    order_type: setup.order_type,
    entry_price: setup.entry_price,
    lot_size: setup.lot_size,
    stop_loss: setup.stop_loss,
    take_profit: setup.take_profit,
    expiration: setup.expiration_time,
  }).catch((e) => ({ data: { success: false, message: e.message } }));

  const r = res?.data;
  if (r?.success && r?.ticket) {
    await base44.asServiceRole.entities.MarketStructureSetup.update(setup.id, {
      status: "Pending Order Placed",
      mt5_ticket: String(r.ticket),
    });
    return { ok: true, ticket: r.ticket };
  }
  await base44.asServiceRole.entities.MarketStructureSetup.update(setup.id, {
    status: "Rejected",
    rejected_reason: r?.message || r?.error || "MT5 rejected the pending order.",
  });
  return { ok: false, error: r?.message || r?.error || "Pending order failed" };
}

// ── Monitor existing setups for expiration/invalidation ──
async function monitorSetups(base44, userId, cfg) {
  const active = await base44.asServiceRole.entities.MarketStructureSetup.filter(
    { created_by_id: userId, status: { $in: ["Waiting Approval", "Pending Order Placed", "Signal Found"] } },
    "-created_date", 50
  ).catch(() => []);

  const now = Date.now();
  for (const s of active) {
    // Check expiration
    if (s.expiration_time && new Date(s.expiration_time).getTime() < now) {
      await base44.asServiceRole.entities.MarketStructureSetup.update(s.id, {
        status: "Expired",
        close_reason: "Order expired.",
      });
      continue;
    }

    // Check if price has invalidated the setup
    const quote = await fetchQuote(base44, s.symbol);
    if (quote) {
      if (s.direction === "BUY" && quote.price < s.stop_loss) {
        await base44.asServiceRole.entities.MarketStructureSetup.update(s.id, {
          status: "Canceled",
          close_reason: "Price invalidated the setup — moved below stop loss before activation.",
        });
      } else if (s.direction === "SELL" && quote.price > s.stop_loss) {
        await base44.asServiceRole.entities.MarketStructureSetup.update(s.id, {
          status: "Canceled",
          close_reason: "Price invalidated the setup — moved above stop loss before activation.",
        });
      }
    }
  }
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    // Auth: user session or cron secret
    const cronSecret = Deno.env.get("CRON_SECRET");
    const hasCron = cronSecret && (req.headers.get("X-Cron-Secret") === cronSecret || body.cron_secret === cronSecret);
    let user = await base44.auth.me().catch(() => null);
    if (!user) {
      if (!hasCron) return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (!body.target_user_id) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    let userId = user ? user.id : null;
    if (body.target_user_id && body.target_user_id !== userId) {
      if (!hasCron && user?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
      user = await base44.asServiceRole.entities.User.get(body.target_user_id).catch(() => null);
      if (!user) return Response.json({ error: "Target user not found" }, { status: 404 });
      userId = user.id;
    }
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const action = body.action || "scan";

    // ── Load or create settings ──
    // NOTE: asServiceRole sets created_by_id to the service role's ID, not the user's.
    // So we can't filter by created_by_id. Instead, fetch all settings and find the
    // one whose created_by_id matches userId (service role can read all records).
    const allSettings = await base44.asServiceRole.entities.MarketStructureSettings.filter(
      {}, "-created_date", 50
    ).catch(() => []);
    let settings = (allSettings || []).find((s) => s.created_by_id === userId);
    if (!settings) {
      // Create with the user's client so created_by_id is set to the user's ID
      settings = await base44.entities.MarketStructureSettings.create({}).catch(async () => {
        // Fallback to service role if user client fails (e.g. cron mode)
        return await base44.asServiceRole.entities.MarketStructureSettings.create({ created_by_id: userId });
      });
    }
    const cfg = settings;

    // ── SETTINGS action ──
    if (action === "settings") {
      if (body.update) {
        const updates = { ...body.update };
        Object.keys(updates).forEach(k => { if (updates[k] === undefined) delete updates[k]; });
        settings = await base44.asServiceRole.entities.MarketStructureSettings.update(settings.id, updates);
      }
      return Response.json({ ok: true, settings });
    }

    // ── SETUPS action ──
    if (action === "setups") {
      const all = await base44.asServiceRole.entities.MarketStructureSetup.filter(
        {}, "-created_date", 100
      ).catch(() => []);
      const setups = (all || []).filter((s) => s.created_by_id === userId && ["Scanning", "Signal Found", "Waiting Approval", "Pending Order Placed", "Activated"].includes(s.status));
      return Response.json({ ok: true, setups });
    }

    // ── ACTIVITY action ──
    if (action === "activity") {
      const all = await base44.asServiceRole.entities.MarketStructureSetup.filter(
        {}, "-created_date", 50
      ).catch(() => []);
      const activity = (all || []).filter((s) => s.created_by_id === userId);
      return Response.json({ ok: true, activity });
    }

    // ── APPROVE action ──
    if (action === "approve") {
      const setupId = body.setup_id;
      if (!setupId) return Response.json({ ok: false, error: "setup_id required" }, { status: 400 });
      const setups = await base44.asServiceRole.entities.MarketStructureSetup.filter(
        { created_by_id: userId, setup_id: setupId }, "-created_date", 1
      );
      const setup = setups?.[0];
      if (!setup) return Response.json({ ok: false, error: "Setup not found" }, { status: 404 });
      if (setup.status !== "Waiting Approval" && setup.status !== "Signal Found") {
        return Response.json({ ok: false, error: `Setup is ${setup.status} — cannot approve.` });
      }
      const result = await sendPendingOrder(base44, setup, cfg);
      return Response.json(result);
    }

    // ── REJECT action ──
    if (action === "reject") {
      const setupId = body.setup_id;
      if (!setupId) return Response.json({ ok: false, error: "setup_id required" }, { status: 400 });
      const setups = await base44.asServiceRole.entities.MarketStructureSetup.filter(
        { created_by_id: userId, setup_id: setupId }, "-created_date", 1
      );
      const setup = setups?.[0];
      if (!setup) return Response.json({ ok: false, error: "Setup not found" }, { status: 404 });
      await base44.asServiceRole.entities.MarketStructureSetup.update(setup.id, {
        status: "Rejected",
        rejected_reason: body.reason || "Rejected by user.",
      });
      return Response.json({ ok: true });
    }

    // ── CANCEL action ──
    if (action === "cancel") {
      const setupId = body.setup_id;
      if (!setupId) return Response.json({ ok: false, error: "setup_id required" }, { status: 400 });
      const setups = await base44.asServiceRole.entities.MarketStructureSetup.filter(
        { created_by_id: userId, setup_id: setupId }, "-created_date", 1
      );
      const setup = setups?.[0];
      if (!setup) return Response.json({ ok: false, error: "Setup not found" }, { status: 404 });
      if (setup.mt5_ticket) {
        await base44.functions.invoke("mt5Bridge", { action: "close", ticket: setup.mt5_ticket }).catch(() => {});
      }
      await base44.asServiceRole.entities.MarketStructureSetup.update(setup.id, {
        status: "Canceled",
        close_reason: "Canceled by user.",
      });
      return Response.json({ ok: true });
    }

    // ── SCAN action ──
    if (action !== "scan") {
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Check scanner is active
    if (!cfg.scanner_active && !hasCron) {
      return Response.json({ ok: true, scanner_active: false, message: "Scanner is stopped. Activate it to begin scanning." });
    }

    // Monitor existing setups
    await monitorSetups(base44, userId, cfg);

    // Parse symbols
    const symbols = (cfg.symbols || "XAUUSD").split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    const results = [];

    for (const symbol of symbols) {
      const r = await scanSymbol(symbol, cfg, base44, userId);
      results.push(r);

      // Auto-execute if enabled
      if (r.found && r.setup && cfg.execution_mode === "auto" && cfg.auto_execution_enabled) {
        await sendPendingOrder(base44, r.setup, cfg);
      }
    }

    // Update last scan time
    await base44.asServiceRole.entities.MarketStructureSettings.update(settings.id, {
      last_scan_time: new Date().toISOString(),
    });
    const foundSetup = results.find(r => r.found);
    if (foundSetup) {
      await base44.asServiceRole.entities.MarketStructureSettings.update(settings.id, {
        last_signal_time: new Date().toISOString(),
      });
    }

    return Response.json({
      ok: true,
      scanner_active: true,
      results,
      summary: {
        symbols_scanned: symbols.length,
        setups_found: results.filter(r => r.found).length,
        last_scan: new Date().toISOString(),
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});