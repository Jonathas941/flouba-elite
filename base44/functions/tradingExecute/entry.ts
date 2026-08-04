import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ═══════════════════════════════════════════════════════════════
// Independent Trading Execution API
// POST /api/functions/tradingExecute
//
// This function is completely separate from MT5. It receives a
// validated trade command from the TradingView webhook, looks up
// the user's TradingExecutionConnection credentials, and dispatches
// the order to the configured broker API (TRADING_API_URL).
// ═══════════════════════════════════════════════════════════════

const API_BASE = (() => {
  let v = (Deno.env.get("TRADING_API_URL") || "").trim().replace(/\/+$/, "");
  if (v && !/^https?:\/\//i.test(v)) v = "https://" + v;
  return v;
})();

function isCron(req, body) {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return false;
  return req.headers.get("X-Cron-Secret") === secret || body?.cron_secret === secret;
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    // ── Auth: cron secret or authenticated user ──
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

    // ── Validate required fields ──
    if (!action || !symbol || quantity == null) {
      return Response.json({
        success: false,
        status: "error",
        message: "Missing required fields: action, symbol, quantity",
      });
    }

    // ── Check execution API is configured ──
    if (!API_BASE) {
      return Response.json({
        success: false,
        status: "error",
        message: "Trading execution API disconnected",
      });
    }

    // ── Load user's execution connection ──
    const connections = await base44.asServiceRole.entities.TradingExecutionConnection.filter(
      { created_by_id: userId }, "-created_date", 1
    );
    const conn = connections?.[0];
    if (!conn || conn.connection_status !== "Connected" || !conn.encrypted_api_key) {
      return Response.json({
        success: false,
        status: "error",
        message: "Trading execution API disconnected",
      });
    }

    // ── Map action to broker order type ──
    const orderTypeMap = {
      BUY: "market_buy",
      SELL: "market_sell",
      CLOSE: "close_all",
      CLOSE_BUY: "close_buy",
      CLOSE_SELL: "close_sell",
    };
    const orderType = orderTypeMap[action];
    if (!orderType) {
      return Response.json({
        success: false,
        status: "error",
        message: `Unsupported action: ${action}`,
      });
    }

    // ── Execute via broker API ──
    const brokerRes = await fetch(`${API_BASE}/orders`, {
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
      return Response.json({
        success: false,
        status: "error",
        message: `Broker API error: ${errText || "unreachable"}`,
      });
    }

    const brokerJson = await brokerRes.json().catch(() => ({}));
    const orderId = brokerJson?.order_id || brokerJson?.orderId || brokerJson?.id || null;

    if (!orderId) {
      return Response.json({
        success: false,
        status: "error",
        message: "Broker accepted request but no order ID returned",
      });
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
    return Response.json({
      success: false,
      status: "error",
      message: err.message,
    }, { status: 500 });
  }
});