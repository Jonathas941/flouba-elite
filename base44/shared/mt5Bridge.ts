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

// Sends trades directly to the Replit Elite Server routes
// (POST /api/trade/buy, /api/trade/sell, /api/trade/close, /api/trade/close-all).
export async function postCommand(robotId, command, idemKey, apiKey) {
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

    const body = {};
    if (command.symbol) body.symbol = command.symbol;
    if (command.volume != null) body.lot = Number(command.volume);
    if (command.lot != null) body.lot = Number(command.lot);
    if (command.sl != null) body.sl = Number(command.sl);
    if (command.tp != null) body.tp = Number(command.tp);
    if (command.ticket != null) body.ticket = Number(command.ticket);
    if (command.comment) body.comment = String(command.comment).slice(0, 31);

    const res = await fetch(`${B44}${route}`, {
      method: "POST",
      headers: { ...bridgeHeaders(robotId, apiKey), "x-idempotency-key": idemKey },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let json; try { json = JSON.parse(raw); } catch { json = { raw }; }
    if (!res.ok) return { ok: false, status: res.status, error: json?.error?.message || json?.error || json?.message || `HTTP ${res.status}` };
    return { ok: true, status: res.status, data: json?.data ?? json };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
