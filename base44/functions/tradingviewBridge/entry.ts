import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api";

function maskAccount(acct) {
  if (!acct) return "";
  const s = String(acct);
  if (s.length <= 4) return s;
  return s.slice(0, 2) + "••••" + s.slice(-3);
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { action } = body;
    const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id }, '-created_date', 1);
    const userSettings = settings?.[0];

    const provisionSecret = Deno.env.get("PROVISION_SECRET");
    if (!provisionSecret) return Response.json({ error: "PROVISION_SECRET not set" }, { status: 500 });

    // Use the stored flouba_token (provisioned on signup) directly as the bridge JWT.
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
          return Response.json({ connected: false, error: "Bridge auth failed" });
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
          return Response.json({ connected: false, error: "Bridge auth failed" });
        }
        bridgeToken = tokenJson.token;
      }
    }

    const authHeaders = {
      "Authorization": `Bearer ${bridgeToken}`,
      "Content-Type": "application/json",
    };
    if (userSettings?.mt5_account)  authHeaders["X-MT5-Login"] = String(userSettings.mt5_account);
    if (userSettings?.mt5_password) authHeaders["X-MT5-Password"] = userSettings.mt5_password;
    if (userSettings?.mt5_server)   authHeaders["X-MT5-Server"] = userSettings.mt5_server;

    // ── TEST SIGNAL: send a safe TEST command to Replit. Never creates a real trade. ──
    if (action === "test") {
      const testRes = await fetch(`${BASE}/tradingview/test`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
      }).catch(() => null);
      if (!testRes) {
        return Response.json({ ok: false, error: "Replit backend not reachable — cannot send test signal." });
      }
      const testJson = await testRes.json().catch(() => ({}));
      return Response.json({ ok: testJson?.success === true || testRes.ok, data: testJson });
    }

    // ── Fetch TradingView integration status from Replit ──
    const [statusRes, riskRes, feedRes, historyRes] = await Promise.all([
      fetch(`${BASE}/tradingview/status`, { headers: authHeaders }).catch(() => null),
      fetch(`${BASE}/tradingview/risk`, { headers: authHeaders }).catch(() => null),
      fetch(`${BASE}/tradingview/feed?limit=30`, { headers: authHeaders }).catch(() => null),
      fetch(`${BASE}/tradingview/history?limit=100`, { headers: authHeaders }).catch(() => null),
    ]);

    let status = null, risk = null, feed = [], history = [];
    if (statusRes?.ok) { const j = await statusRes.json().catch(() => ({})); status = j?.data || j; }
    if (riskRes?.ok) { const j = await riskRes.json().catch(() => ({})); risk = j?.data || j; }
    if (feedRes?.ok) { const j = await feedRes.json().catch(() => ({})); feed = j?.events || j?.feed || j?.data?.events || []; }
    if (historyRes?.ok) { const j = await historyRes.json().catch(() => ({})); history = j?.signals || j?.history || j?.data?.signals || []; }

    const connected = !!(status || risk || (Array.isArray(feed) && feed.length) || (Array.isArray(history) && history.length));

    // ── Sync signal history into TradingViewSignal entity ──
    if (Array.isArray(history) && history.length) {
      const existing = await base44.entities.TradingViewSignal.filter({ created_by_id: user.id }, "-created_date", 200).catch(() => []);
      const existingIds = new Set((existing || []).map(s => s.command_id).filter(Boolean));
      const newRecords = history
        .filter(s => s.command_id && !existingIds.has(s.command_id))
        .map(s => ({
          received_at: s.received_at || s.time || new Date().toISOString(),
          strategy: s.strategy || "",
          symbol: s.symbol || "",
          action: (s.action || "").toUpperCase(),
          timeframe: s.timeframe || "",
          signal_score: s.signal_score ?? null,
          accepted: s.accepted ?? (s.validation === "Accepted"),
          rejection_reason: s.rejection_reason || s.reason || "",
          command_id: s.command_id || "",
          mt5_status: s.mt5_status || s.execution_status || "Pending",
          ticket: s.ticket || "",
          entry_price: s.entry_price ?? null,
          stop_loss: s.stop_loss ?? null,
          take_profit: s.take_profit ?? null,
          error_message: s.error_message || "",
        }));
      if (newRecords.length) {
        await base44.entities.TradingViewSignal.bulkCreate(newRecords).catch(() => {});
      }
    }

    return Response.json({
      ok: true,
      connected,
      webhookUrl: `${BASE}/tradingview/webhook`,
      status,
      risk,
      feed,
      account: userSettings ? {
        masked: maskAccount(userSettings.mt5_account),
        broker: userSettings.broker_name || "",
        server: userSettings.mt5_server || "",
      } : null,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});