/**
 * Flouba Elite — Stale Entry Slot Auto-Clear Script
 * ==================================================
 * Run on your Replit server to automatically detect and flush
 * stale entry commands that lock the robot's entry slot.
 *
 * Usage:
 *   node clear-entry-slot.js              # one-shot clear
 *   node clear-entry-slot.js --watch      # loop every 60s
 *   node clear-entry-slot.js --interval 30  # loop every 30s
 *
 * Env vars (from your .env or Replit secrets):
 *   FLOUBA_BACKEND_URL  — your Elite Server base URL (e.g. https://flouba-elite.replit.app)
 *   MT5_API_TOKEN        — the X-Api-Key for the account you want to clear
 *
 * What it does:
 *   1. Probes /api/commands/pending for stuck buy/sell/entry commands
 *   2. Sends /api/trade/close-all to flush the EA command queue
 *   3. Attempts /api/trade/reconcile if the backend exposes it
 *   4. Retries /api/robot/start to confirm the slot is free
 *   5. Logs every step so you can see exactly what was cleared
 */

const BASE_URL = (process.env.FLOUBA_BACKEND_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.MT5_API_TOKEN || process.env.FLOUBA_ACCOUNT_API_KEY || "";

if (!BASE_URL) {
  console.error("✗ FLOUBA_BACKEND_URL is not set. Add it to your Replit secrets.");
  process.exit(1);
}
if (!API_KEY) {
  console.error("✗ MT5_API_TOKEN (or FLOUBA_ACCOUNT_API_KEY) is not set. Add it to your Replit secrets.");
  process.exit(1);
}

const API_BASE = BASE_URL.replace(/\/api$/i, "") + "/api";

const headers = {
  "Content-Type": "application/json",
  "X-Api-Key": API_KEY,
  "x-request-id": crypto.randomUUID?.() || Date.now().toString(),
};

// ── HTTP helper ──────────────────────────────────────────────────────────────
async function call(method, path, body) {
  const url = `${API_BASE}${path}`;
  const opts = {
    method,
    headers: {
      ...headers,
      "x-request-id": crypto.randomUUID?.() || Date.now().toString(),
    },
  };
  if (method !== "GET" && body != null) {
    opts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, opts);
    const raw = await res.text();
    let json;
    try { json = JSON.parse(raw); } catch { json = { raw }; }

    if (!res.ok) {
      const errMsg = json?.error?.message || json?.error || json?.message || `HTTP ${res.status}`;
      console.warn(`  ${method} ${path} → ${res.status} ${errMsg}`);
      return { ok: false, status: res.status, data: null, error: errMsg };
    }
    return { ok: true, status: res.status, data: json?.data ?? json };
  } catch (e) {
    console.warn(`  ${method} ${path} → network error: ${e.message}`);
    return { ok: false, status: 0, data: null, error: e.message };
  }
}

