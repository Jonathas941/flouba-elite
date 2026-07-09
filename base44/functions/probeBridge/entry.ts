import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let bridgeToken = user.flouba_token;
    if (!bridgeToken) {
      return Response.json({ error: "No flouba_token — connect MT5 first" }, { status: 400 });
    }

    const headers = {
      "Authorization": `Bearer ${bridgeToken}`,
      "Content-Type": "application/json",
    };

    // The EA uses X-Api-Key auth for /bridge/* endpoints
    const eaHeaders = {
      "X-Api-Key": user.mt5_api_key || bridgeToken,
      "Content-Type": "application/json",
    };

    const probes = [
      { method: "POST", path: "/bridge/commands", headers: eaHeaders, body: { action: "BUY", symbol: "XAUUSDm", lot: 0.01, sl: null, tp: null } },
      { method: "POST", path: "/bridge/command", headers: eaHeaders, body: { action: "BUY", symbol: "XAUUSDm", lot: 0.01 } },
      { method: "POST", path: "/bridge/queue", headers: eaHeaders, body: { action: "BUY", symbol: "XAUUSDm", lot: 0.01 } },
      { method: "POST", path: "/bridge/dispatch", headers: eaHeaders, body: { action: "BUY", symbol: "XAUUSDm", lot: 0.01 } },
      { method: "GET",  path: "/bridge/commands", headers: eaHeaders },
    ];

    const results = [];
    for (const p of probes) {
      try {
        const opts = { method: p.method, headers: p.headers || headers };
        if (p.body) opts.body = JSON.stringify(p.body);
        const res = await fetch(`${BASE}${p.path}`, opts);
        const text = await res.text();
        results.push({ method: p.method, path: p.path, status: res.status, body: text.substring(0, 300) });
      } catch (e) {
        results.push({ method: p.method, path: p.path, error: e.message });
      }
    }

    return Response.json({ results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});