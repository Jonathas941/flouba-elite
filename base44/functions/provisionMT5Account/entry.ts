import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MT5 server provision endpoint — creates a fresh account + API key + JWT for a user
const PROVISION_URL = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api/provision/user";

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    // Auth: cron secret (scheduler) OR admin user OR entity-automation context
    const cronSecret = Deno.env.get("CRON_SECRET");
    const secretMatch = cronSecret && (
      req.headers.get("X-Cron-Secret") === cronSecret ||
      body.cron_secret === cronSecret
    );

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    if (!secretMatch) {
      const isAuth = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuth) {
        return Response.json({ error: "Unauthorized — authentication required" }, { status: 403 });
      }
      const user = await base44.auth.me().catch(() => null);
      if (user && user.role !== "admin") {
        return Response.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const provisionSecret = Deno.env.get("PROVISION_SECRET");
    if (!provisionSecret) {
      return Response.json({ error: "PROVISION_SECRET not set" }, { status: 500 });
    }

    // Resolve target user(s) from: entity-automation payload, manual call, or batch poll
    const autoUserId = body.event?.entity_id || body.data?.id;
    const autoEmail = body.data?.email;
    const autoName = body.data?.full_name || autoEmail;
    const manualUserId = body.base44_user_id;
    const manualEmail = body.email;
    const manualName = body.name || manualEmail;

    let usersToProvision = [];

    if (autoUserId && autoEmail) {
      // Entity automation: User create event (fires on signup)
      usersToProvision = [{ id: autoUserId, email: autoEmail, full_name: autoName }];
    } else if (manualUserId && manualEmail) {
      // Manual admin call
      usersToProvision = [{ id: manualUserId, email: manualEmail, full_name: manualName }];
    } else {
      // Batch poll: find all users missing a flouba_token
      const allUsers = await base44.asServiceRole.entities.User.list();
      usersToProvision = allUsers.filter((u) => !u.flouba_token && u.email);
      if (!usersToProvision.length) {
        return Response.json({ success: true, message: "No unprovisioned users", provisioned: 0 });
      }
    }

    const results = [];

    for (const user of usersToProvision) {
      try {
        // Skip if already provisioned (avoid duplicates on automation retries)
        const existing = await base44.asServiceRole.entities.User.get(user.id).catch(() => null);
        if (existing?.flouba_token) {
          results.push({ user_id: user.id, email: user.email, success: true, already_provisioned: true });
          continue;
        }

        const provisionRes = await fetch(PROVISION_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${provisionSecret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            base44_user_id: user.id,
            email: user.email,
            name: user.full_name || user.email,
          }),
        });

        const provisionJson = await provisionRes.json().catch(() => ({}));

        if (!provisionJson?.success) {
          results.push({
            user_id: user.id,
            email: user.email,
            success: false,
            error: provisionJson?.message || provisionJson?.error || `HTTP ${provisionRes.status}`,
          });
          continue;
        }

        // Save all provisioned fields to the User record
        const updateData = {};
        if (provisionJson.api_key) updateData.mt5_api_key = provisionJson.api_key;
        if (provisionJson.slug) { updateData.mt5_slug = provisionJson.slug; updateData.flouba_slug = provisionJson.slug; }
        if (provisionJson.user_token) updateData.flouba_token = provisionJson.user_token;
        if (provisionJson.ea_download_url) updateData.ea_download_url = provisionJson.ea_download_url;

        if (Object.keys(updateData).length) {
          await base44.asServiceRole.entities.User.update(user.id, updateData);
        }

        results.push({
          user_id: user.id,
          email: user.email,
          success: true,
          slug: provisionJson.slug ?? null,
          ea_download_url: provisionJson.ea_download_url ?? null,
          created: provisionJson.created ?? false,
        });
      } catch (err) {
        results.push({ user_id: user.id, email: user.email, success: false, error: err.message });
      }
    }

    const succeeded = results.filter((r) => r.success).length;

    return Response.json({
      success: true,
      provisioned: succeeded,
      total: results.length,
      results,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});