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

    await base44.integrations.Core.SendEmail({
      to: email,
      subject: "Flouba Elite — Your EA File",
      body: `Hello ${user.full_name || ""},\n\nYour MT5 account is now connected to Flouba Elite.\n\nDownload your Expert Advisor (EA) file here:\n${eaUrl}\n\nInstallation steps:\n1. Open MT5 → File → Open Data Folder\n2. Go to MQL5/Experts\n3. Copy the EA file into that folder\n4. Restart MT5 → drag the EA onto your chart\n5. Enable AutoTrading (green button in toolbar)\n\nThe EA will automatically connect to the Flouba Elite bridge server.\n\n— Flouba Elite Team`,
    });

    return Response.json({ ok: true, sent: true, email });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});