import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

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

      const body = `
        <h2>Flouba Elite — Daily Trading Summary</h2>
        <p>${dateLabel}</p>
        <p><strong>Total Trades:</strong> ${todayTrades.length}</p>
        <p><strong>Total Profit:</strong> ${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(2)}</p>
        <p><strong>Drawdown:</strong> $${drawdown.toFixed(2)}${drawdownPct !== null ? ` (${drawdownPct.toFixed(1)}% of balance)` : ""}</p>
      `;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject: `Flouba Elite — Daily Summary (${dateLabel})`,
        body,
      });
      emailsSent++;
    }

    return Response.json({ success: true, emailsSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});