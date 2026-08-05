/**
 * riskPolicy.ts — single source of truth for effective risk limits.
 *
 * PRECEDENCE (decided 2026-08-05): DynamicDailyTargetSettings (DDT) is the HARD CEILING.
 * The most conservative value wins. A limit configured in BotSettings or
 * MarketStructureSettings may only ever be TIGHTENED by DDT, never loosened.
 *
 * Why this exists
 * ---------------
 * DDT used to be completely siloed: dynamicDailyTargetEngine read and wrote it, but
 * tradeDecisionEngine, floubaSignalMonitor, multiPairOrchestrator and autoRobotManager
 * each read their own limits straight off BotSettings and never consulted DDT at all.
 * That is why the three layers openly disagreed (e.g. DDT capping 1 open position while
 * BotSettings permitted 13). Every gate should now resolve limits through this module.
 *
 * IMPORTANT GAP — per-trade risk sizing
 * -------------------------------------
 * DDT has NO risk_percentage field. It constrains position COUNT, trade COUNT, daily LOSS
 * and consecutive losses — but it cannot constrain how much is risked on any single trade.
 * So a profile carrying risk_percentage: 40 is NOT clamped by the DDT ceiling. That value
 * is deliberately passed through untouched here rather than silently capped; see
 * `uncapped_risk_percentage` on the returned policy, which surfaces it for the caller
 * (and the UI) to display. Changing it is a position-sizing decision for the account owner.
 */

/** Smallest positive number wins; ignores null/undefined/non-finite/non-positive. */
function tightest(...values) {
  const valid = values
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  return valid.length ? Math.min(...valid) : null;
}

/**
 * Load this user's DDT record. Returns null when absent.
 * Mirrors the ownership lookup used elsewhere: service role can read all rows, so we
 * filter in memory on created_by_id rather than trusting a server-side filter.
 */
export async function loadDdt(base44, userId) {
  const all = await base44.asServiceRole.entities.DynamicDailyTargetSettings
    .filter({}, "created_date", 500)
    .catch(() => []);
  return (all || []).find((d) => d.created_by_id === userId) || null;
}

/**
 * Resolve effective limits for a user.
 *
 * @param cfg  the user's BotSettings record
 * @param ddt  the user's DynamicDailyTargetSettings record (or null)
 * @param opts { marketStructureSettings } optional third layer
 */
export function resolveRiskPolicy(cfg = {}, ddt = null, opts = {}) {
  const mss = opts.marketStructureSettings || null;

  // DDT only acts as a ceiling while it is switched on. When disabled we fall back to
  // the tightest of the remaining layers rather than to the loosest — "most conservative
  // wins" is the rule, DDT is simply the strongest voice when present.
  const ddtActive = !!(ddt && ddt.enabled);

  const balance = Number(cfg.balance) || 0;

  // ── Daily loss limit (absolute dollars) ──
  const botLossPct = cfg.swing_max_daily_loss_pct ?? 40;
  const botLossLimit = balance > 0
    ? (botLossPct / 100) * balance
    : (cfg.daily_loss_limit ?? 50);

  const maxDailyLoss = tightest(
    botLossLimit,
    cfg.daily_loss_limit,
    mss?.max_daily_loss,
    ddtActive ? ddt.hard_loss_stop : null
  ) ?? 50;

  // ── Max simultaneous open positions ──
  const maxConcurrentPositions = tightest(
    cfg.max_concurrent_trades ?? 2,
    mss?.max_open_positions,
    ddtActive ? ddt.max_open_positions : null
  ) ?? 1;

  // ── Max trades per NY trading day ──
  const maxDailyTrades = tightest(
    cfg.swing_max_trades_per_day,
    cfg.max_daily_trades,
    ddtActive ? ddt.max_trades : null
  ) ?? 3;

  // ── Consecutive-loss cooldown trigger ──
  const stopAfterLosses = tightest(
    cfg.stop_after_losses ?? 2,
    mss?.stop_after_consecutive_losses,
    ddtActive ? ddt.stop_after_losses : null
  ) ?? 2;

  // ── Daily profit target ──
  const dailyProfitTarget = tightest(
    cfg.daily_profit_target_amount,
    mss?.max_daily_profit,
    ddtActive ? ddt.target_final : null
  );

  return {
    maxDailyLoss,
    maxConcurrentPositions,
    maxDailyTrades,
    stopAfterLosses,
    dailyProfitTarget,

    // DDT tier state, for callers that want to apply post-target risk reduction.
    ddtActive,
    ddtTier: ddtActive ? (ddt.current_tier || "pre_target") : null,
    ddtRiskReductionPct: ddtActive ? (ddt.risk_reduction_pct ?? 50) : 0,

    // NOT constrained by DDT — see module header. Surfaced so it can be displayed.
    uncapped_risk_percentage: Number(cfg.risk_percentage) || 0,

    // Provenance, for logging and for the UI to explain which layer bound each limit.
    sources: {
      ddt_enabled: ddtActive,
      bot_max_concurrent: cfg.max_concurrent_trades ?? null,
      ddt_max_open_positions: ddtActive ? (ddt.max_open_positions ?? null) : null,
      bot_max_daily_trades: cfg.max_daily_trades ?? null,
      ddt_max_trades: ddtActive ? (ddt.max_trades ?? null) : null,
      ddt_hard_loss_stop: ddtActive ? (ddt.hard_loss_stop ?? null) : null,
    },
  };
}
