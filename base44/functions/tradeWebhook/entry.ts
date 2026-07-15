import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Webhook receiver — the MT5 bridge / EA POSTs closed-trade details here.
 *
 * Auth: validated via MT5_API_TOKEN shared secret (header "X-Api-Token" or body "api_token").
 * User identification: the body must include "api_key" (the user's bridge API key
 * provisioned on signup and stored in User.mt5_api_key) or "base44_user_id".
 *
 * Payload (single trade):
 *   { api_key, ticket, symbol, direction, volume, profit, status,
 *     entry_price, close_price, stop_loss, take_profit,
 *     opened_at, closed_at, close_reason }
 *
 * Payload (batch):
 *   { api_key, trades: [ { ticket, symbol, ... }, ... ] }
 */
Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    // ── Validate shared secret ──
    const sharedSecret = Deno.env.get("MT5_API_TOKEN");
    if (!sharedSecret) {
      return Response.json({ error: "MT5_API_TOKEN secret not set" }, { status: 500 });
    }
    const providedToken = req.headers.get("X-Api-Token") || body.api_token;
    if (providedToken !== sharedSecret) {
      return Response.json({ error: "Invalid or missing API token" }, { status: 401 });
    }

    // ── Identify the user ──
    const apiKey = body.api_key;
    const base44UserId = body.base44_user_id;
    if (!apiKey && !base44UserId) {
      return Response.json({ error: "Must provide api_key or base44_user_id" }, { status: 400 });
    }

    // Service role — we're authenticated via shared secret, not user session
    const base44 = createClientFromRequest(new Request(req.url, { method: "GET", headers: req.headers }));

    // Find the user by api_key or base44_user_id
    let user = null;
    if (apiKey) {
      const users = await base44.asServiceRole.entities.User.list();
      user = users.find(u => u.mt5_api_key === apiKey);
    }
    if (!user && base44UserId) {
      user = await base44.asServiceRole.entities.User.get(base44UserId).catch(() => null);
    }
    if (!user) {
      return Response.json({ error: "User not found for provided credentials" }, { status: 404 });
    }

    // ── Normalize trades into an array ──
    const rawTrades = Array.isArray(body.trades) ? body.trades : (body.ticket ? [body] : []);
    if (rawTrades.length === 0) {
      return Response.json({ error: "No trade data provided" }, { status: 400 });
    }

    // ── Deduplicate against existing ticket_ids for this user ──
    const existingTrades = await base44.asServiceRole.entities.Trade.filter(
      { created_by_id: user.id }, "-created_date", 500
    ).catch(() => []);
    const existingTickets = new Set(existingTrades.map(t => t.ticket_id).filter(Boolean));

    function formatDate(d) {
      if (!d) return null;
      const dt = new Date(d);
      return isNaN(dt) ? null : dt.toISOString();
    }

    function normalizeCloseReason(t) {
      const VALID = ["Take Profit", "Stop Loss", "Daily Target", "Daily Loss Limit", "Panic", "Manual", "Opposite Signal"];
      const c = (t.close_reason || t.comment || "").toString();
      if (VALID.includes(c)) return c;
      const cl = c.toLowerCase();
      if (/sl|stop ?loss/i.test(cl)) return "Stop Loss";
      if (/tp|take ?profit/i.test(cl)) return "Take Profit";
      if (/daily|target/i.test(cl)) return "Daily Target";
      if (/loss ?limit/i.test(cl)) return "Daily Loss Limit";
      if (/panic/i.test(cl)) return "Panic";
      if (/manual|close/i.test(cl)) return "Manual";
      if (/opposite|reverse/i.test(cl)) return "Opposite Signal";
      return (t.profit ?? 0) >= 0 ? "Take Profit" : "Stop Loss";
    }

    const newTrades = [];
    let skippedDupes = 0;
    for (const t of rawTrades) {
      const ticket = String(t.ticket ?? t.id ?? t.ticket_id ?? "");
      if (!ticket) continue;
      if (existingTickets.has(ticket)) { skippedDupes++; continue; }

      const isBuy = t.type === 0 || t.type === "buy" || (t.direction || "").toLowerCase().includes("buy");
      newTrades.push({
        pair: t.symbol || t.pair || "UNKNOWN",
        direction: isBuy ? "Buy" : "Sell",
        lot: t.volume ?? t.lot ?? null,
        profit: t.profit ?? t.realized_pnl ?? 0,
        status: "Closed",
        entry_price: t.entry_price ?? t.open_price ?? t.openPrice ?? null,
        current_price: t.close_price ?? t.closePrice ?? t.current_price ?? null,
        stop_loss: t.stop_loss ?? t.sl ?? null,
        take_profit: t.take_profit ?? t.tp ?? null,
        opened_at: formatDate(t.opened_at ?? t.open_time ?? t.openTime),
        closed_at: formatDate(t.closed_at ?? t.close_time ?? t.closeTime),
        close_reason: normalizeCloseReason(t),
        ticket_id: ticket,
        created_by_id: user.id,
      });
      existingTickets.add(ticket); // prevent dupes within the same batch
    }

    let created = 0;
    if (newTrades.length) {
      await base44.asServiceRole.entities.Trade.bulkCreate(newTrades);
      created = newTrades.length;

      // ── Win Compounding: escalate lot on each confirmed win, reset on loss ──
      const botSettings = await base44.asServiceRole.entities.BotSettings.filter(
        { created_by_id: user.id }, "-created_date", 1
      ).catch(() => []);
      const cfg = botSettings[0];
      if (cfg?.win_compounding_enabled) {
        const multiplier = cfg.win_compounding_multiplier ?? 1.5;
        const baseLot = cfg.win_compounding_base_lot ?? 0.01;
        const maxLot = cfg.win_compounding_max_lot ?? 0.5;
        const resetOnLoss = cfg.win_compounding_reset_on_loss !== false;
        let currentLot = cfg.win_compounding_current_lot ?? baseLot;
        let consecutiveWins = cfg.win_compounding_consecutive_wins ?? 0;

        for (const t of newTrades) {
          const profit = Number(t.profit ?? 0);
          if (profit > 0) {
            // Confirmed win — multiply the lot for the next trade
            consecutiveWins += 1;
            currentLot = Math.min(currentLot * multiplier, maxLot);
          } else if (profit < 0 && resetOnLoss) {
            // Loss — reset to base lot
            consecutiveWins = 0;
            currentLot = baseLot;
          }
        }

        await base44.asServiceRole.entities.BotSettings.update(cfg.id, {
          win_compounding_current_lot: Math.round(currentLot * 10000) / 10000,
          win_compounding_consecutive_wins: consecutiveWins,
        }).catch(() => {});
      }
    }

    return Response.json({
      ok: true,
      received: rawTrades.length,
      created,
      duplicates_skipped: skippedDupes,
      user_id: user.id,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});