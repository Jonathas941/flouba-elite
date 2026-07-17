import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://dazzling-perception-production-8e53.up.railway.app/api";

const KNOWN_PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD"];

function buildHeaders(token, config) {
  const h = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  if (config.mt5_account) h["X-MT5-Login"] = String(config.mt5_account);
  if (config.mt5_password) h["X-MT5-Password"] = config.mt5_password;
  if (config.mt5_server) h["X-MT5-Server"] = config.mt5_server;
  return h;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(new Request(req.url, { method: "GET", headers: req.headers }));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id }, "-created_date", 1);
    const cfg = settings?.[0];
    if (!cfg?.mt5_account) {
      return Response.json({ ok: false, error: "MT5 account not connected", pairs: [] });
    }

    // ── Get bridge JWT (same pattern as tradeDecisionEngine) ──
    let bridgeToken = user.flouba_token;
    if (!bridgeToken) {
      let apiKey = user.mt5_api_key;
      if (!apiKey) {
        const provisionSecret = Deno.env.get("PROVISION_SECRET");
        if (!provisionSecret) return Response.json({ error: "PROVISION_SECRET not set" }, { status: 500 });
        const provisionRes = await fetch(`${BASE}/provision/user`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${provisionSecret}`, "Content-Type": "application/json" },
          body: JSON.stringify({ base44_user_id: user.id, email: user.email, name: user.full_name || user.email }),
        });
        const provisionJson = await provisionRes.json().catch(() => ({}));
        if (!provisionJson?.success || !provisionJson?.api_key) {
          return Response.json({ ok: false, error: "Failed to provision bridge account", pairs: [] });
        }
        apiKey = provisionJson.api_key;
        const updateData = { mt5_api_key: apiKey };
        if (provisionJson.user_token) updateData.flouba_token = provisionJson.user_token;
        if (provisionJson.ea_download_url) updateData.ea_download_url = provisionJson.ea_download_url;
        await base44.auth.updateMe(updateData);
        bridgeToken = provisionJson.user_token || null;
      }
      if (!bridgeToken) {
        const tokenRes = await fetch(`${BASE}/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: apiKey }),
        });
        const tokenJson = await tokenRes.json().catch(() => ({}));
        bridgeToken = tokenJson?.token || null;
      }
    }
    if (!bridgeToken) return Response.json({ ok: false, error: "Bridge auth failed", pairs: [] });

    const authHeaders = buildHeaders(bridgeToken, cfg);

    // ── Fetch all symbol quotes from the bridge ──
    const quotesRes = await fetch(`${BASE}/symbols`, { headers: authHeaders }).catch(() => null);
    let rawSymbols = [];
    if (quotesRes?.ok) {
      const j = await quotesRes.json().catch(() => ({}));
      rawSymbols = Array.isArray(j?.symbols) ? j.symbols : (Array.isArray(j) ? j : []);
    }

    // Normalize + filter to known pairs (strip broker suffixes)
    const pairData = rawSymbols
      .map((s) => {
        const sym = (s.symbol || s.name || "").toUpperCase();
        const bid = Number(s.bid);
        const ask = Number(s.ask);
        return {
          symbol: sym,
          bid: isNaN(bid) ? null : bid,
          ask: isNaN(ask) ? null : ask,
          spread: s.spread != null ? Number(s.spread) : (isNaN(bid) || isNaN(ask) ? null : (ask - bid)),
        };
      })
      .filter((s) => s.bid != null && s.bid > 0 && KNOWN_PAIRS.some((p) => s.symbol.startsWith(p)));

    const count = Math.min(Math.max(cfg.multi_pair_count ?? 3, 1), 8);

    if (pairData.length === 0) {
      return Response.json({ ok: false, error: "No live pair quotes available", pairs: [] });
    }

    // ── Ask AI to rank pairs for trading suitability ──
    const sessionInfo = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit",
    }).format(new Date());

    const llmRes = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a multi-pair trading analyst. Below are live MT5 quotes at ${sessionInfo} (NY time).

Rank the top ${count} pairs best suited for trading RIGHT NOW. Consider:
- Spread (lower = cheaper = better)
- Pair liquidity and trend potential during the current session
- XAUUSD (Gold) excels during London/NY overlap
- EURUSD/GBPUSD strong during London/NY
- USDJPY active during Asian/London
- NAS100/US30 active during NY
- BTCUSD is 24/7 but volatile

Live quotes (symbol, spread):
${JSON.stringify(pairData.map((p) => ({ symbol: p.symbol, spread: p.spread })), null, 2)}

Return the top ${count} pair symbols as a JSON array of strings, best first.`,
      response_json_schema: {
        type: "object",
        properties: {
          pairs: { type: "array", items: { type: "string" } },
          reasoning: { type: "string" },
        },
        required: ["pairs"],
      },
    });

    // Filter AI picks to valid known pairs
    let selected = (Array.isArray(llmRes?.pairs) ? llmRes.pairs : [])
      .filter((p) => KNOWN_PAIRS.some((kp) => p.toUpperCase().startsWith(kp.toUpperCase())))
      .map((p) => p.toUpperCase());

    // Fallback: fill remaining slots by lowest spread
    if (selected.length < count) {
      const bySpread = [...pairData].sort((a, b) => (a.spread ?? 999) - (b.spread ?? 999));
      for (const p of bySpread) {
        if (selected.includes(p.symbol)) continue;
        selected.push(p.symbol);
        if (selected.length >= count) break;
      }
    }
    selected = selected.slice(0, count);

    return Response.json({
      ok: true,
      pairs: selected,
      reasoning: llmRes?.reasoning || null,
      count,
      available: pairData.length,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});