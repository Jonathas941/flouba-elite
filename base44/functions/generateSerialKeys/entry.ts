import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Admin-only: generate serial keys for paid clients.
// Optionally emails the keys to the client.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O/1/I)

function genCode() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const blocks = [];
  for (let b = 0; b < 4; b++) {
    let s = "";
    for (let i = 0; i < 4; i++) {
      s += ALPHABET[bytes[b * 4 + i] % ALPHABET.length];
    }
    blocks.push(s);
  }
  return "FE-" + blocks.join("-");
}

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch {}

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const plan = ["Starter", "Pro", "Elite"].includes(body.plan) ? body.plan : "Starter";
    const count = Math.min(Math.max(parseInt(body.count) || 1, 1), 50);
    const durationDays = parseInt(body.duration_days) || 30;
    const email = body.email || null;
    const note = body.note || null;

    const keys = [];
    for (let i = 0; i < count; i++) {
      keys.push({
        code: genCode(),
        plan,
        status: "Available",
        duration_days: durationDays,
        note,
      });
    }

    const created = await base44.asServiceRole.entities.SerialKey.bulkCreate(keys);
    const codes = created.map((k) => k.code);

    // Optionally email the keys to the client
    if (email) {
      const lines = codes.map((c) =>
        `<p style="font-family:monospace;font-size:16px;color:#ffffff;background:#080808;padding:10px 14px;border-radius:8px;margin:6px 0;letter-spacing:2px;text-align:center;">${c}</p>`
      ).join("");
      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;min-height:100%;">
<tr><td align="center" style="padding:32px 16px;">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d0d0d;border:1px solid rgba(220,38,38,0.18);border-radius:16px;overflow:hidden;">
<tr><td align="center" style="padding:32px 24px 20px;background:radial-gradient(circle at 50% 0%,rgba(220,38,38,0.15),transparent 60%);">
<h1 style="margin:0;font-size:24px;font-weight:900;letter-spacing:3px;color:#ffffff;text-shadow:0 0 12px rgba(239,68,68,0.5);">FLOUBA <span style="color:#dc2626;">ELITE</span></h1>
</td></tr>
<tr><td style="padding:0 32px 12px;">
<h2 style="margin:0 0 8px;font-size:18px;color:#ffffff;">Your Serial Key${codes.length > 1 ? "s" : ""}</h2>
<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#b0b0b0;">Thank you for your payment. Use the serial key below to activate your <strong style="color:#dc2626;">${plan}</strong> plan (${durationDays} days) in the Flouba Elite app under <strong style="color:#fff;">Subscription &rarr; Redeem Key</strong>.</p>
${lines}
</td></tr>
<tr><td style="padding:0 32px 28px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.15);border-radius:10px;">
<tr><td style="padding:14px;font-size:12px;line-height:1.6;color:#9a9a9a;"><strong style="color:#dc2626;">&#9888;</strong> Keep this key private. Each key can only be redeemed once. After redemption your EA file and bridge credentials will be emailed to you automatically.</td></tr>
</table>
</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid rgba(255,255,255,0.06);background:#080808;">
<p style="margin:0;font-size:10px;color:#444;text-align:center;">&mdash; Flouba Elite Team &mdash;</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `Flouba Elite — Your ${plan} Serial Key`,
        body: html,
      }).catch((e) => console.log("serial email failed:", e?.message));
    }

    return Response.json({ success: true, plan, duration_days: durationDays, count, keys: codes });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});