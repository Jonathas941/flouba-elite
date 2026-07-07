import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api";

Deno.serve(async (req) => {
  try {
    // Read body FIRST — the SDK may consume the body stream during auth
    const bodyText = await req.text().catch(() => "{}");

    // Create a new bodyless request from headers only so SDK can auth without touching body
    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch the user's MT5 credentials from BotSettings (per-user account)
    const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id }, '-created_date', 1);
    const userSettings = settings?.[0];

    // Only use manually-entered credentials from ConnectMT5 (BotSettings).
    // Each user must connect their own MT5 account — no shared credentials.
    if (!userSettings?.mt5_account) {
      return Response.json({
        ok: false,
        status: 200,
        data: { account: { connected: false }, positions: [], robot: { running: false } },
        error: "MT5 account not connected — please connect your own account.",
      }, { status: 200 });
    }

    // Use the stored flouba_token (provisioned on signup) directly as the bridge JWT.
    // Fallback: exchange the legacy api_key for a JWT if flouba_token isn't set yet.
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
          return Response.json({ ok: false, error: "Failed to provision bridge account" }, { status: 200 });
        }
        apiKey = provisionJson.api_key;
        const updateData = { mt5_api_key: apiKey };
        if (provisionJson.slug) { updateData.mt5_slug = provisionJson.slug; updateData.flouba_slug = provisionJson.slug; }
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
        if (!tokenRes.ok || !tokenJson?.token) {
          return Response.json({ ok: false, error: "Failed to authenticate with MT5 bridge" }, { status: 200 });
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

    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }
    const { action, ...params } = body;

    const ROUTES = {
      status:         ["GET",  "/status"],
      connect:        ["POST", "/connect"],
      account:        ["GET",  "/account"],
      positions:      ["GET",  "/positions"],
      robot_status:   ["GET",  "/robot/status"],
      robot_start:    ["POST", "/robot/start"],
      robot_stop:     ["POST", "/robot/stop"],
      buy:            ["POST", "/trade/buy"],
      sell:           ["POST", "/trade/sell"],
      close:          ["POST", "/trade/close"],
      close_all:      ["POST", "/trade/close_all"],
      history:        ["GET",  "/history"],
      symbols:        ["GET",  "/symbols"],
      rates:          ["GET",  "/rates"],
      scanner_status: ["GET",  "/scanner/status"],
    };

    const route = ROUTES[action];
    if (!route) return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

    const [method, path] = route;

    let url = `${BASE}${path}`;
    if (method === "GET" && Object.keys(params).length > 0) {
      const qs = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString();
      url = `${url}?${qs}`;
    }

    const fetchOpts = {
      method,
      headers: authHeaders,
      ...(method === "POST" ? { body: JSON.stringify(params) } : {}),
    };

    const res = await fetch(url, fetchOpts);
    const rawText = await res.text();
    let data;
    try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

    if (!res.ok) {
      const errMsg = data?.detail || data?.message || data?.error || `HTTP ${res.status}`;
      return Response.json({ ok: false, status: res.status, data, error: errMsg }, { status: 200 });
    }

    return Response.json({ ok: true, status: res.status, data }, { status: 200 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});