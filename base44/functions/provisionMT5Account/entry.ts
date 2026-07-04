import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MT5 server provision endpoint — creates a fresh account + API key for a user
const PROVISION_URL = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/api/provision/user";

Deno.serve(async (req) => {
  try {
    // Read body FIRST — the SDK may consume the body stream during auth
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    // Auth: shared cron secret (scheduler) OR admin user (manual) OR platform scheduler
    // Blocks public callers and regular users — this function uses service-role.
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

    // If a specific user_id is provided, provision just that user.
    // Otherwise (scheduled poll), find ALL users without an mt5_api_key and provision each.
    const targetUserId = body.entity_id || body.base44_user_id || body.data?.id;

    let usersToProvision = [];

    if (targetUserId) {
      // Single-user provision (manual admin call or direct trigger)
      const targetEmail = body.email || body.data?.email;
      const targetName = body.name || body.data?.full_name || targetEmail;
      if (!targetEmail) {
        return Response.json({ error: "Missing email for specified user" }, { status: 400 });
      }
      usersToProvision = [{ id: targetUserId, email: targetEmail, full_name: targetName }];
    } else {
      // Batch poll: find all users missing an mt5_api_key
      const allUsers = await base44.asServiceRole.entities.User.list();
      usersToProvision = allUsers.filter((u) => !u.mt5_api_key && u.email);
      if (!usersToProvision.length) {
        return Response.json({ success: true, message: "No unprovisioned users", provisioned: 0 });
      }
    }

    const results = [];

    for (const user of usersToProvision) {
      try {
        // Paywall: skip users without an active paid subscription
        const userSubs = await base44.asServiceRole.entities.Subscription.filter({ created_by_id: user.id }, "-created_date", 1).catch(() => []);
        const usub = userSubs?.[0];
        const subActive = usub && usub.status === "Active" && (!usub.expires_date || new Date(usub.expires_date) >= new Date(new Date().toDateString()));
        if (!subActive) {
          results.push({ user_id: user.id, email: user.email, success: false, error: "No active subscription — skipped", needs_subscription: true });
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

    if (!provisionJson?.success || !provisionJson?.api_key) {
      results.push({
        user_id: user.id,
        email: user.email,
        success: false,
        error: provisionJson?.message || provisionJson?.error || `HTTP ${provisionRes.status}`,
      });
      continue;
    }

    // Write the API key (and slug) back to the User entity
    const updateData = { mt5_api_key: provisionJson.api_key };
    if (provisionJson.slug) updateData.mt5_slug = provisionJson.slug;

    await base44.asServiceRole.entities.User.update(user.id, updateData);

    results.push({
      user_id: user.id,
      email: user.email,
      success: true,
      slug: provisionJson.slug ?? null,
      email_sent: provisionJson.email_sent ?? false,
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