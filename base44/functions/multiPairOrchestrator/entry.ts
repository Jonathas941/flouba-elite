import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { resolveUserApiKey, postCommand } from '../../shared/mt5Bridge.ts';

const BASE = (() => {
  let v = (Deno.env.get("FLOUBA_BACKEND_URL") || "").trim().replace(/\/+$/, "");
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  v = v.replace(/\/api$/i, "");
  return v + "/api";
})();

const KNOWN_PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD"];

function stripSuffix(sym) {
  if (typeof sym !== "string") return { base: sym, suffix: "" };
  for (const base of KNOWN_PAIRS) {
    if (sym.startsWith(base) && sym.length > base.length) return { base, suffix: sym.slice(base.length) };
  }
  return { base: sym, suffix: "" };
}

function buildHeaders(token, config) {
  const h = { "X-Api-Key": token || "" /* per-user key only (multi-user isolation) */, "Content-Type": "application/json" };
  return h;
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch {}

    // Auth: cron secret (scheduled automation) OR admin user (manual call)
    const cronSecret = Deno.env.get("CRON_SECRET");
    const secretMatch = cronSecret && (
      req.headers.get("X-Cron-Secret") === cronSecret ||
      body.cron_secret === cronSecret
    );

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    if (!secretMatch) {
      const isAuth = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuth) return Response.json({ error: "Unauthorized" }, { status: 403 });
      const user = await base44.auth.me().catch(() => null);
      if (user && user.role !== "admin") return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const provisionSecret = Deno.env.get("PROVISION_SECRET");
    if (!provisionSecret) return Response.json({ error: "PROVISION_SECRET not set" }, { status: 500 });

    const allSettings = await base44.asServiceRole.entities.BotSettings.list();
    const allUsers = await base44.asServiceRole.entities.User.list();
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    async function getJwt(userId) {
      const u = userMap.get(userId);
      if (u?.flouba_token) return u.flouba_token;
      let apiKey = u?.mt5_api_key;
      if (!apiKey) {
        const provisionRes = await fetch(`${BASE}/provision/user`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${provisionSecret}`, "Content-Type": "application/json" },
          body: JSON.stringify({ base44_user_id: userId, email: u?.email, name: u?.full_name || u?.email }),
        });
        const provisionJson = await provisionRes.json().catch(() => ({}));
        if (!provisionJson?.success || !provisionJson?.api_key) return null;
        apiKey = provisionJson.api_key;
        const updateData = { mt5_api_key: apiKey };
        if (provisionJson.user_token) updateData.flouba_token = provisionJson.user_token;
        await base44.asServiceRole.entities.User.update(userId, updateData);
        userMap.set(userId, { ...u, ...updateData });
        if (provisionJson.user_token) return provisionJson.user_token;
      }
      const tokenRes = await fetch(`${BASE}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      const tokenJson = await tokenRes.json().catch(() => ({}));
      return tokenJson?.token || null;
    }

    const results = [];

    for (const config of allSettings) {
      // Only process users with MT5 credentials and multi-pair enabled
      if (!config.mt5_account || !config.mt5_password || !config.mt5_server) {
        results.push({ user: config.created_by_id, skipped: "No MT5 credentials" });
        continue;
      }
      if (!config.multi_pair_enabled) {
        results.push({ user: config.created_by_id, skipped: "Multi-pair disabled" });
        continue;
      }

      const jwt = await resolveUserApiKey(base44, config.created_by_id); // owner's own bridge key
      if (!jwt) { results.push({ user: config.created_by_id, skipped: "Bridge auth failed" }); continue; }
      const authHeaders = buildHeaders(jwt, config);

      // Check robot is running
      const robotRes = await fetch(`${BASE}/robot/status`, { headers: authHeaders });
      const robotJson = await robotRes.json().catch(() => ({}));
      const robotRunning = robotJson?.running ?? robotJson?.robot?.running ?? false;
      if (!robotRunning) {
        results.push({ user: config.created_by_id, skipped: "Robot not running" });
        continue;
      }

      // Fetch open positions
      const posRes = await fetch(`${BASE}/positions`, { headers: authHeaders });
      const posJson = await posRes.json().catch(() => ({}));
      const positions = posJson?.positions ?? [];
      const openSymbols = new Set(positions.map(p => (p.symbol || "").toUpperCase()));
      const maxTrades = config.max_concurrent_trades ?? 2;
      const availableSlots = maxTrades - positions.length;

      if (availableSlots <= 0) {
        results.push({ user: config.created_by_id, openPositions: positions.length, skipped: "Max concurrent trades reached" });
        continue;
      }

      // Fetch all symbol quotes
      const quotesRes = await fetch(`${BASE}/symbols`, { headers: authHeaders }).catch(() => null);
      let rawSymbols = [];
      if (quotesRes?.ok) {
        const j = await quotesRes.json().catch(() => ({}));
        rawSymbols = Array.isArray(j?.symbols) ? j.symbols : (Array.isArray(j) ? j : []);
      }

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

      if (pairData.length === 0) {
        results.push({ user: config.created_by_id, skipped: "No live quotes" });
        continue;
      }

      // Filter out pairs that already have open positions
      const availablePairs = pairData.filter(p => !openSymbols.has(p.symbol));
      const selectCount = Math.min(config.multi_pair_count ?? 3, availableSlots, availablePairs.length);

      if (availablePairs.length === 0 || selectCount <= 0) {
        results.push({ user: config.created_by_id, openPositions: positions.length, skipped: "All selected pairs already open" });
        continue;
      }

      // AI removed — spread-based pair selection (external server handles analysis)
      const maxSpread = config.spread_filter ? (config.hft_mode_enabled ? 100 : 30) : 999;

      // Select lowest-spread pairs and determine direction from bid/ask momentum
      const sortedPairs = [...availablePairs]
        .filter(p => (p.spread ?? 999) <= maxSpread)
        .sort((a, b) => (a.spread ?? 999) - (b.spread ?? 999))
        .slice(0, selectCount);

      const tradeRecs = sortedPairs.map(p => ({
        symbol: p.symbol,
        direction: p.bid >= p.ask ? "BUY" : "SELL",
        reason: `Lowest spread (${p.spread?.toFixed(1) ?? "N/A"} pts) — ${p.bid >= p.ask ? "bullish" : "bearish"} quote.`,
      }));

      // ── Execute trades via the bridge ──
      const executed = [];
      const lotSize = config.lot_size ?? 0.01;

      for (const rec of tradeRecs) {
        const route = rec.direction === "BUY" ? "buy" : "sell";
        // Route through the shared payload builder — validates symbol, positive
        // lot, and finite positive SL/TP before sending. Multi-pair has no
        // strategy SL/TP, so the order is rejected with INVALID_SIGNAL_PAYLOAD
        // rather than sent with nulls.
        const mpIdemKey = `mp-${route}-${config.mt5_account}-${rec.symbol}-${Date.now()}`;
        const tradeRes = await postCommand(String(config.mt5_account), {
          action: route,
          symbol: rec.symbol,
          lot: lotSize,
          sl: null,
          tp: null,
        }, mpIdemKey, jwt, "multiPairOrchestrator", null);

        const tradeJson = tradeRes?.data || {};
        const queued = tradeRes?.ok === true;

        executed.push({
          symbol: rec.symbol,
          direction: rec.direction,
          reason: rec.reason,
          queued,
          commandId: tradeJson?.commandId || null,
        });

        // Log notification
        await base44.asServiceRole.entities.Notification.create({
          type: "trade",
          title: `Multi-Pair ${rec.direction}`,
          message: `${rec.direction} ${rec.symbol} at ${lotSize} lot — ${rec.reason || "AI signal"}`,
          category: queued ? "success" : "warning",
          meta: { symbol: rec.symbol, direction: rec.direction, lot: lotSize, source: "multiPairOrchestrator" },
          created_by_id: config.created_by_id,
        }).catch(() => {});
      }

      results.push({
        user: config.created_by_id,
        login: config.mt5_account,
        openPositions: positions.length,
        pairsScanned: pairData.length,
        pairsAvailable: availablePairs.length,
        tradesExecuted: executed,
        aiReasoning: "Spread-based selection (AI removed)",
      });
    }

    return Response.json({
      ok: true,
      usersChecked: results.length,
      results,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});