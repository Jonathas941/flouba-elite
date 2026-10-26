// ── Shared MT5 bridge utilities ─────────────────────────────────────────────
// Used by tradeScannerExecutor, tradingViewWebhook, executeAiTrade and the
// signal functions to talk to the Replit Elite Server.
//
// MULTI-USER ISOLATION — every call must carry the API key of the user who
// OWNS the trade / signal / settings row. There is deliberately NO fallback
// to the shared FLOUBA_ACCOUNT_API_KEY: that key belongs to the app owner's
// MT5 account and is only returned by resolveUserApiKey() for an admin.
// Without a key the call fails (fail closed) instead of hitting someone
// else's account.

export const BRIDGE = (() => {
  let v = (Deno.env.get("FLOUBA_BACKEND_URL") || "").trim().replace(/\/+$/, "");
  if (v && !/^https?:\/\//i.test(v)) v = "https://" + v;
  return v;
})();

export const B44 = `${BRIDGE}/api`;

// userId -> { t, v } — keys change rarely; cache per isolate for 5 minutes.
const KEY_TTL_MS = 5 * 60_000;
const _keyCache = new Map();

/**
 * API key for the user who owns a trade / signal / settings row.
 *   admin -> FLOUBA_ACCOUNT_API_KEY (owner account), else their own key
 *   user  -> their own mt5_api_key only
 *   unknown user / service account / no key -> null (caller must refuse)
 */
export async function resolveUserApiKey(base44, userId) {
  if (!userId || String(userId).startsWith("service_")) return null;
  const hit = _keyCache.get(userId);
  if (hit && Date.now() - hit.t < KEY_TTL_MS) return hit.v;
  let u = null;
  try { u = await base44.asServiceRole.entities.User.get(userId); } catch { u = null; }
  if (!u) {
    try {
      const rows = await base44.asServiceRole.entities.User.filter({ id: userId }, "-created_date", 1);
      u = rows?.items?.[0] || rows?.[0] || null;
    } catch { u = null; }
  }
  let v = null;
  if (u) {
    v = u.role === "admin"
      ? (Deno.env.get("FLOUBA_ACCOUNT_API_KEY") || u.mt5_api_key || null)
      : (u.mt5_api_key || null);
  }
  _keyCache.set(userId, { t: Date.now(), v });
  return v;
}

export function bridgeHeaders(robotId, apiKey) {
  return {
    "X-Api-Key": apiKey || "",
    "x-request-id": crypto.randomUUID(),
    "x-timestamp": new Date().toISOString(),
    "Content-Type": "application/json",
    ...(robotId ? { "x-robot-id": String(robotId) } : {}),
  };
}

const NO_KEY = "No MT5 bridge key for this user — their account is not set up yet (open the dashboard once to provision it).";

// Get the live account balance from the Replit server.
export async function getAccount(robotId, apiKey) {
  if (!BRIDGE) return { ok: false, error: "FLOUBA_BACKEND_URL not set" };
  if (!apiKey) return { ok: false, error: NO_KEY };
  try {
    const res = await fetch(`${B44}/account`, {
      method: "GET",
      headers: bridgeHeaders(robotId, apiKey),
    });
    const raw = await res.text();
    let json; try { json = JSON.parse(raw); } catch { json = { raw }; }
    if (!res.ok) return { ok: false, error: json?.error?.message || json?.message || json?.error || `HTTP ${res.status}` };
    const acct = json?.data?.account ?? json?.account ?? json?.data ?? {};
    return {
      ok: true,
      balance: acct.balance ?? acct.Balance ?? null,
      equity: acct.equity ?? acct.Equity ?? null,
      login: acct.login ?? acct.accountLogin ?? null,
      connected: acct.connected === true || acct.terminalConnected === true,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Build and validate a single-leg entry payload for the Replit Elite Server.
 * EVERY entry path (tradeScannerExecutor, executeAiTrade, tradingViewWebhook,
 * hftExecutionEngine, trailingTpMonitor, multiPairOrchestrator,
 * floubaSignalExecute, mt5Bridge buy/sell/force_start) must route through this.
 *
 * Guarantees: symbol is a non-empty string, lot/sl/tp are finite positive numbers.
 * Never serializes NaN, null, or Infinity — the order is rejected before fetch.
 *
 * Returns { ok: true, action, payload } or { ok: false, errorCode, error }.
 */
export function buildTradePayload(opts) {
  const { direction, symbol, lot, sl, tp, comment } = opts || {};
  const action = String(direction || "").toLowerCase() === "sell" ? "sell" : "buy";

  const sym = typeof symbol === "string" ? symbol.trim() : "";
  if (!sym) return { ok: false, errorCode: "INVALID_SIGNAL_PAYLOAD", error: "Missing symbol; order was not submitted" };

  const nLot = Number(lot);
  const nSl = Number(sl);
  const nTp = Number(tp);

  if (typeof nLot !== "number" || !Number.isFinite(nLot) || nLot <= 0)
    return { ok: false, errorCode: "INVALID_SIGNAL_PAYLOAD", error: "Missing or invalid lot; order was not submitted" };
  if (typeof nSl !== "number" || !Number.isFinite(nSl) || nSl <= 0)
    return { ok: false, errorCode: "INVALID_SIGNAL_PAYLOAD", error: "Missing or invalid sl; order was not submitted" };
  if (typeof nTp !== "number" || !Number.isFinite(nTp) || nTp <= 0)
    return { ok: false, errorCode: "INVALID_SIGNAL_PAYLOAD", error: "Missing or invalid tp; order was not submitted" };

  const payload = { symbol: sym, lot: nLot, sl: nSl, tp: nTp };
  if (comment) payload.comment = String(comment).slice(0, 31);
  return { ok: true, action, payload };
}

/**
 * Log a trade submission — function name, signal ID, request ID, sanitized fields.
 * Never logs API keys.
 */
export function logTradeSubmission(sourceFn, signalId, requestId, built) {
  const p = built?.payload || {};
  console.log(`[trade] ${sourceFn} sig=${signalId || "-"} req=${requestId || "-"} ${built?.action || "?"} ${p.symbol || "?"} lot=${p.lot} sl=${p.sl} tp=${p.tp}`);
}

// Sends trades directly to the Replit Elite Server routes
// (POST /api/trade/buy, /api/trade/sell, /api/trade/close, /api/trade/close-all).
export async function postCommand(robotId, command, idemKey, apiKey, sourceFn, signalId) {
  if (!BRIDGE) return { ok: false, error: "FLOUBA_BACKEND_URL not set" };
  if (!apiKey) return { ok: false, error: NO_KEY };
  try {
    const action = (command?.action || "").toLowerCase();
    const routeMap = {
      buy: "/trade/buy",
      sell: "/trade/sell",
      close: "/trade/close",
      close_all: "/trade/close-all",
      closeall: "/trade/close-all",
    };
    const route = routeMap[action];
    if (!route) return { ok: false, error: `Unknown trade action: ${action}` };

    // Close / close-all: no lot/sl/tp validation needed.
    if (action === "close" || action === "close_all" || action === "closeall") {
      const body = {};
      if (command.symbol) body.symbol = command.symbol;
      if (command.ticket != null) body.ticket = Number(command.ticket);
      const res = await fetch(`${B44}${route}`, {
        method: "POST",
        headers: { ...bridgeHeaders(robotId, apiKey), "x-idempotency-key": idemKey },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let json; try { json = JSON.parse(raw); } catch { json = { raw }; }
      if (!res.ok) return { ok: false, status: res.status, error: json?.error?.message || json?.error || json?.message || `HTTP ${res.status}` };
      return { ok: true, status: res.status, data: json?.data ?? json };
    }

    // Entry orders (buy/sell): validate through the shared payload builder.
    const built = buildTradePayload({
      direction: action,
      symbol: command.symbol,
      lot: command.lot ?? command.volume,
      sl: command.sl,
      tp: command.tp,
      comment: command.comment,
    });
    if (!built.ok) {
      if (sourceFn || signalId) logTradeSubmission(sourceFn || "postCommand", signalId, idemKey, built);
      return { ok: false, status: 422, errorCode: built.errorCode, error: built.error };
    }

    const reqId = idemKey || crypto.randomUUID();
    logTradeSubmission(sourceFn || "postCommand", signalId, reqId, built);

    const res = await fetch(`${B44}${route}`, {
      method: "POST",
      headers: { ...bridgeHeaders(robotId, apiKey), "x-idempotency-key": reqId },
      body: JSON.stringify(built.payload),
    });
    const raw = await res.text();
    let json; try { json = JSON.parse(raw); } catch { json = { raw }; }
    if (!res.ok) return { ok: false, status: res.status, errorCode: json?.error?.code, error: json?.error?.message || json?.error || json?.message || `HTTP ${res.status}` };
    return { ok: true, status: res.status, data: json?.data ?? json };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}