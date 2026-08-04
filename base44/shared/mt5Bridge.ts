// ── Shared MT5 bridge utilities ─────────────────────────────────────────────
// Used by tradeScannerExecutor, tradingViewWebhook, and executeAiTrade to avoid
// duplicating bridge URL construction, header building, and command posting.

export const BRIDGE = (() => {
  let v = (Deno.env.get("FLOUBA_BACKEND_URL") || "").trim().replace(/\/+$/, "");
  if (v && !/^https?:\/\//i.test(v)) v = "https://" + v;
  return v;
})();

export const B44 = `${BRIDGE}/api/base44`;

export function bridgeHeaders(robotId) {
  return {
    "x-api-key": Deno.env.get("FLOUBA_BASE44_API_KEY") || "",
    "x-request-id": crypto.randomUUID(),
    "x-timestamp": new Date().toISOString(),
    "Content-Type": "application/json",
    ...(robotId ? { "x-robot-id": String(robotId) } : {}),
  };
}

export async function postCommand(robotId, command, idemKey) {
  if (!BRIDGE) return { ok: false, error: "FLOUBA_BACKEND_URL not set" };
  try {
    const res = await fetch(`${B44}/robots/${encodeURIComponent(String(robotId))}/commands`, {
      method: "POST",
      headers: { ...bridgeHeaders(robotId), "x-idempotency-key": idemKey },
      body: JSON.stringify(command),
    });
    const raw = await res.text();
    let json; try { json = JSON.parse(raw); } catch { json = { raw }; }
    if (!res.ok) return { ok: false, status: res.status, error: json?.error?.message || json?.error || json?.message || `HTTP ${res.status}` };
    return { ok: true, status: res.status, data: json?.data ?? json };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}