import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://dazzling-perception-production-8e53.up.railway.app/api";

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Get user's MT5 credentials + active pair
    const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id });
    const config = settings?.[0] || {};
    const symbol = config.active_pair ?? "XAUUSD";

    // Use the stored flouba_token (provisioned on signup) directly; fall back to api_key exchange.
    const provisionSecret = Deno.env.get("PROVISION_SECRET");
    if (!provisionSecret) return Response.json({ error: "PROVISION_SECRET not set" }, { status: 500 });
    let bridgeToken = user.flouba_token;
    if (!bridgeToken) {
      let apiKey = user.mt5_api_key;
      if (!apiKey) {
        const provisionRes = await fetch(`${BASE}/provision/user`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${provisionSecret}`, "Content-Type": "application/json" },
          body: JSON.stringify({ base44_user_id: user.id, email: user.email, name: user.full_name || user.email }),
        });
        const provisionJson = await provisionRes.json().catch(() => ({}));
        if (!provisionJson?.success || !provisionJson?.api_key) {
          return Response.json({ error: "Failed to provision bridge account" }, { status: 500 });
        }
        apiKey = provisionJson.api_key;
        const updateData = { mt5_api_key: apiKey };
        if (provisionJson.slug) { updateData.mt5_slug = provisionJson.slug; updateData.flouba_slug = provisionJson.slug; }
        if (provisionJson.user_token) updateData.flouba_token = provisionJson.user_token;
        if (provisionJson.ea_download_url) updateData.ea_download_url = provisionJson.ea_download_url;
        await base44.asServiceRole.entities.User.update(user.id, updateData);
        bridgeToken = provisionJson.user_token || null;
      }
      if (!bridgeToken) {
        const tokenRes = await fetch(`${BASE}/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: apiKey }),
        });
        const tokenJson = await tokenRes.json().catch(() => ({}));
        if (!tokenJson?.token) {
          return Response.json({ error: "Failed to authenticate with MT5 bridge" }, { status: 500 });
        }
        bridgeToken = tokenJson.token;
      }
    }

    const authHeaders = {
      "Authorization": `Bearer ${bridgeToken}`,
      "Content-Type": "application/json",
    };
    if (config.mt5_account)  authHeaders["X-MT5-Login"] = String(config.mt5_account);
    if (config.mt5_password) authHeaders["X-MT5-Password"] = config.mt5_password;
    if (config.mt5_server)   authHeaders["X-MT5-Server"] = config.mt5_server;

    // Fetch scanner indicators + account data in parallel
    const [scanRes, acctRes] = await Promise.all([
      fetch(`${BASE}/scanner/status`, { headers: authHeaders }).catch(() => null),
      fetch(`${BASE}/account`, { headers: authHeaders }).catch(() => null),
    ]);

    const scanJson = scanRes?.ok ? await scanRes.json().catch(() => ({})) : {};
    const acctJson = acctRes?.ok ? await acctRes.json().catch(() => ({})) : {};

    const indicators = scanJson?.indicators || scanJson?.data?.indicators || {};
    const account = acctJson?.account || acctJson?.data?.account || acctJson?.data || {};

    const adx = indicators.adx ?? indicators.adx_14 ?? null;
    const rsi = indicators.rsi ?? indicators.rsi_14 ?? null;
    const atr = indicators.atr ?? indicators.atr_14 ?? null;
    const ema20 = indicators.ema_20 ?? indicators.ema20 ?? null;
    const ema50 = indicators.ema_50 ?? indicators.ema50 ?? null;
    const spread = indicators.spread_pips ?? indicators.spread ?? null;

    const trending = adx != null && adx >= 25;
    const overbought = rsi != null && rsi >= 70;
    const oversold = rsi != null && rsi <= 30;
    const bullishEma = ema20 != null && ema50 != null && ema20 > ema50;
    const highVolatility = atr != null && atr >= 0.5;
    const highSpread = spread != null && spread > 5;

    const prompt = `You are an expert forex/CFD trading strategist. Analyze the following LIVE market data from the MT5 scanner and select the single best trading strategy for the robot to execute right now.

LIVE MARKET DATA:
- Symbol: ${symbol}
- ADX (trend strength): ${adx ?? "N/A"} — ${trending ? "STRONG TREND" : "WEAK/NO TREND (ranging)"}
- RSI (momentum): ${rsi ?? "N/A"} — ${overbought ? "OVERBOUGHT" : oversold ? "OVERSOLD" : "NEUTRAL"}
- ATR (volatility): ${atr ?? "N/A"} — ${highVolatility ? "HIGH VOLATILITY" : "NORMAL VOLATILITY"}
- EMA20 vs EMA50: ${ema20 ?? "N/A"} vs ${ema50 ?? "N/A"} — ${bullishEma ? "BULLISH ALIGNMENT (EMA20 > EMA50)" : "BEARISH ALIGNMENT (EMA20 < EMA50)"}
- Spread: ${spread ?? "N/A"} pips — ${highSpread ? "HIGH SPREAD (avoid scalping)" : "NORMAL SPREAD"}
- Account Balance: $${account.balance ?? "N/A"}
- Account Equity: $${account.equity ?? "N/A"}

AVAILABLE STRATEGIES — pick exactly ONE based on current market conditions:
1. "Momentum Scalping" — Best for strong trending markets (ADX > 25) with clear directional momentum. Rides the trend with tight stops. Ideal when ADX is high and RSI confirms direction.
2. "Range Breakout" — Best when ADX is low (ranging) and price is consolidating near key levels, about to break out. Captures the breakout move with momentum.
3. "Volatility Spike" — Best during sudden volatility expansion (high ATR spike) or news events. Capitalizes on sharp directional moves. Use when ATR is unusually high.
4. "HFT Scalper" — Best for highly liquid pairs with very low spread (< 3 pips). Opens/closes many small trades rapidly for tiny pip gains. Only when spread is low and volatility is healthy.
5. "Grid Trading" — Best for ranging/choppy markets where price oscillates in a band (low ADX, neutral RSI). Places buy/sell orders at fixed intervals to profit from oscillation.
6. "Liquidity Sweep Scalping" — Best when price is likely to sweep liquidity pools (stop hunts) before reversing. Detects false breakouts. Good near key levels with mixed signals and moderate volatility.
7. "Hedge Scalper" — Best for uncertain/volatile markets where direction is unclear. Opens Buy+Sell simultaneously, closes winner when loser hits SL. Good when trend direction is ambiguous.
8. "Swing Trend Pullback Continuation 2026" — Best for established trends (ADX > 20, clear EMA alignment) where price pulls back to EMA20/EMA50 before continuing. Captures swing entries with 1:2+ RR. Ideal in trending markets with healthy pullbacks.
9. "EMA Trend Progressive Recovery" — Best when EMA fast/slow separation confirms a trend and price is trending but equity needs recovery. Opens initial + controlled recovery positions with capped lot multiplier. Good in steady trends with moderate volatility.
10. "Hybrid Confluence Mode" — Best when multiple confluence factors align: trend (EMA stack), pullback to EMA20, liquidity sweep, and engulfing confirmation. Requires high confluence score (80+). Ideal in trending markets with clean pullbacks and sweep setups.
11. "NQ London Kill Zone Breakout" — Best for index pairs (NAS100, US30) during the London Kill Zone session window. Captures breakout of the kill zone range with volume confirmation. Ideal for indices during London open with clear range.
12. "Market Structure BOS Retest Scalper" — Best when a Break of Structure (BOS) occurs on M5 and price retests the broken level. Uses H1 for structure, M5 for entry. Ideal in trending markets with clean structural breaks and retest setups.
13. "Orderflow Opening Range Breakout" — Best during session opens (London/NY) when price breaks the opening range with volume/orderflow expansion. Requires retest of broken level. Ideal at session open with strong volume participation.
14. "Gold Morning Range Breakout" — Best for XAUUSD during the morning session. Defines a morning range, then trades the breakout with volume and ATR confirmation. Ideal for gold during morning hours with healthy volatility.
15. "Gold Daily Breakout" — Best for XAUUSD using previous day high/low as breakout levels. Places pending orders with ATR filter and trailing stop. Ideal for gold with moderate daily volatility and clean previous-day range.

DECISION RULES:
- If ADX > 25 and RSI confirms direction → Momentum Scalping or Swing Trend Pullback Continuation 2026
- If ADX > 20 with clean EMA trend + pullback → Swing Trend Pullback Continuation 2026 or Hybrid Confluence Mode
- If ADX < 20 and price oscillating → Grid Trading or Range Breakout
- If spread > 5 pips → avoid HFT Scalper, prefer Hedge Scalper or Momentum Scalping
- If direction ambiguous but volatility high → Hedge Scalper
- If ATR very high with clear direction → Volatility Spike or Momentum Scalping
- If near key levels with mixed signals → Liquidity Sweep Scalping
- If trending with BOS + retest setup → Market Structure BOS Retest Scalper
- If session open with volume expansion → Orderflow Opening Range Breakout
- If XAUUSD morning session with range → Gold Morning Range Breakout
- If XAUUSD with clean previous-day range → Gold Daily Breakout
- If NAS100/US30 during London Kill Zone → NQ London Kill Zone Breakout
- If trend + pullback + sweep + engulfing all align → Hybrid Confluence Mode
- If trend confirmed but equity needs recovery → EMA Trend Progressive Recovery

Respond with the single best strategy and a concise reason (1-2 sentences) explaining why it fits the current market conditions.`;

    const llmRes = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          strategy: {
            type: "string",
            enum: [
              "Momentum Scalping",
              "Range Breakout",
              "Volatility Spike",
              "HFT Scalper",
              "Grid Trading",
              "Liquidity Sweep Scalping",
              "Hedge Scalper",
              "Swing Trend Pullback Continuation 2026",
              "EMA Trend Progressive Recovery",
              "Hybrid Confluence Mode",
              "NQ London Kill Zone Breakout",
              "Market Structure BOS Retest Scalper",
              "Orderflow Opening Range Breakout",
              "Gold Morning Range Breakout",
              "Gold Daily Breakout",
            ],
          },
          reason: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["strategy", "reason"],
      },
    });

    return Response.json({
      ok: true,
      strategy: llmRes.strategy,
      reason: llmRes.reason,
      confidence: llmRes.confidence ?? null,
      marketSnapshot: {
        symbol,
        adx,
        rsi,
        atr,
        ema20,
        ema50,
        spread,
        trending,
        overbought,
        oversold,
        highVolatility,
        highSpread,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});