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

    // ── Extract broker suffix from symbol, then strip it ──
    // The bridge validates `symbol` against a hardcoded whitelist of 90 base
    // symbols (XAUUSD, EURUSD, NAS100, …) and rejects suffixed names with 422.
    // Brokers like Exness append "m" / "s" suffixes (XAUUSDm, EURUSDs).
    //
    // Solution: strip the suffix so the bridge accepts the base symbol, AND pass
    // the suffix as a separate `symbol_suffix` field. The bridge passes this
    // field through to the EA in the robot config and trade commands, so the EA
    // can map the base symbol back to the broker's actual instrument name.
    if (params.symbol && typeof params.symbol === "string") {
      const knownBases = ["XAUUSD","XAUEUR","XAUUSD","EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","NAS100","US30","US500","US2000","UK100","GER40","GER30","FRA40","JPN225","AUS200","HK50","CHINA50","SWI20","USOIL","UKOIL","NATGAS","BTCUSD","ETHUSD","LTCUSD","XRPUSD","BCHUSD","ADAUSD","DOTUSD","SOLUSD","DOGUSD","BNBUSD"];
      for (const base of knownBases) {
        if (params.symbol.startsWith(base) && params.symbol.length > base.length) {
          params.symbol_suffix = params.symbol.slice(base.length);
          params.symbol = base;
          break;
        }
      }
    }

    // ── For "connect": inject the user's stored MT5 credentials into the body ──
    // The bridge /connect endpoint requires account_number + password in the body,
    // not just headers. This lets us trigger a direct bridge→MT5 server connection.
    if (action === "connect" && userSettings) {
      if (userSettings.mt5_account) params.account_number = Number(userSettings.mt5_account);
      if (userSettings.mt5_password) params.password = userSettings.mt5_password;
      if (userSettings.mt5_server) params.server = userSettings.mt5_server;
      if (userSettings.broker_name) params.broker = userSettings.broker_name;
    }

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

    // ── Privacy guard: verify the bridge returned THIS user's account data ──
    // The bridge runs a shared MT5 terminal — if another user's EA is connected,
    // the /account and /positions endpoints could return their data. Reject any
    // response whose account number doesn't match the user's stored credentials.
    if (data?.account?.login || data?.account?.account) {
      const returnedLogin = String(data.account.login || data.account.account || "");
      const userLogin = String(userSettings.mt5_account || "");
      if (returnedLogin && userLogin && returnedLogin !== userLogin) {
        return Response.json({
          ok: false,
          status: 200,
          data: { account: { connected: false }, positions: [], robot: { running: false } },
          error: "Account mismatch — the bridge returned a different account. Please ensure your EA is connected to your own MT5 account.",
        }, { status: 200 });
      }
    }

    // ── Persist the user's account snapshot to the database (per-user storage) ──
    // Each user's balance/equity/profit is stored in their own BotSettings record,
    // so the dashboard always shows personal data — never another user's.
    if (data?.account && userSettings?.id) {
      const a = data.account;
      const patch = {};
      if (a.balance != null) patch.balance = a.balance;
      if (a.equity != null) patch.equity = a.equity;
      if (a.margin != null) patch.margin = a.margin;
      if (a.margin_free != null || a.free_margin != null) patch.free_margin = a.margin_free ?? a.free_margin;
      if (a.profit != null) patch.profit_today = a.profit;
      if (Object.keys(patch).length > 0) {
        await base44.entities.BotSettings.update(userSettings.id, patch).catch(() => {});
      }
    }

    return Response.json({ ok: true, status: res.status, data }, { status: 200 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});