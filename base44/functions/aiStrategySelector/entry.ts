import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api";

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const token = Deno.env.get("MT5_API_TOKEN");
    if (!token) return Response.json({ error: "MT5_API_TOKEN not set" }, { status: 500 });

    // Get user's MT5 credentials + active pair
    const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id });
    const config = settings?.[0] || {};
    const symbol = config.active_pair ?? "XAUUSD";

    const authHeaders = {
      "Authorization": `Bearer ${token}`,
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

AVAILABLE STRATEGIES — pick exactly ONE:
1. "Momentum Scalping" — Best for strong trending markets (ADX > 25) with clear directional momentum. Rides the trend with tight stops. Ideal when ADX is high and RSI confirms direction.
2. "Range Breakout" — Best when ADX is low (ranging) and price is consolidating near key levels, about to break out. Captures the breakout move with momentum.
3. "Volatility Spike" — Best during sudden volatility expansion (high ATR spike) or news events. Capitalizes on sharp directional moves. Use when ATR is unusually high.
4. "HFT Scalper" — Best for highly liquid pairs with very low spread (< 3 pips). Opens/closes many small trades rapidly for tiny pip gains. Only when spread is low.
5. "Grid Trading" — Best for ranging/choppy markets where price oscillates in a band (low ADX, neutral RSI). Places buy/sell orders at fixed intervals to profit from oscillation.
6. "Liquidity Sweep Scalping" — Best when price is likely to sweep liquidity pools (stop hunts) before reversing. Detects false breakouts. Good near key levels with mixed signals.
7. "Hedge Scalper" — Best for uncertain/volatile markets where direction is unclear. Opens Buy+Sell simultaneously, closes winner when loser hits SL. Good when trend direction is ambiguous.

DECISION RULES:
- If ADX > 25 and RSI confirms direction → Momentum Scalping
- If ADX < 20 and price oscillating → Grid Trading or Range Breakout
- If spread > 5 pips → avoid HFT Scalper, prefer Hedge Scalper or Momentum Scalping
- If direction ambiguous but volatility high → Hedge Scalper
- If ATR very high with clear direction → Volatility Spike or Momentum Scalping
- If near key levels with mixed signals → Liquidity Sweep Scalping

Respond with the single best strategy and a concise reason (1-2 sentences).`;

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