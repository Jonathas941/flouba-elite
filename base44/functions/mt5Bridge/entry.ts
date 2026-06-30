import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const token = Deno.env.get("MT5_API_TOKEN");
    if (!token) return Response.json({ error: "MT5_API_TOKEN not set" }, { status: 500 });

    const authHeaders = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const body = await req.json().catch(() => ({}));
    const { action, ...params } = body;

    // Map of action → [method, path]
    // Paths discovered from live API probing — extend as backend adds endpoints
    const ROUTES = {
      status:       ["GET",  "/status"],
      account:      ["GET",  "/account"],
      positions:    ["GET",  "/positions"],
      robot_status: ["GET",  "/robot/status"],
      robot_start:  ["POST", "/robot/start"],
      robot_stop:   ["POST", "/robot/stop"],
      buy:          ["POST", "/trade/buy"],
      sell:         ["POST", "/trade/sell"],
      close:        ["POST", "/trade/close"],
      close_all:    ["POST", "/trade/close_all"],
    };

    const route = ROUTES[action];
    if (!route) return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

    const [method, path] = route;
    const url = `${BASE}${path}`;

    const fetchOpts = {
      method,
      headers: authHeaders,
      ...(method === "POST" ? { body: JSON.stringify(params) } : {}),
    };

    const res = await fetch(url, fetchOpts);
    const data = await res.json();

    return Response.json({ ok: res.ok, status: res.status, data }, { status: 200 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});