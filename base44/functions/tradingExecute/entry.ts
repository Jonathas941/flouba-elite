import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ═══════════════════════════════════════════════════════════════
// Independent Trading Execution API
// POST /api/functions/tradingExecute
//
// Supports: OANDA (REST) and cTrader (OAuth 2.0 + bridge)
//
// cTrader flow:
//   TradingView Webhook → Validate → Load cTrader Connection
//   → Refresh OAuth Token if Necessary → Authenticate cTrader App
//   → Authenticate Selected cTrader Account → Normalize Symbol
//   → Submit Market Order → Wait for Execution Confirmation
//   → Save cTrader Order ID and Position ID → Display Result
//
// Since the platform doesn't support raw TCP, cTrader protobuf/TCP
// communication is handled by a bridge service (CTRADER_BRIDGE_URL).
// ═══════════════════════════════════════════════════════════════

function isCron(req, body) {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return false;
  return req.headers.get("X-Cron-Secret") === secret || body?.cron_secret === secret;
}

const CTRADER_TOKEN_URL = "https://openapi.ctrader.com/apps/token";

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body: any = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    let userId = body.user_id;
    const cron = isCron(req, body);

    if (!cron) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ success: false, status: "error", message: "Unauthorized" }, { status: 401 });
      userId = user.id;
    }
    if (!userId) return Response.json({ success: false, status: "error", message: "No user context" }, { status: 401 });

    const { action, symbol, quantity, price, mode } = body;

    if (!action || !symbol || quantity == null) {
      return Response.json({ success: false, status: "error", message: "Missing required fields: action, symbol, quantity" });
    }

    // ── Load user's execution connection ──
    const connections = await base44.asServiceRole.entities.TradingExecutionConnection.filter(
      { created_by_id: userId }, "-created_date", 1
    );
    const conn = connections?.[0];

    if (!conn || conn.connection_status !== "Connected") {
      return Response.json({ success: false, status: "error", message: `Trading execution API ${conn?.connection_status ? conn.connection_status : "not connected"}` });
    }

    // ═══════════════════════════════════════════════════
    // cTrader execution flow
    // ═══════════════════════════════════════════════════
    if (conn.provider_type === "ctrader") {
      if (!conn.ctrader_account_id) {
        await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
          connection_status: "Account Not Found",
          last_connection_error: "No cTrader account selected",
        });
        return Response.json({ success: false, status: "error", message: "No cTrader account selected" });
      }

      let accessToken = conn.encrypted_access_token;
      const clientId = conn.client_id;
      const clientSecret = conn.encrypted_client_secret;
      const refreshToken = conn.encrypted_refresh_token;

      // ── Refresh OAuth token if expired ──
      const expiresAt = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
      const now = Date.now();
      if (now >= expiresAt - 30000) {
        try {
          const refreshRes = await fetch(CTRADER_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: refreshToken,
              client_id: clientId,
              client_secret: clientSecret,
            }),
          });
          if (!refreshRes.ok) {
            const errText = await refreshRes.text().catch(() => "");
            await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
              connection_status: "Token Expired",
              last_connection_error: `Token refresh failed: ${errText}`,
            });
            return Response.json({ success: false, status: "error", message: `Token expired: ${errText}` });
          }
          const refreshJson = await refreshRes.json();
          accessToken = refreshJson.access_token;
          const newExpiresAt = new Date(now + (refreshJson.expires_in || 300) * 1000).toISOString();
          await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
            encrypted_access_token: accessToken,
            encrypted_refresh_token: refreshJson.refresh_token || refreshToken,
            access_token_expires_at: newExpiresAt,
            connection_status: "Connected",
            last_connection_error: null,
          });
        } catch (e) {
          await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
            connection_status: "Token Expired",
            last_connection_error: e.message,
          });
          return Response.json({ success: false, status: "error", message: `Token expired: ${e.message}` });
        }
      }

      // ── Get bridge URL ──
      const bridgeUrl = Deno.env.get("CTRADER_BRIDGE_URL");
      if (!bridgeUrl) {
        return Response.json({
          success: false,
          status: "error",
          message: "CTRADER_BRIDGE_URL not configured. Set up a cTrader bridge service for TCP protobuf communication.",
        });
      }

      // ── Normalize symbol ──
      const ctraderSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const ctraderVolume = Math.round(Number(quantity) * 100); // 1/100 lot format

      // ── Build bridge request ──
      const bridgePayload: any = {
        access_token: accessToken,
        client_id: clientId,
        client_secret: clientSecret,
        account_id: conn.ctrader_account_id,
        environment: conn.environment,
        action,
        symbol: ctraderSymbol,
        volume: ctraderVolume,
      };

      if (price != null) bridgePayload.price = Number(price);
      if (mode) bridgePayload.mode = mode;

      // ── Execute via bridge service ──
      const bridgeRes = await fetch(`${bridgeUrl.replace(/\/+$/, "")}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bridgePayload),
      }).catch(() => null);

      if (!bridgeRes || !bridgeRes.ok) {
        const errText = bridgeRes ? await bridgeRes.text().catch(() => "") : "bridge unreachable";
        await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
          connection_status: "Connection Error",
          last_connection_error: `Bridge error: ${errText}`,
        });
        return Response.json({ success: false, status: "error", message: `cTrader bridge error: ${errText}` });
      }

      const bridgeJson = await bridgeRes.json().catch(() => ({}));

      // ── Check for demo/live mismatch ──
      if (bridgeJson.error && (bridgeJson.error.includes("demo") || bridgeJson.error.includes("live"))) {
        await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
          connection_status: "Demo/Live Mismatch",
          last_connection_error: bridgeJson.error,
        });
        return Response.json({ success: false, status: "error", message: bridgeJson.error });
      }

      // ── Check for account not found ──
      if (bridgeJson.error && bridgeJson.error.includes("not found")) {
        await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
          connection_status: "Account Not Found",
          last_connection_error: bridgeJson.error,
        });
        return Response.json({ success: false, status: "error", message: bridgeJson.error });
      }

      // ── Check for execution confirmation ──
      if (!bridgeJson.success || !bridgeJson.order_id) {
        const errMsg = bridgeJson.error || bridgeJson.message || "No execution confirmation received";
        await base44.asServiceRole.entities.TradingExecutionConnection.update(conn.id, {
          connection_status: "Connection Error",
          last_connection_error: errMsg,
        });
        return Response.json({ success: false, status: "error", message: errMsg });
      }

      return Response.json({
        success: true,
        status: "executed",
        order_id: bridgeJson.order_id,
        position_id: bridgeJson.position_id || null,
        symbol: ctraderSymbol,
        action,
        quantity: Number(quantity),
        message: "cTrader order executed successfully",
      });
    }

    // ═══════════════════════════════════════════════════
    // OANDA execution flow (existing)
    // ═══════════════════════════════════════════════════
    if (!conn.encrypted_api_key || !conn.api_base_url) {
      return Response.json({ success: false, status: "error", message: "Trading execution API disconnected" });
    }

    const apiBase = conn.api_base_url.replace(/\/+$/, "");
    const orderTypeMap: Record<string, string> = {
      BUY: "market_buy",
      SELL: "market_sell",
      CLOSE: "close_all",
      CLOSE_BUY: "close_buy",
      CLOSE_SELL: "close_sell",
    };
    const orderType = orderTypeMap[action];
    if (!orderType) {
      return Response.json({ success: false, status: "error", message: `Unsupported action: ${action}` });
    }

    const brokerRes = await fetch(`${apiBase}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${conn.encrypted_api_key}`,
        "X-API-Secret": conn.encrypted_api_secret || "",
        "X-Account-ID": conn.account_id || "",
      },
      body: JSON.stringify({
        account_id: conn.account_id,
        symbol,
        action: orderType,
        quantity: Number(quantity),
        price: price != null ? Number(price) : undefined,
        mode: mode || "live",
        source: "tradingview",
      }),
    }).catch(() => null);

    if (!brokerRes || !brokerRes.ok) {
      const errText = brokerRes ? await brokerRes.text().catch(() => "") : "no response";
      return Response.json({ success: false, status: "error", message: `Broker API error: ${errText || "unreachable"}` });
    }

    const brokerJson = await brokerRes.json().catch(() => ({}));
    const orderId = brokerJson?.order_id || brokerJson?.orderId || brokerJson?.id || null;

    if (!orderId) {
      return Response.json({ success: false, status: "error", message: "Broker accepted request but no order ID returned" });
    }

    return Response.json({
      success: true,
      status: "executed",
      order_id: orderId,
      symbol,
      action,
      quantity: Number(quantity),
      message: "Order executed successfully",
    });
  } catch (err) {
    return Response.json({ success: false, status: "error", message: err.message }, { status: 500 });
  }
});