import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// User redeems a serial key: validates it, marks it used, activates the
// subscription, then triggers EA + API key delivery (sendEaFile).

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch {}

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const code = (body.code || "").trim().toUpperCase();
    if (!code) return Response.json({ error: "Enter your serial key." }, { status: 400 });

    const found = await base44.asServiceRole.entities.SerialKey.filter({ code }, "-created_date", 1).catch(() => []);
    const key = found?.[0];
    if (!key) return Response.json({ error: "Invalid serial key." }, { status: 400 });
    if (key.status !== "Available") {
      return Response.json({ error: "This serial key has already been used or is no longer valid." }, { status: 400 });
    }

    // Mark the key as used by this user
    await base44.asServiceRole.entities.SerialKey.update(key.id, {
      status: "Used",
      redeemed_by_id: user.id,
      redeemed_at: new Date().toISOString(),
    });

    // Activate / extend the user's subscription
    const durationDays = key.duration_days || 30;
    const expires = new Date();
    expires.setDate(expires.getDate() + durationDays);
    const expiresDate = expires.toISOString().slice(0, 10);

    const existing = await base44.entities.Subscription.filter({ created_by_id: user.id }, "-created_date", 1).catch(() => []);
    let sub;
    if (existing[0]) {
      sub = await base44.entities.Subscription.update(existing[0].id, {
        plan: key.plan,
        status: "Active",
        expires_date: expiresDate,
      });
    } else {
      sub = await base44.entities.Subscription.create({
        plan: key.plan,
        status: "Active",
        expires_date: expiresDate,
      });
    }

    // Deliver the EA file + bridge API key (sendEaFile now sees an active subscription)
    base44.functions.invoke("sendEaFile", {}).catch(() => {});

    return Response.json({
      success: true,
      plan: key.plan,
      expires_date: expiresDate,
      subscription: sub,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});