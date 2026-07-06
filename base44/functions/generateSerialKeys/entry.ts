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

    // Optionally email the keys to the client (premium branded template)
    if (email) {
      const keyCards = codes.map((c) =>
        `<div style="font-family:monospace;font-size:18px;font-weight:700;color:#ffffff;background:#080808;padding:14px 18px;border-radius:10px;margin:8px 0;letter-spacing:3px;text-align:center;border:1px solid rgba(220,38,38,0.25);">${c}</div>`
      ).join("");

      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#0a0a0a,#111);min-height:100%;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0d0d0d;border:1px solid rgba(220,38,38,0.18);border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6);">
        <tr><td align="center" style="padding:40px 24px 28px;background:radial-gradient(circle at 50% 0%,rgba(220,38,38,0.15),transparent 60%);">
          <img src="https://media.base44.com/images/public/6a437ad84dc8721fedd64296/58a2a34a3_generated_image.png" width="110" height="110" alt="Flouba Elite" style="display:block;border-radius:18px;margin-bottom:16px;"/>
          <h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:4px;color:#ffffff;text-shadow:0 0 12px rgba(239,68,68,0.5);">FLOUBA <span style="color:#dc2626;">ELITE</span></h1>
          <p style="margin:6px 0 0;font-size:10px;letter-spacing:3px;color:rgba(220,38,38,0.7);text-transform:uppercase;">AI Trading Robot</p>
        </td></tr>
        <tr><td style="padding:0 32px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="width:3px;background:#dc2626;border-radius:2px;"></td>
            <td style="padding:0 0 0 16px;">
              <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#ffffff;">Your Serial Key${codes.length > 1 ? "s" : ""}</h2>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.7;color:#b0b0b0;">
          <p style="margin:0 0 16px;">Thank you for your payment. Redeem the key${codes.length > 1 ? "s" : ""} below in the Flouba Elite app under <strong style="color:#fff;">Subscription &rarr; Redeem Key</strong> to activate your <strong style="color:#dc2626;">${plan}</strong> plan (${durationDays} days).</p>
        </td></tr>
        <tr><td style="padding:0 32px 8px;">
          ${keyCards}
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.15);border-radius:10px;">
            <tr><td style="padding:16px;font-size:13px;line-height:1.6;color:#9a9a9a;"><strong style="color:#dc2626;">&#9888; Important:</strong> Keep this key private &mdash; each key can only be redeemed once. After redemption your EA file and bridge credentials will be emailed to you automatically.</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);background:#080808;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;color:#555;text-transform:uppercase;text-align:center;">&mdash; Flouba Elite Team &mdash;</p>
          <p style="margin:0;font-size:10px;color:#444;text-align:center;line-height:1.6;">This email contains your purchased serial key. Do not share it.<br/>If you did not expect this email, please contact support immediately.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

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