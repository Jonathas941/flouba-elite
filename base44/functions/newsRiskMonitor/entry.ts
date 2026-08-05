import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── AI News Risk Monitor ───────────────────────────────────────────────────
// Scheduled backend function that uses InvokeLLM with web search to scan for
// high-impact financial news (FOMC, NFP, CPI, rate decisions) that could
// affect the user's active trading symbol. When high-impact news is detected
// within the next 60 minutes, it creates a Notification and adjusts the user's
// BotSettings to temporarily tighten risk (enable news_filter, reduce
// max_concurrent_trades if aggressive).

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    const headersReq = new Request(req.url, { method: "GET", headers: req.headers });
    const base44 = createClientFromRequest(headersReq);
    const user = await base44.auth.me().catch(() => null);
    const cronSecret = Deno.env.get("CRON_SECRET");
    const hasCron = cronSecret && (req.headers.get("X-Cron-Secret") === cronSecret || JSON.parse(bodyText || "{}").cron_secret === cronSecret);

    let userId = user?.id || null;
    let body = {};
    try { body = JSON.parse(bodyText); } catch {}

    if (body.target_user_id && body.target_user_id !== userId) {
      if (!hasCron && user?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
      userId = body.target_user_id;
    }
    if (!userId) {
      if (!hasCron) return Response.json({ error: "Unauthorized" }, { status: 401 });
      // Cron mode: scan all users with MT5 accounts configured
      const allSettings = await base44.asServiceRole.entities.BotSettings.list("-created_date", 100).catch(() => []);
      const users = (allSettings || []).filter((s) => s.mt5_account);
      const results = await Promise.allSettled(users.map((s) => scanUser(base44, s)));
      return Response.json({
        ok: true,
        scanned: users.length,
        alerts: results.filter((r) => r.status === "fulfilled" && r.value?.alerted).map((r) => r.value),
      });
    }

    // Single user mode
    const settings = await base44.asServiceRole.entities.BotSettings.filter({ created_by_id: userId }, "-created_date", 1);
    const cfg = settings?.[0];
    if (!cfg?.mt5_account) return Response.json({ ok: true, skipped: "No MT5 account configured" });

    const result = await scanUser(base44, cfg);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

async function scanUser(base44, cfg) {
  const symbol = cfg.active_pair || "XAUUSD";
  const symbolLabel = symbol === "XAUUSD" ? "Gold (XAUUSD)" : symbol;

  // Ask LLM with web search to check for high-impact news in the next 60 minutes
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a financial news risk monitor. Check for HIGH-IMPACT economic news events happening RIGHT NOW or within the NEXT 60 MINUTES that could cause significant volatility for ${symbolLabel} (forex/gold/indices).

High-impact events include: FOMC statements, Fed rate decisions, Non-Farm Payrolls (NFP), CPI data, PPI data, GDP releases, ECB/BOE rate decisions, geopolitical escalations, or major market-moving announcements.

Use real-time web data to determine if any such event is scheduled or currently unfolding.

Respond with:
- has_high_impact: true only if a high-impact event is happening now or within 60 minutes
- event_name: the name of the event (or null)
- event_time: when it occurs (ISO or null)
- minutes_until: minutes until the event (or null if already happening)
- severity: "extreme", "high", "moderate", or "low"
- recommended_action: one of "halt_trading", "reduce_risk", "normal_caution", or "no_action"
- summary: 1-2 sentence summary of the news situation`,
    add_context_from_internet: true,
    model: "gemini_3_flash",
    response_json_schema: {
      type: "object",
      properties: {
        has_high_impact: { type: "boolean" },
        event_name: { type: "string" },
        event_time: { type: "string" },
        minutes_until: { type: "number" },
        severity: { type: "string", enum: ["extreme", "high", "moderate", "low"] },
        recommended_action: { type: "string", enum: ["halt_trading", "reduce_risk", "normal_caution", "no_action"] },
        summary: { type: "string" },
      },
      required: ["has_high_impact", "recommended_action", "summary"],
    },
  });

  const action = res?.recommended_action || "no_action";
  const hasImpact = res?.has_high_impact === true;

  // If no high-impact news, return quietly
  if (!hasImpact || action === "no_action") {
    return { ok: true, alerted: false, symbol, action, summary: res?.summary || "No high-impact news detected." };
  }

  // Create a notification for the user
  const severityCategory = res.severity === "extreme" ? "danger" : res.severity === "high" ? "warning" : "info";
  const eventLabel = res.event_name ? `${res.event_name}` : "High-impact news event";
  const timeLabel = res.minutes_until != null
    ? res.minutes_until > 0 ? `in ${Math.round(res.minutes_until)} min` : "happening now"
    : "imminent";

  await base44.asServiceRole.entities.Notification.create({
    type: "alert",
    title: `⚠ ${eventLabel} — ${timeLabel}`,
    message: `${res.summary || "High-impact news detected."} Severity: ${res.severity}. Recommended: ${action === "halt_trading" ? "HALT TRADING" : action === "reduce_risk" ? "REDUCE RISK" : "use caution"}.`,
    category: severityCategory,
    meta: {
      symbol,
      event_name: res.event_name || null,
      event_time: res.event_time || null,
      minutes_until: res.minutes_until ?? null,
      severity: res.severity || null,
      recommended_action: action,
    },
  }).catch(() => {});

  // Auto-adjust risk settings if action is reduce_risk or halt_trading
  if (action === "halt_trading" || action === "reduce_risk") {
    const updates = { news_filter: true };
    // For halt_trading: tighten further — reduce max concurrent to 1
    if (action === "halt_trading" && cfg.max_concurrent_trades > 1) {
      updates.max_concurrent_trades = 1;
    }
    // Enable the news buffer if not already set
    if (cfg.liq_news_buffer_minutes == null || cfg.liq_news_buffer_minutes < 30) {
      updates.liq_news_buffer_minutes = 30;
    }

    await base44.asServiceRole.entities.BotSettings.update(cfg.id, updates).catch(() => {});
  }

  return {
    ok: true,
    alerted: true,
    symbol,
    event_name: res.event_name || null,
    severity: res.severity || null,
    action,
    summary: res.summary,
    adjustments: action === "halt_trading" ? ["news_filter=true", "max_concurrent=1", "news_buffer=30min"] : action === "reduce_risk" ? ["news_filter=true", "news_buffer=30min"] : [],
  };
}