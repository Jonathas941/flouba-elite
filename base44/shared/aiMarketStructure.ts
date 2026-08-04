// ── AI Market Structure Scanner ──────────────────────────────────────────
// Uses LLM to analyze live market data for SMC concepts: BOS, CHOCH,
// liquidity sweeps, FVG, order blocks, and market bias.
// Shared module — imported by tradeDecisionEngine and other scanner functions.

function num(v) { return typeof v === "number" ? v : (v == null ? null : Number(v)); }

/**
 * Calls the LLM with live indicator data and asks it to perform a full
 * Smart Money Concepts (SMC) market structure analysis.
 *
 * @param {object} ind  - Normalized indicator snapshot from the bridge
 * @param {string} regime - Current detected regime
 * @param {string|null} regimeDir - Current regime direction
 * @param {object} cfg  - BotSettings
 * @returns {Promise<object>} { bos, choch, liquidity_sweep, sweep_dir, market_bias, confidence, key_levels, reasoning }
 */
export async function aiMarketStructureScan(ind, regime, regimeDir, cfg) {
  const price = num(ind?.bid) ?? num(ind?.ask);
  const marketContext = {
    symbol: cfg.active_pair || "XAUUSD",
    timeframe: cfg.trend_filter_timeframe || "M15",
    current_price: price,
    ema_20: num(ind?.ema_20 ?? ind?.ema20),
    ema_50: num(ind?.ema_50 ?? ind?.ema50),
    ema_200: num(ind?.ema_200 ?? ind?.ema200),
    ema_slope: num(ind?.ema_slope ?? ind?.slope),
    rsi: num(ind?.rsi ?? ind?.rsi_14),
    adx: num(ind?.adx),
    plus_di: num(ind?.plus_di),
    minus_di: num(ind?.minus_di),
    atr: num(ind?.atr_14 ?? ind?.atr14),
    macd: num(ind?.macd ?? ind?.macd_histogram),
    bid: num(ind?.bid),
    ask: num(ind?.ask),
    spread: num(ind?.spread_pips),
    ea_bos: ind?.bos === true || ind?.break_of_structure === true,
    ea_choch: ind?.choch === true || ind?.change_of_character === true,
    ea_sweep: ind?.liquidity_sweep === true || ind?.sweep === true,
    ea_sweep_dir: ind?.sweep_dir || ind?.sweep_direction,
    detected_regime: regime,
    detected_regime_dir: regimeDir,
  };

  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert Smart Money Concepts (SMC) analyst. Analyze the live market data below and identify the current market structure.

TASK: Perform a full SMC market structure analysis. Identify:
1. Break of Structure (BOS) — has price broken a prior swing high/low in the trend direction?
2. Change of Character (CHOCH) — has the trend shifted, indicating a potential reversal?
3. Liquidity Sweep — has price swept a liquidity pool (stop hunt) and reversed?
4. Fair Value Gap (FVG) — is there a visible imbalance/imbalance zone nearby?
5. Market Bias — is the overall structure bullish, bearish, or neutral?
6. Key Levels — what are the most important support/resistance levels to watch?
7. Confidence — how confident are you in this assessment (0-100)?

RULES:
- Base your analysis ONLY on the provided data. Do not hallucinate prices or levels.
- If data is insufficient for a concept, mark it as null or false.
- Be conservative: only mark BOS/CHOCH/sweep as true when the data clearly supports it.
- Market bias should reflect the dominant structural direction, not just the current trend.

Live market data:
${JSON.stringify(marketContext, null, 2)}

Respond with your SMC analysis.`,
      response_json_schema: {
        type: "object",
        properties: {
          bos: { type: "boolean", description: "Break of Structure detected" },
          choch: { type: "boolean", description: "Change of Character detected" },
          liquidity_sweep: { type: "boolean", description: "Liquidity sweep detected" },
          sweep_dir: { type: "string", enum: ["bullish", "bearish", "neutral"], description: "Direction of the sweep" },
          fvg_detected: { type: "boolean", description: "Fair Value Gap detected nearby" },
          market_bias: { type: "string", enum: ["bullish", "bearish", "neutral"], description: "Overall structural bias" },
          confidence: { type: "number", description: "Confidence score 0-100" },
          key_levels: {
            type: "object",
            properties: {
              support: { type: "number", description: "Nearest key support level" },
              resistance: { type: "number", description: "Nearest key resistance level" },
            },
          },
          reasoning: { type: "string", description: "Detailed SMC reasoning" },
          setup_quality: { type: "string", enum: ["A+", "A", "B", "C", "None"], description: "Setup quality grade" },
        },
        required: ["bos", "choch", "liquidity_sweep", "market_bias", "confidence"],
      },
    });

    return {
      bos: res?.bos === true,
      choch: res?.choch === true,
      liquidity_sweep: res?.liquidity_sweep === true,
      sweep_dir: res?.sweep_dir || null,
      fvg_detected: res?.fvg_detected === true,
      market_bias: res?.market_bias || "neutral",
      confidence: num(res?.confidence) ?? 50,
      key_levels: res?.key_levels || null,
      reasoning: res?.reasoning || null,
      setup_quality: res?.setup_quality || "None",
    };
  } catch {
    // Fallback: use EA-provided booleans if LLM is unavailable
    return {
      bos: ind?.bos === true || ind?.break_of_structure === true,
      choch: ind?.choch === true || ind?.change_of_character === true,
      liquidity_sweep: ind?.liquidity_sweep === true || ind?.sweep === true,
      sweep_dir: ind?.sweep_dir || ind?.sweep_direction || null,
      fvg_detected: false,
      market_bias: regimeDir === "Bullish" ? "bullish" : regimeDir === "Bearish" ? "bearish" : "neutral",
      confidence: 50,
      key_levels: null,
      reasoning: null,
      setup_quality: "None",
    };
  }
}