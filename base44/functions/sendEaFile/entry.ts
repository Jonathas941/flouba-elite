import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Flouba Lite bridge (command-queue architecture) ──────────────────────────
// The EA authenticates to the bridge with a SINGLE shared secret
// (MT5_ROBOT_API_KEY, sent as x-robot-api-key), not per-user tokens.
// Per-user identity is the Robot_Id, which maps 1:1 to the user's MT5 account
// number (BotSettings.mt5_account). There is NO per-user provisioning endpoint
// in the new bridge — the EA registers itself via /api/mt5/register.

const BRIDGE_BASE_URL = (() => {
  let v = (Deno.env.get("FLOUBA_BACKEND_URL") || "").trim().replace(/\/+$/, "");
  if (v && !/^https?:\/\//i.test(v)) v = "https://" + v;
  return v;
})();

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

    const robotApiKey = Deno.env.get("MT5_ROBOT_API_KEY");
    if (!robotApiKey) return Response.json({ error: "MT5_ROBOT_API_KEY secret not set" }, { status: 500 });
    if (!BRIDGE_BASE_URL) return Response.json({ error: "FLOUBA_BACKEND_URL secret not set" }, { status: 500 });

    // ── Resolve the user's Robot_Id (MT5 account number) ──
    const settingsRecords = await base44.entities.BotSettings.filter({ created_by_id: user.id }, "-created_date", 1).catch(() => []);
    const userSettings = settingsRecords?.[0];
    const robotId = String(userSettings?.mt5_account || "").trim();
    if (!robotId) {
      return Response.json({
        error: "MT5 account not connected — link your MT5 account on the Connect MT5 page first so we can set your Robot_Id.",
      }, { status: 400 });
    }

    // ── Build the EA preset .set file ──
    // MT5 .set preset format: key=value pairs, one per line, ';' for comments.
    // The EA's real input names: Backend_URL, MT5_Robot_Api_Key, Robot_Id.
    const setFileName = `FloubaElite_EA_${robotId}.set`;
    const setContent = [
      `; Flouba Elite — EA Preset (Bridge)`,
      `; Auto-generated for ${email}`,
      `; Robot_Id: ${robotId}`,
      `; Do not share. This links your EA to your bridge account.`,
      `Backend_URL=${BRIDGE_BASE_URL}`,
      `MT5_Robot_Api_Key=${robotApiKey}`,
      `Robot_Id=${robotId}`,
      `Timer_Seconds=5`,
      ``,
      `; Defaults — allow the dashboard to start/stop/trade the robot.`,
      `Operating_Mode=AUTO_BACKEND`,
      `Dry_Run=false`,
      `Allow_Backend_Trades=true`,
      `Allow_Local_Auto_Trades=true`,
      ``,
    ].join("\r\n");

    // Upload the .set file so we can link it in the email
    let setUrl = null;
    try {
      const setFile = new File([setContent], setFileName, { type: "text/plain" });
      const uploadRes = await base44.integrations.Core.UploadFile({ file: setFile });
      setUrl = uploadRes?.file_url || null;
    } catch (e) {
      console.log("EA preset upload failed:", e?.message);
    }

    const fullName = user.full_name || "Trader";
    const firstName = fullName.split(" ")[0];

    // Inline credentials block (fallback if the .set download link is unavailable)
    const credsBlock = `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.18);border-radius:10px;margin-top:8px;">
        <tr><td style="padding:14px 16px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:1px;color:#5fe8ff;text-transform:uppercase;">EA Inputs</p>
          <p style="margin:0 0 6px;font-size:12px;color:#9a9a9a;">Backend_URL</p>
          <p style="margin:0 0 12px;font-family:monospace;font-size:12px;color:#ffffff;word-break:break-all;background:#080808;padding:8px 10px;border-radius:6px;">${BRIDGE_BASE_URL}</p>
          <p style="margin:0 0 6px;font-size:12px;color:#9a9a9a;">MT5_Robot_Api_Key</p>
          <p style="margin:0 0 12px;font-family:monospace;font-size:12px;color:#ffffff;word-break:break-all;background:#080808;padding:8px 10px;border-radius:6px;">${robotApiKey}</p>
          <p style="margin:0 0 6px;font-size:12px;color:#9a9a9a;">Robot_Id <span style="color:#5fe8ff;">(Your MT5 account number)</span></p>
          <p style="margin:0;font-family:monospace;font-size:12px;color:#ffffff;background:#080808;padding:8px 10px;border-radius:6px;">${robotId}</p>
        </td></tr>
      </table>`;

    const setButton = setUrl
      ? `<a href="${setUrl}" target="_blank" style="display:inline-block;padding:14px 36px;background:#0a1a2a;color:#5fe8ff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:10px;border:1px solid rgba(0,229,255,0.4);box-shadow:0 0 16px rgba(0,229,255,0.25);margin-left:8px;">⚙ Download EA Preset (.set)</a>`
      : "";

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
              <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#ffffff;">Your EA &amp; Preset Are Ready</h2>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.7;color:#b0b0b0;">
          <p style="margin:0 0 16px;">Dear ${firstName},</p>
          <p style="margin:0 0 16px;">Here is your Flouba Elite Expert Advisor and a pre-configured preset file. Install the EA on your MT5 terminal and load the preset so it can authenticate with the bridge and begin executing your strategy.</p>
        </td></tr>

        <!-- DOWNLOAD BUTTONS -->
        <tr><td align="center" style="padding:24px 16px;">
          <a href="${eaUrl}" target="_blank" style="display:inline-block;padding:16px 48px;background:#dc2626;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:10px;box-shadow:0 0 20px rgba(220,38,38,0.5);">⬇ Download EA File</a>
          ${setButton}
        </td></tr>

        <!-- PRESET SECTION -->
        <tr><td style="padding:0 32px 8px;">
          <h3 style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:1px;color:#5fe8ff;text-transform:uppercase;">EA Preset (.set)</h3>
          <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#9a9a9a;">
            ${setUrl
              ? `Download the preset above, then in MT5 load it onto the EA via <strong style="color:#fff;">Inputs &rarr; Load</strong> when attaching the EA to your chart.`
              : `When attaching the EA to your chart, open <strong style="color:#fff;">Inputs</strong> and enter the values below:`}
          </p>
          ${credsBlock}
        </td></tr>

        <!-- INSTALLATION STEPS -->
        <tr><td style="padding:16px 32px 0;">
          <h3 style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:1px;color:#dc2626;text-transform:uppercase;">Installation Guide</h3>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[
              "Open <strong style='color:#fff;'>MT5</strong> &rarr; File &rarr; Open Data Folder",
              "Navigate to <strong style='color:#fff;'>MQL5 / Experts / FloubaLite</strong> (create it if missing)",
              "Copy the downloaded EA file into that folder",
              "Open <strong style='color:#fff;'>MetaEditor</strong> (F4) &rarr; open the EA &rarr; Compile (F7)",
              "In MT5: <strong style='color:#fff;'>Tools &rarr; Options &rarr; Expert Advisors</strong> &rarr; enable <strong style='color:#fff;'>Allow algorithmic trading</strong> and <strong style='color:#fff;'>Allow WebRequest</strong> for your backend URL",
              "Drag the EA onto your chart, then <strong style='color:#fff;'>Load the preset (.set)</strong> in the Inputs tab",
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
              <strong style="color:#dc2626;">&#9888; Important:</strong> The preset contains your private API key and Robot_Id. Do not share it. Keep your MT5 terminal running and connected to the internet for uninterrupted automated trading. On first launch the EA self-registers with the bridge using your Robot_Id.
            </td></tr>
          </table>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);background:#080808;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;color:#555;text-transform:uppercase;text-align:center;">&mdash; Flouba Elite Team &mdash;</p>
          <p style="margin:0;font-size:10px;color:#444;text-align:center;line-height:1.6;">This email was sent because you requested your EA file &amp; preset.<br/>If you did not initiate this action, please contact support immediately.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await base44.integrations.Core.SendEmail({
      to: email,
      subject: "Flouba Elite — Your EA File & Preset",
      body: htmlBody,
    });

    return Response.json({ ok: true, sent: true, email, set_url: setUrl, robot_id: robotId });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});