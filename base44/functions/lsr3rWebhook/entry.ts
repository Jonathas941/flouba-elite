import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// LSR-3R MT5 Webhook Receiver
// Receives live MT5 data from the user's EA: symbol, bid, ask, spread, server time,
// open positions, account equity, balance, tick value, tick size, min lot, lot step.
// Updates the matching user's LSR3RSettings so the scanner can use real broker data.

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch {}

    // Authenticate via webhook secret (header or body)
    const secret = req.headers.get("X-Webhook-Secret") || req.headers.get("x-webhook-secret") || body.webhook_secret;
    const accountId = body.account_id || req.headers.get("X-Account-Id");

    if (!secret) {
      return Response.json({ error: "Missing webhook secret" }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);

    // Match settings by webhook_secret (and optionally account_id)
    const query = { webhook_secret: secret, webhook_enabled: true };
    const settingsRecs = await base44.asServiceRole.entities.LSR3RSettings.filter(query, "-created_date", 5);
    if (!settingsRecs?.length) {
      return Response.json({ error: "No matching webhook configuration" }, { status: 401 });
    }

    let settings = settingsRecs[0];
    // If account_id provided, prefer the exact match
    if (accountId) {
      const exact = settingsRecs.find(s => s.account_id === accountId);
      if (exact) settings = exact;
    }

    // Update settings with incoming broker data
    const updates = {
      last_webhook_update: new Date().toISOString(),
      broker_server_time: body.server_time || new Date().toISOString(),
      account_equity: body.account_equity ?? body.equity ?? settings.account_equity,
      account_balance: body.balance ?? settings.account_balance,
      tick_value: body.tick_value ?? settings.tick_value,
      tick_size: body.tick_size ?? settings.tick_size,
      min_lot: body.minimum_lot ?? body.min_lot ?? settings.min_lot,
      lot_step: body.lot_step ?? settings.lot_step ?? 0.01,
      account_mode: body.account_mode || (body.demo === true ? "Demo" : (body.demo === false ? "Live" : settings.account_mode)),
      broker_server: body.broker_server || settings.broker_server,
      broker_timezone_offset: body.server_timezone_offset ?? settings.broker_timezone_offset,
    };

    await base44.asServiceRole.entities.LSR3RSettings.update(settings.id, updates);

    // Store the latest tick data as a notification (lightweight, for audit)
    const tickData = {
      symbol: body.symbol,
      bid: body.bid,
      ask: body.ask,
      spread: body.spread || (body.bid && body.ask ? body.ask - body.bid : null),
      open_positions: body.open_positions,
      server_time: body.server_time,
    };

    return Response.json({
      ok: true,
      message: "Webhook data received",
      account_id: settings.account_id,
      broker_server: updates.broker_server,
      server_time: updates.broker_server_time,
      account_mode: updates.account_mode,
      equity: updates.account_equity,
      balance: updates.account_balance,
      tick: tickData,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});