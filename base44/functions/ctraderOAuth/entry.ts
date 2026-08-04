import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ═══════════════════════════════════════════════════════════════
// cTrader OAuth 2.0 Flow
// POST /api/functions/ctraderOAuth
//
// Actions:
//   auth          — Save credentials, return cTrader authorization URL
//   callback      — Exchange auth code for tokens, retrieve account list
//   refresh       — Refresh the access token
//   select_account — Save the selected cTrader account ID
// ═══════════════════════════════════════════════════════════════

const CTRADER_AUTH_URL = "https://openapi.ctrader.com/apps/auth";
const CTRADER_TOKEN_URL = "https://openapi.ctrader.com/apps/token";
const CTRADER_CLIENTS_URL = "https://openapi.ctrader.com/apps/clients";

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body: any = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { action } = body;

    // ── Load existing connection ──
    const connections = await base44.asServiceRole.entities.TradingExecutionConnection.filter(
      { created_by_id: user.id }, "-created_date", 1
    );
    let conn = connections?.[0];

    // ═══════════════════════════════════════════════════
    // action=auth: Save credentials and return auth URL
    // ═══════════════════════════════════════════════════
    if (action === "auth") {
      const { client_id, client_secret, redirect_uri, environment } = body;
      if (!client_id || !client_secret || !redirect_uri) {
        return Response.json({ success: false, message: "Missing client_id, client_secret, or redirect_uri" }, { status: 400 });
      }

      const payload: any = {
        provider_type: "ctrader",
        provider_name: body.provider_name || "IC Markets cTrader",
        environment: environment || "demo",
        client_id,
        encrypted_client_secret: client_secret,
        connection_status: "Authorization Required",
        last_connection_error: null,
      };

      if (conn) {
        await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, payload);
      } else {
        conn = await base44.asServiceRole.entities.TradingExecutionConnection.create({
          created_by_id: user.id,
          ...payload,
        });
      }

      const authUrl = `${CTRADER_AUTH_URL}?client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=accounts+trade`;

      return Response.json({ success: true, auth_url: authUrl });
    }

    // ═══════════════════════════════════════════════════
    // action=callback: Exchange code for tokens, get account list
    // ═══════════════════════════════════════════════════
    if (action === "callback") {
      const { code, redirect_uri } = body;
      if (!code || !redirect_uri) {
        return Response.json({ success: false, message: "Missing code or redirect_uri" }, { status: 400 });
      }
      if (!conn || !conn.client_id || !conn.encrypted_client_secret) {
        return Response.json({ success: false, message: "No cTrader connection found. Start authorization first." }, { status: 400 });
      }

      // ── Exchange code for tokens ──
      const tokenRes = await fetch(CTRADER_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri,
          client_id: conn.client_id,
          client_secret: conn.encrypted_client_secret,
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => "");
        await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
          connection_status: "Connection Error",
          last_connection_error: `Token exchange failed: ${errText}`,
        });
        return Response.json({ success: false, message: `Token exchange failed: ${errText}` }, { status: 400 });
      }

      const tokenJson = await tokenRes.json();
      const accessToken = tokenJson.access_token;
      const refreshToken = tokenJson.refresh_token;
      const expiresIn = tokenJson.expires_in || 300;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // ── Retrieve account list ──
      let accounts: any[] = [];
      try {
        const acctRes = await fetch(`${CTRADER_CLIENTS_URL}?accessToken=${encodeURIComponent(accessToken)}`);
        if (acctRes.ok) {
          const acctJson = await acctRes.json();
          accounts = acctJson.data || acctJson || [];
        }
      } catch {
        // If account list fails, still save tokens
      }

      await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
        encrypted_access_token: accessToken,
        encrypted_refresh_token: refreshToken,
        access_token_expires_at: expiresAt,
        connection_status: "Account Not Found",
        last_connection_error: null,
      });

      return Response.json({ success: true, accounts });
    }

    // ═══════════════════════════════════════════════════
    // action=refresh: Refresh access token
    // ═══════════════════════════════════════════════════
    if (action === "refresh") {
      if (!conn || !conn.client_id || !conn.encrypted_client_secret || !conn.encrypted_refresh_token) {
        return Response.json({ success: false, message: "No cTrader connection found" }, { status: 400 });
      }

      const refreshRes = await fetch(CTRADER_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: conn.encrypted_refresh_token,
          client_id: conn.client_id,
          client_secret: conn.encrypted_client_secret,
        }),
      });

      if (!refreshRes.ok) {
        const errText = await refreshRes.text().catch(() => "");
        await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
          connection_status: "Token Expired",
          last_connection_error: `Token refresh failed: ${errText}`,
        });
        return Response.json({ success: false, message: `Token refresh failed: ${errText}` }, { status: 400 });
      }

      const refreshJson = await refreshRes.json();
      const expiresAt = new Date(Date.now() + (refreshJson.expires_in || 300) * 1000).toISOString();

      await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
        encrypted_access_token: refreshJson.access_token,
        encrypted_refresh_token: refreshJson.refresh_token || conn.encrypted_refresh_token,
        access_token_expires_at: expiresAt,
        connection_status: conn.ctrader_account_id ? "Connected" : "Account Not Found",
        last_connection_error: null,
      });

      return Response.json({ success: true, access_token: refreshJson.access_token });
    }

    // ═══════════════════════════════════════════════════
    // action=select_account: Save selected account
    // ═══════════════════════════════════════════════════
    if (action === "select_account") {
      const { account_id } = body;
      if (!account_id) {
        return Response.json({ success: false, message: "Missing account_id" }, { status: 400 });
      }
      if (!conn) {
        return Response.json({ success: false, message: "No connection found" }, { status: 400 });
      }

      await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
        ctrader_account_id: String(account_id),
        connection_status: "Connected",
        last_connection_error: null,
      });

      return Response.json({ success: true });
    }

    return Response.json({ success: false, message: "Unknown action" }, { status: 400 });
  } catch (err) {
    return Response.json({ success: false, message: err.message }, { status: 500 });
  }
});