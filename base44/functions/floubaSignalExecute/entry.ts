import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const BASE = (() => {
  let v = (Deno.env.get("FLOUBA_BACKEND_URL") || "").trim().replace(/\/+$/, "");
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  v = v.replace(/\/api$/i, "");
  return v + "/api";
})();

const KNOWN_BASES = ["XAUUSD","XAUEUR","EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","NAS100","US30","US500","US2000","UK100","GER40","GER30","FRA40","JPN225","AUS200","HK50","CHINA50","SWI20","USOIL","UKOIL","NATGAS","BTCUSD","ETHUSD","LTCUSD","XRPUSD","BCHUSD","ADAUSD","DOTUSD","SOLUSD","DOGUSD","BNBUSD"];
function stripSuffix(sym) {
  if (typeof sym !== "string") return { base: sym, suffix: "" };
  for (const base of KNOWN_BASES) {
    if (sym.startsWith(base) && sym.length > base.length) return { base, suffix: sym.slice(base.length) };
  }
  return { base: sym, suffix: "" };
}

function buildHeaders(token, config) {
  const h = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  if (config?.mt5_account) h["X-MT5-Login"] = String(config.mt5_account);
  if (config?.mt5_password) h["X-MT5-Password"] = config.mt5_password;
  if (config?.mt5_server) h["X-MT5-Server"] = config.mt5_server;
  return h;
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    const isAuth = await base44.auth.isAuthenticated().catch(() => false);
    if (!isAuth) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const signalId = body.signal_id;
    const action = body.action; // "execute" | "place_pending" | "cancel"
    if (!signalId || !action) return Response.json({ error: "signal_id and action required" }, { status: 400 });

    const signal = await base44.entities.FloubaSignal.get(signalId).catch(() => null);
    if (!signal) return Response.json({ error: "Signal not found" }, { status: 404 });
    if (signal.created_by_id !== user.id && user.role !== "admin")
      return Response.json({ error: "Not your signal" }, { status: 403 });

    if (signal.status === "EXECUTED") return Response.json({ ok: false, error: "Signal already executed" });
    if (signal.status === "EXPIRED") return Response.json({ ok: false, error: "Signal expired" });
    if (signal.status === "CANCELLED") return Response.json({ ok: false, error: "Signal cancelled" });

    const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id }, "-created_date", 1);
    const config = settings?.[0];
    if (!config) return Response.json({ error: "No BotSettings found" }, { status: 400 });

    const bridgeToken = user.flouba_token;
    if (!bridgeToken) return Response.json({ error: "No bridge token" }, { status: 400 });

    const authHeaders = buildHeaders(bridgeToken, config);
    const { base: baseSym, suffix } = stripSuffix(signal.symbol);

    // ═══ CANCEL ═══
    if (action === "cancel") {
      await base44.entities.FloubaSignal.update(signalId, {
        status: "CANCELLED",
        cancelled_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, action: "cancelled", signal_id: signalId });
    }

    // ═══ EXECUTE (BUY NOW / SELL NOW — market order) ═══
    if (action === "execute") {
      const tradeAction = signal.direction === "BUY" ? "buy" : "sell";
      const orderBody = {
        symbol: baseSym,
        volume: signal.lot_size,
        sl: signal.stop_loss,
        tp: signal.take_profit,
        magic: signal.magic_number ?? 20260001,
        comment: signal.comment || "Flouba Gold HFT",
      };
      if (suffix) { orderBody.broker_symbol = signal.symbol; orderBody.symbol_suffix = suffix; }

      const tradeRes = await fetch(`${BASE}/trade/${tradeAction}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(orderBody),
      }).catch(() => null);

      const tradeJson = tradeRes?.ok ? await tradeRes.json().catch(() => ({})) : {};
      const execSuccess = tradeJson?.success === true || tradeRes?.ok;

      if (execSuccess) {
        await base44.entities.FloubaSignal.update(signalId, {
          status: "EXECUTED",
          executed_at: new Date().toISOString(),
          ticket_id: tradeJson?.ticket || tradeJson?.order || null,
        });
        try {
          await base44.entities.Trade.create({
            pair: signal.symbol,
            direction: signal.direction === "BUY" ? "Buy" : "Sell",
            lot: signal.lot_size,
            entry_price: signal.entry_price,
            stop_loss: signal.stop_loss,
            take_profit: signal.take_profit,
            status: "Open",
            pattern: signal.strategy_name,
            opened_at: new Date().toISOString(),
            ticket_id: tradeJson?.ticket || tradeJson?.order || String(Date.now()),
          });
        } catch {}
        return Response.json({ ok: true, action: "executed", signal_id: signalId, ticket: tradeJson?.ticket || tradeJson?.order });
      } else {
        return Response.json({ ok: false, action: "execute_failed", error: tradeJson?.message || tradeJson?.error || `HTTP ${tradeRes?.status}` });
      }
    }

    // ═══ PLACE PENDING ORDER ═══
    if (action === "place_pending") {
      // Fetch current price to determine order type
      const quotesRes = await fetch(`${BASE}/symbols`, { headers: authHeaders }).catch(() => null);
      const quotesJson = quotesRes?.ok ? await quotesRes.json().catch(() => ({})) : {};
      const rawSyms = Array.isArray(quotesJson?.symbols) ? quotesJson.symbols : (Array.isArray(quotesJson) ? quotesJson : []);
      const symUpper = (signal.symbol || "").toUpperCase();
      const quote = rawSyms.find(s => (s.symbol || s.name || "").toUpperCase().startsWith(symUpper));
      const bid = quote ? Number(quote.bid) : 0;
      const ask = quote ? Number(quote.ask) : 0;

      let orderType;
      if (signal.direction === "BUY") {
        orderType = signal.entry_price > ask ? "BUY_STOP" : "BUY_LIMIT";
      } else {
        orderType = signal.entry_price < bid ? "SELL_STOP" : "SELL_LIMIT";
      }

      const pendingBody = {
        symbol: baseSym,
        order_type: orderType,
        volume: signal.lot_size,
        price: signal.entry_price,
        sl: signal.stop_loss,
        tp: signal.take_profit,
        magic: signal.magic_number ?? 20260001,
        comment: signal.comment || "Flouba Gold HFT",
        expiration: signal.expiration_time,
      };
      if (suffix) { pendingBody.broker_symbol = signal.symbol; pendingBody.symbol_suffix = suffix; }

      const pendingRes = await fetch(`${BASE}/trade/pending`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(pendingBody),
      }).catch(() => null);

      const pendingJson = pendingRes?.ok ? await pendingRes.json().catch(() => ({})) : {};
      const success = pendingJson?.success === true || pendingRes?.ok;

      if (success) {
        await base44.entities.FloubaSignal.update(signalId, {
          status: "CONFIRMED",
          ticket_id: pendingJson?.ticket || pendingJson?.order || null,
        });
        return Response.json({ ok: true, action: "pending_placed", signal_id: signalId, order_type: orderType, ticket: pendingJson?.ticket || pendingJson?.order });
      } else {
        return Response.json({ ok: false, action: "pending_failed", error: pendingJson?.message || pendingJson?.error || `HTTP ${pendingRes?.status}` });
      }
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});