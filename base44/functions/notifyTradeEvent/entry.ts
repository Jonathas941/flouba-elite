import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Entity automation target for the Trade entity.
 * Fires a user-scoped Notification whenever a position is opened or closed.
 * Payload shape (entity automation):
 *   { event: { type, entity_name, entity_id }, data, old_data, changed_fields }
 */
Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const base44 = createClientFromRequest(req);
    const event = body.event || {};
    const data = body.data || {};
    const oldData = body.old_data || {};
    const changedFields = body.changed_fields || [];

    const tradeId = event.entity_id;
    const ownerId = data.created_by_id;
    if (!ownerId) return Response.json({ success: true, skipped: true, reason: "no_owner" });

    // Decide which event this represents.
    let eventType = null;
    if (event.type === "create") {
      // Trades created as "Open" = opened; trades synced as "Closed" = closed (history).
      eventType = data.status === "Closed" ? "closed" : "opened";
    } else if (event.type === "update") {
      // Only notify on a real Open → Closed transition.
      if (changedFields.includes("status") && data.status === "Closed" && oldData?.status === "Open") {
        eventType = "closed";
      }
    }
    if (!eventType) return Response.json({ success: true, skipped: true });

    const pair = data.pair || "—";
    const dir = data.direction || "";
    const lot = data.lot != null ? Number(data.lot).toFixed(2) : "";
    const profit = data.profit != null ? Number(data.profit) : null;
    const reason = data.close_reason || "";

    // Detect scalping trades by strategy/pattern tag
    const patternLower = data.pattern ? String(data.pattern).toLowerCase() : "";
    const isScalp = eventType === "opened" && (
      patternLower.includes("scalp") || patternLower.includes("hft") || patternLower.includes("hedge")
    );

    let title = eventType === "opened" ? "Position Opened" : "Position Closed";
    let message;
    if (eventType === "opened") {
      if (isScalp) {
        title = "Scalping Trade Executed";
        message = `${dir} ${pair} • ${lot} lot${data.entry_price != null ? ` @ ${data.entry_price}` : ""}${data.pattern ? ` • ${data.pattern}` : ""}`;
      } else {
        message = `${dir} ${pair} • ${lot} lot${data.entry_price != null ? ` @ ${data.entry_price}` : ""}`;
      }
    } else {
      const profitTxt = profit != null
        ? (profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`)
        : "";
      message = `${dir} ${pair} • ${lot} lot${profitTxt ? ` • ${profitTxt}` : ""}${reason ? ` (${reason})` : ""}`;
    }

    const category = isScalp
      ? "success"
      : (eventType === "opened" ? "info" : (profit != null && profit < 0 ? "warning" : "success"));

    await base44.asServiceRole.entities.Notification.create({
      type: isScalp ? "bot_action" : "trade",
      title,
      message,
      category,
      read: false,
      meta: {
        trade_id: tradeId,
        pair,
        direction: dir,
        lot: data.lot,
        profit,
        status: data.status,
        close_reason: reason,
        event_type: eventType,
        is_scalp: isScalp,
      },
      created_by_id: ownerId,
    });

    return Response.json({ success: true, notified: true, event_type: eventType });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});