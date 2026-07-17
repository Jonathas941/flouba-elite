import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Returns the hosted EA download URL and a pre-configured .set preset (with the
// user's Robot_Id, Backend_URL, and shared MT5_Robot_Api_Key) so the frontend
// can trigger both downloads directly — no email integration required.

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

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const eaUrl = Deno.env.get("EA_FILE_URL");
    if (!eaUrl) return Response.json({ error: "EA_FILE_URL secret not set" }, { status: 500 });

    const robotApiKey = Deno.env.get("MT5_ROBOT_API_KEY");
    if (!BRIDGE_BASE_URL) return Response.json({ error: "FLOUBA_BACKEND_URL secret not set" }, { status: 500 });
    if (!robotApiKey) return Response.json({ error: "MT5_ROBOT_API_KEY secret not set" }, { status: 500 });

    // Resolve Robot_Id: passed in body (current login field) > saved BotSettings
    const settingsRecords = await base44.entities.BotSettings.filter({ created_by_id: user.id }, "-created_date", 1).catch(() => []);
    const robotId = String(body.robot_id || settingsRecords?.[0]?.mt5_account || "").trim();

    const setFileName = robotId ? `FloubaElite_EA_${robotId}.set` : "FloubaElite_EA.set";
    const setContent = [
      `; Flouba Elite — EA Preset (Bridge)`,
      `; Auto-generated for ${user.email}`,
      robotId ? `; Robot_Id: ${robotId}` : `; Robot_Id: <enter your MT5 account number>`,
      `; Do not share. This links your EA to your bridge account.`,
      `Backend_URL=${BRIDGE_BASE_URL}`,
      `MT5_Robot_Api_Key=${robotApiKey}`,
      `Robot_Id=${robotId}`,
      `Timer_Seconds=5`,
      ``,
      `; Safety defaults — review before going live.`,
      `Operating_Mode=MANUAL_SIGNAL_ONLY`,
      `Dry_Run=true`,
      `Allow_Backend_Trades=false`,
      `Allow_Local_Auto_Trades=false`,
      ``,
    ].join("\r\n");

    return Response.json({
      ok: true,
      ea_url: eaUrl,
      set_content: setContent,
      set_filename: setFileName,
      robot_id: robotId || null,
      backend_url: BRIDGE_BASE_URL,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});