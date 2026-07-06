import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api";

function formatDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt) ? null : dt.toISOString();
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const cronSecret = Deno.env.get("CRON_SECRET");
    const secretMatch = cronSecret && (
      req.headers.get("X-Cron-Secret") === cronSecret ||
      body.cron_secret === cronSecret
    );

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    let targetConfigs = [];
    let useServiceRole = false;
    let currentUser = null;

    if (secretMatch) {
      // Cron-secret — sync all users
      const allSettings = await base44.asServiceRole.entities.BotSettings.list();
      targetConfigs = allSettings.filter(s => s.mt5_account && s.mt5_password && s.mt5_server);
      useServiceRole = true;
    } else {
      const isAuth = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuth) return Response.json({ error: "Unauthorized" }, { status: 403 });
      const user = await base44.auth.me().catch(() => null);
      if (user) {
        currentUser = user;
        // Regular user — sync only their trades
        const settings = await base44.entities.BotSettings.filter({ created_by_id: user.id });
        if (settings?.[0]?.mt5_account) {
          targetConfigs = [{ ...settings[0], _userId: user.id }];
        }
      } else {
        // Internal scheduler (isAuth=true, me()=null) — sync all users
        const allSettings = await base44.asServiceRole.entities.BotSettings.list();
        targetConfigs = allSettings.filter(s => s.mt5_account && s.mt5_password && s.mt5_server);
        useServiceRole = true;
      }
    }

    const provisionSecret = Deno.env.get("PROVISION_SECRET");
    if (!provisionSecret) return Response.json({ error: "PROVISION_SECRET not set" }, { status: 500 });
    if (!targetConfigs.length) return Response.json({ success: true, synced: 0, users: 0 });

    // Fetch all users to map created_by_id → mt5_api_key for JWT exchange
    const allUsers = await base44.asServiceRole.entities.User.list().catch(() => []);
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    // Use the stored flouba_token (provisioned on signup) directly; fall back to api_key exchange.
    async function getJwt(userId, email, name) {
      const u = userMap.get(userId);
      if (u?.flouba_token) return u.flouba_token;
      let apiKey = u?.mt5_api_key;
      if (!apiKey) {
        const provisionRes = await fetch(`${BASE}/provision/user`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${provisionSecret}`, "Content-Type": "application/json" },
          body: JSON.stringify({ base44_user_id: userId, email, name: name || email }),
        });
        const provisionJson = await provisionRes.json().catch(() => ({}));
        if (!provisionJson?.success || !provisionJson?.api_key) return null;
        apiKey = provisionJson.api_key;
        const updateData = { mt5_api_key: apiKey };
        if (provisionJson.slug) { updateData.mt5_slug = provisionJson.slug; updateData.flouba_slug = provisionJson.slug; }
        if (provisionJson.user_token) updateData.flouba_token = provisionJson.user_token;
        if (provisionJson.ea_download_url) updateData.ea_download_url = provisionJson.ea_download_url;
        await base44.asServiceRole.entities.User.update(userId, updateData);
        userMap.set(userId, { ...u, ...updateData });
        if (provisionJson.user_token) return provisionJson.user_token;
      }
      const tokenRes = await fetch(`${BASE}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      const tokenJson = await tokenRes.json().catch(() => ({}));
      return tokenJson?.token || null;
    }

    let totalSynced = 0;
    let totalProcessed = 0;

    for (const config of targetConfigs) {
      const userId = useServiceRole ? config.created_by_id : config._userId;
      if (!userId) continue;

      const userData = useServiceRole ? userMap.get(userId) : currentUser;
      const jwt = await getJwt(userId, userData?.email, userData?.full_name);
      if (!jwt) continue;
      const authHeaders = {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "X-MT5-Login": String(config.mt5_account),
        "X-MT5-Password": config.mt5_password,
        "X-MT5-Server": config.mt5_server,
      };

      // Fetch closed trade history from MT5
      let mt5Trades = [];
      try {
        const histRes = await fetch(`${BASE}/history?limit=200`, { headers: authHeaders });
        if (histRes.ok) {
          const histJson = await histRes.json();
          mt5Trades = Array.isArray(histJson) ? histJson
            : (histJson?.trades || histJson?.history || histJson?.data?.trades || []);
        }
      } catch { continue; }

      if (!mt5Trades.length) continue;
      totalProcessed += mt5Trades.length;

      // Fetch existing trades for this user to deduplicate by ticket_id
      const existingTrades = await base44.asServiceRole.entities.Trade.filter(
        { created_by_id: userId }, "-created_date", 500
      );
      const existingTickets = new Set(
        existingTrades.map(t => t.ticket_id).filter(Boolean)
      );

      const newTrades = [];
      for (const t of mt5Trades) {
        const ticket = String(t.ticket ?? t.id ?? "");
        if (!ticket || existingTickets.has(ticket)) continue;

        const isBuy = t.type === 0 || t.type === "buy" || t.direction === "Buy";
        const trade = {
          pair: t.symbol || t.pair || "UNKNOWN",
          direction: isBuy ? "Buy" : "Sell",
          lot: t.volume ?? t.lot ?? null,
          profit: t.profit ?? t.realized_pnl ?? 0,
          status: "Closed",
          entry_price: t.openPrice ?? t.open_price ?? t.entry_price ?? null,
          current_price: t.closePrice ?? t.close_price ?? t.current_price ?? null,
          stop_loss: t.sl ?? t.stop_loss ?? null,
          take_profit: t.tp ?? t.take_profit ?? null,
          opened_at: formatDate(t.openTime ?? t.open_time ?? t.opened_at),
          closed_at: formatDate(t.closeTime ?? t.close_time ?? t.closed_at),
          close_reason: (() => {
            const VALID = ["Take Profit", "Stop Loss", "Daily Target", "Daily Loss Limit", "Panic", "Manual", "Opposite Signal"];
            const c = (t.comment || "").toString();
            const cl = c.toLowerCase();
            if (VALID.includes(t.comment)) return t.comment;
            if (/sl|stop ?loss/i.test(cl)) return "Stop Loss";
            if (/tp|take ?profit/i.test(cl)) return "Take Profit";
            if (/daily|target/i.test(cl)) return "Daily Target";
            if (/loss ?limit/i.test(cl)) return "Daily Loss Limit";
            if (/panic/i.test(cl)) return "Panic";
            if (/manual|close/i.test(cl)) return "Manual";
            if (/opposite|reverse/i.test(cl)) return "Opposite Signal";
            return (t.profit ?? 0) >= 0 ? "Take Profit" : "Stop Loss";
          })(),
          ticket_id: ticket,
        };
        if (useServiceRole) trade.created_by_id = userId;
        newTrades.push(trade);
      }

      if (newTrades.length) {
        try {
          if (useServiceRole) {
            await base44.asServiceRole.entities.Trade.bulkCreate(newTrades);
          } else {
            await base44.entities.Trade.bulkCreate(newTrades);
          }
          totalSynced += newTrades.length;
        } catch {}
      }
    }

    return Response.json({
      success: true,
      synced: totalSynced,
      processed: totalProcessed,
      users: targetConfigs.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});