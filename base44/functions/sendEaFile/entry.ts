import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch {}

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const email = body.email || user.email;
    if (!email) return Response.json({ error: "No email address on file" }, { status: 400 });

    const eaUrl = Deno.env.get("EA_FILE_URL");
    if (!eaUrl) return Response.json({ error: "EA_FILE_URL secret not set" }, { status: 500 });

    const fullName = user.full_name || "Trader";
    const firstName = fullName.split(" ")[0];

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#0a0a0a,#111);min-height:100%;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0d0d0d;border:1px solid rgba(220,38,38,0.18);border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6);">

        <!-- LOGO HEADER -->
        <tr><td align="center" style="padding:40px 24px 28px;background:radial-gradient(circle at 50% 0%,rgba(220,38,38,0.15),transparent 60%);">
          <img src="https://media.base44.com/images/public/6a437ad84dc8721fedd64296/58a2a34a3_generated_image.png" width="110" height="110" alt="Flouba Elite" style="display:block;border-radius:18px;margin-bottom:16px;"/>
          <h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:4px;color:#ffffff;text-shadow:0 0 12px rgba(239,68,68,0.5);">FLOUBA <span style="color:#dc2626;">ELITE</span></h1>
          <p style="margin:6px 0 0;font-size:10px;letter-spacing:3px;color:rgba(220,38,38,0.7);text-transform:uppercase;">AI Trading Robot</p>
        </td></tr>

        <!-- BODY -->
        <tr><td style="padding:0 32px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="width:3px;background:#dc2626;border-radius:2px;"></td>
            <td style="padding:0 0 0 16px;">
              <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#ffffff;">Account Connected Successfully</h2>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.7;color:#b0b0b0;">
          <p style="margin:0 0 16px;">Dear ${firstName},</p>
          <p style="margin:0 0 16px;">Your MetaTrader 5 account is now securely linked to <strong style="color:#ffffff;">Flouba Elite</strong>. To activate automated trading, install the Expert Advisor (EA) on your MT5 terminal using the link below.</p>
        </td></tr>

        <!-- DOWNLOAD BUTTON -->
        <tr><td align="center" style="padding:24px 32px;">
          <a href="${eaUrl}" target="_blank" style="display:inline-block;padding:16px 48px;background:#dc2626;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:10px;box-shadow:0 0 20px rgba(220,38,38,0.5);">⬇ Download EA File</a>
        </td></tr>

        <!-- INSTALLATION STEPS -->
        <tr><td style="padding:8px 32px 0;">
          <h3 style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:1px;color:#dc2626;text-transform:uppercase;">Installation Guide</h3>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[
              "Open <strong style='color:#fff;'>MT5</strong> &rarr; File &rarr; Open Data Folder",
              "Navigate to <strong style='color:#fff;'>MQL5 / Experts</strong>",
              "Copy the downloaded EA file into that folder",
              "Restart MT5, then drag the EA onto your chart",
              "Enable <strong style='color:#fff;'>AutoTrading</strong> (green button in toolbar)",
            ].map((step, i) => `<tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
              <table cellpadding="0" cellspacing="0"><tr>
                <td valign="top" style="width:28px;height:28px;background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.3);border-radius:8px;text-align:center;font-size:12px;font-weight:700;color:#dc2626;">${i + 1}</td>
                <td style="padding:4px 0 4px 14px;font-size:14px;line-height:1.5;color:#b0b0b0;">${step}</td>
              </tr></table>
            </td></tr>`).join("")}
          </table>
        </td></tr>

        <!-- INFO BANNER -->
        <tr><td style="padding:0 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.15);border-radius:10px;">
            <tr><td style="padding:16px;font-size:13px;line-height:1.6;color:#9a9a9a;">
              <strong style="color:#dc2626;">&#9888; Important:</strong> The EA automatically connects to the Flouba Elite bridge server. Ensure your MT5 terminal remains running and connected to the internet for uninterrupted automated trading.
            </td></tr>
          </table>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);background:#080808;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;color:#555;text-transform:uppercase;text-align:center;">&mdash; Flouba Elite Team &mdash;</p>
          <p style="margin:0;font-size:10px;color:#444;text-align:center;line-height:1.6;">This email was sent because your MT5 account was connected to Flouba Elite.<br/>If you did not initiate this action, please contact support immediately.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await base44.integrations.Core.SendEmail({
      to: email,
      subject: "Flouba Elite — Your EA File & Installation Guide",
      body: htmlBody,
    });

    return Response.json({ ok: true, sent: true, email });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});