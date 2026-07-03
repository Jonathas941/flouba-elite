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

    const globalToken = Deno.env.get("MT5_API_TOKEN");
    if (!globalToken) return Response.json({ error: "MT5_API_TOKEN not set" }, { status: 500 });

    // Fetch the user's MT5 credentials from BotSettings (per-user account)
    const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id });
    const userSettings = settings?.[0];

    // Determine which credentials to use for this user
    // Priority 1: manually-entered credentials from ConnectMT5 (BotSettings)
    // Priority 2: provisioned API key from the MT5 server (stored on User entity)
    let hasManualCreds = !!userSettings?.mt5_account;
    let hasProvisionedKey = !hasManualCreds && !!user?.mt5_api_key;

    // CRITICAL: If the user has no MT5 credentials at all, return "not connected".
    // Do NOT call the server — it would fall back to a default/admin account,
    // leaking another user's personal account details.
    if (!hasManualCreds && !hasProvisionedKey) {
      return Response.json({
        ok: false,
        status: 200,
        data: { account: { connected: false }, positions: [], robot: { running: false } },
        error: "MT5 account not connected — please connect your own account.",
      }, { status: 200 });
    }

    // Build auth headers — use provisioned API key as Bearer when available,
    // otherwise the global token + per-user login/password/server headers.
    const authHeaders = { "Content-Type": "application/json" };
    if (hasProvisionedKey) {
      authHeaders["Authorization"] = `Bearer ${user.mt5_api_key}`;
      if (user?.mt5_slug) authHeaders["X-MT5-Slug"] = user.mt5_slug;
    } else {
      authHeaders["Authorization"] = `Bearer ${globalToken}`;
      if (userSettings?.mt5_account)  authHeaders["X-MT5-Login"] = String(userSettings.mt5_account);
      if (userSettings?.mt5_password) authHeaders["X-MT5-Password"] = userSettings.mt5_password;
      if (userSettings?.mt5_server)   authHeaders["X-MT5-Server"] = userSettings.mt5_server;
    }

    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }
    const { action, ...params } = body;

    const ROUTES = {
      status:         ["GET",  "/status"],
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