import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    // Read body FIRST — the SDK may consume the body stream during auth
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    // Auth: shared cron secret (scheduled automation) OR admin user (manual call)
    const cronSecret = Deno.env.get("CRON_SECRET");
    const secretMatch = cronSecret && (
      req.headers.get("X-Cron-Secret") === cronSecret ||
      body.cron_secret === cronSecret
    );

    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);

    if (!secretMatch) {
      // Require an authenticated Base44 context (blocks public callers).
      // Then block non-admin users (regular users can't invoke service-role ops).
      // me() returning null with isAuthenticated=true = internal scheduler — allowed.
      const isAuth = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuth) {
        return Response.json({ error: "Unauthorized — authentication required" }, { status: 403 });
      }
      const user = await base44.auth.me().catch(() => null);
      if (user && user.role !== "admin") {
        return Response.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const users = await base44.asServiceRole.entities.User.list();
    let emailsSent = 0;

    for (const user of users) {
      if (!user.email) continue;

      const closedTrades = await base44.asServiceRole.entities.Trade.filter({
        created_by_id: user.id,
        status: "Closed",
      });
      const todayTrades = closedTrades.filter(
        (t) => t.closed_at && new Date(t.closed_at) >= startOfDay
      );

      const totalProfit = todayTrades.reduce((sum, t) => sum + (t.profit ?? 0), 0);
      const losses = todayTrades.filter((t) => (t.profit ?? 0) < 0);
      const drawdown = Math.abs(losses.reduce((sum, t) => sum + (t.profit ?? 0), 0));

      const settingsList = await base44.asServiceRole.entities.BotSettings.filter({
        created_by_id: user.id,
      });
      const balance = settingsList[0]?.balance;
      const drawdownPct = balance ? (drawdown / balance) * 100 : null;

      const dateLabel = new Date().toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });

      const profitColor = totalProfit >= 0 ? "#22c55e" : "#ef4444";
      const profitSign = totalProfit >= 0 ? "+" : "";
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
          <p style="margin:6px 0 0;font-size:10px;letter-spacing:3px;color:rgba(220,38,38,0.7);text-transform:uppercase;">Daily Trading Summary</p>
        </td></tr>
        <tr><td style="padding:0 32px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="width:3px;background:#dc2626;border-radius:2px;"></td>
            <td style="padding:0 0 0 16px;">
              <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#ffffff;">${dateLabel}</h2>
              <p style="margin:0;font-size:13px;color:#9a9a9a;">Here's how your trading robot performed today.</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:20px 32px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:33%;padding:18px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-align:center;">
                <p style="margin:0 0 6px;font-size:10px;letter-spacing:2px;color:#9a9a9a;text-transform:uppercase;">Trades</p>
                <p style="margin:0;font-size:26px;font-weight:900;color:#ffffff;">${todayTrades.length}</p>
              </td>
              <td style="width:4px;"></td>
              <td style="width:33%;padding:18px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-align:center;">
                <p style="margin:0 0 6px;font-size:10px;letter-spacing:2px;color:#9a9a9a;text-transform:uppercase;">Net Profit</p>
                <p style="margin:0;font-size:22px;font-weight:900;color:${profitColor};">${profitSign}$${totalProfit.toFixed(2)}</p>
              </td>
              <td style="width:4px;"></td>
              <td style="padding:18px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-align:center;">
                <p style="margin:0 0 6px;font-size:10px;letter-spacing:2px;color:#9a9a9a;text-transform:uppercase;">Drawdown</p>
                <p style="margin:0;font-size:22px;font-weight:900;color:#ef4444;">$${drawdown.toFixed(2)}</p>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:8px 32px 0;font-size:13px;line-height:1.6;color:#9a9a9a;">
          <p style="margin:0;">Drawdown represents today's closed losing trades${drawdownPct !== null ? ` &mdash; <strong style="color:#ef4444;">${drawdownPct.toFixed(1)}%</strong> of your account balance` : ""}.</p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.15);border-radius:10px;">
            <tr><td style="padding:16px;font-size:13px;line-height:1.6;color:#9a9a9a;">Keep your MT5 terminal running and connected for uninterrupted automated trading. Review your dashboard for full position details and strategy performance.</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);background:#080808;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;color:#555;text-transform:uppercase;text-align:center;">&mdash; Flouba Elite Team &mdash;</p>
          <p style="margin:0;font-size:10px;color:#444;text-align:center;line-height:1.6;">This is an automated daily summary of your Flouba Elite trading activity.<br/>Adjust notification preferences anytime in the app settings.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject: `Flouba Elite — Daily Summary (${dateLabel})`,
        body: html,
      });
      emailsSent++;
    }

    return Response.json({ success: true, emailsSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});