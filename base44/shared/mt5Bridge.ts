// ── Shared MT5 bridge utilities ─────────────────────────────────────────────
// Used by tradeScannerExecutor, tradingViewWebhook, and executeAiTrade to avoid
// duplicating bridge URL construction, header building, and command posting.

export const BRIDGE = (() => {
  let v = (Deno.env.get("FLOUBA_BACKEND_URL") || "").trim().replace(/\/+$/, "");
  if (v && !/^https?:\/\//i.test(v)) v = "https://" + v;
  return v;
})();

export const B44 = `${BRIDGE}/api`;

export function bridgeHeaders(robotId) {
  return {
    "X-Api-Key": Deno.env.get("FLOUBA_ACCOUNT_API_KEY") || "",
    "x-request-id": crypto.randomUUID(),
    "x-timestamp": new Date().toISOString(),
    "Content-Type": "application/json",
    ...(robotId ? { "x-robot-id": String(robotId) } : {}),
  };
}

// Get the live account balance from the Replit server.
export async function getAccount(robotId) {
  if (!BRIDGE) return { ok: false, error: "FLOUBA_BACKEND_URL not set" };
  try {
    const res = await fetch(`${B44}/account`, {
      method: "GET",
      headers: bridgeHeaders(robotId),
    });
    const raw = await res.text();
    let json; try { json = JSON.parse(raw); } catch { json = { raw }; }
    if (!res.ok) return { ok: false, error: json?.error?.message || json?.error || `HTTP ${res.status}` };
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

// postCommand now sends trades directly to the Replit Elite Server routes
// (POST /api/trade/buy, /api/trade/sell, /api/trade/close, /api/trade/close-all)
// instead of the old command-queue path (/api/base44/robots/:id/commands).
export async function postCommand(robotId, command, idemKey) {
  if (!BRIDGE) return { ok: false, error: "FLOUBA_BACKEND_URL not set" };
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
      headers: { ...bridgeHeaders(robotId), "x-idempotency-key": idemKey },
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