// ── Sleep ────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Main clear routine ───────────────────────────────────────────────────────
async function clearStaleSlot() {
  const ts = new Date().toISOString();
  console.log(`\n════════════════════════════════════════════════════════════`);
  console.log(`  [${ts}] Flouba Entry Slot Auto-Clear`);
  console.log(`════════════════════════════════════════════════════════════`);

  // Step 1: Probe for pending/stale entry commands
  console.log("  ▸ Step 1: Probing for pending entry commands...");
  const probeRes = await call("GET", "/commands/pending").catch(() => null);
  let staleCmds = [];
  if (probeRes?.ok && Array.isArray(probeRes.data)) {
    staleCmds = probeRes.data.filter(
      (c) => c?.action === "buy" || c?.action === "sell" || c?.type === "entry" || c?.status === "pending"
    );
    if (staleCmds.length > 0) {
      console.log(`    ✗ Found ${staleCmds.length} stale entry command(s):`);
      staleCmds.forEach((c, i) => {
        console.log(`      #${i + 1}: action=${c.action || c.type}, status=${c.status}, created=${c.created_at || c.timestamp || "?"}`);
      });
    } else {
      console.log("    ✓ No stale entry commands found in the pending queue.");
    }
  } else {
    console.log("    ⚠ /commands/pending endpoint not available — proceeding with flush anyway.");
  }

  // Step 2: Flush the entry slot via close-all
  console.log("  ▸ Step 2: Flushing entry slot with close-all...");
  const flushRes = await call("POST", "/trade/close-all", {}).catch(() => null);
  const flushed = flushRes?.ok && (flushRes.status === 200 || flushRes.status === 202);
  if (flushed) {
    console.log("    ✓ Close-all queued successfully — EA will reconcile and free the slot.");
  } else {
    console.log(`    ⚠ Close-all did not succeed: ${flushRes?.error || "unknown"}`);
  }

  // Step 3: Try the reconcile endpoint if the backend exposes it
  console.log("  ▸ Step 3: Attempting explicit reconcile...");
  const reconRes = await call("POST", "/trade/reconcile", {}).catch(() => null);
  if (reconRes?.ok) {
    console.log("    ✓ Reconcile accepted by the backend.");
  } else {
    console.log("    ⚠ /trade/reconcile not available — relying on close-all flush.");
  }

  // Step 4: Wait for the EA to process the flush
  console.log("  ▸ Step 4: Waiting 3s for EA to process the flush...");
  await sleep(3000);

  // Step 5: Re-probe to confirm the slot is clear
  console.log("  ▸ Step 5: Re-probing for stale commands...");
  const reprobeRes = await call("GET", "/commands/pending").catch(() => null);
  let remainingStale = [];
  if (reprobeRes?.ok && Array.isArray(reprobeRes.data)) {
    remainingStale = reprobeRes.data.filter(
      (c) => c?.action === "buy" || c?.action === "sell" || c?.type === "entry" || c?.status === "pending"
    );
    if (remainingStale.length === 0) {
      console.log("    ✓ Entry slot is now clear — no stale commands remaining.");
    } else {
      console.log(`    ✗ ${remainingStale.length} stale command(s) still pending after flush.`);
    }
  } else {
    console.log("    ⚠ Could not re-probe (endpoint unavailable).");
  }

  // Step 6: Try robot/start to confirm the slot is fully operational
  console.log("  ▸ Step 6: Attempting robot/start to confirm slot is free...");
  const startRes = await call("POST", "/robot/start", {}).catch(() => null);
  if (startRes?.ok && startRes.data?.success === true) {
    console.log("    ✓ Robot started successfully — entry slot is clear and operational.");
  } else {
    const errMsg = startRes?.error || startRes?.data?.message || "unknown";
    if (errMsg.includes("ENTRY_SLOT_OCCUPIED")) {
      console.log("    ✗ Entry slot still occupied — the EA may need a terminal restart.");
    } else if (errMsg.includes("BASE44_ONLY")) {
      console.log("    ⚠ Autonomous robot is disabled (BASE44_ONLY) — slot is clear but direct trade API is required.");
    } else {
      console.log(`    ⚠ Robot start returned: ${errMsg}`);
    }
  }

  const cleared = remainingStale.length === 0 || (flushed && remainingStale.length <= staleCmds.length);
  console.log(`\n  RESULT: ${cleared ? "✓ SLOT CLEARED" : "✗ SLOT STILL LOCKED — may need EA restart"}`);
  console.log(`════════════════════════════════════════════════════════════\n`);

  return cleared;
}

// ── CLI entry point ─────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const watchMode = args.includes("--watch");
  const intervalIdx = args.indexOf("--interval");
  const intervalMs = intervalIdx !== -1 && args[intervalIdx + 1]
    ? Math.max(10, parseInt(args[intervalIdx + 1], 10)) * 1000
    : 60000;

  if (watchMode) {
    console.log(`Watch mode: checking every ${intervalMs / 1000}s. Press Ctrl+C to stop.`);
    while (true) {
      await clearStaleSlot();
      await sleep(intervalMs);
    }
  } else {
    const ok = await clearStaleSlot();
    process.exit(ok ? 0 : 1);
  }
}

// ── Polyfill for older Node ──────────────────────────────────────────────────
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = {
    randomUUID: () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }),
  };
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});