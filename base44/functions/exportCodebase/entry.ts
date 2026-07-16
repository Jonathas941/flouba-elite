import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Full codebase export — bundles every entity schema (data model), a complete
// manifest of every backend function / page / component, and a deployment guide
// so the Flouba Elite robot can be replicated in another Base44 app.

const APP_NAME = "Flouba Elite";

const BACKEND_FUNCTIONS = [
  ["mt5Bridge", "Central middleware bridging all MT5 operations. Per-user credential retrieval, symbol suffix normalization, lot-size aliasing (lot_size/volume/lots), 3-attempt retry on 502/503/504, cross-user privacy guard."],
  ["tradeDecisionEngine", "Unified 8/9-pillar confluence gatekeeper (structure, trend, pullback, liquidity, ADX, RSI, volatility, spread, news). Weighted 0-100 Trade Quality Score; Conservative 85+/Balanced 75+/Aggressive 70+. AI dynamic SL/TP via LLM. Recovery engine."],
  ["autoRobotManager", "Orchestrates automated robot sessions across users. Risk management, session rules, scheduled Auto-Start, Danger/HFT modes. Passes full saved user config (no hardcoded defaults)."],
  ["executeAiTrade", "Automated AI trade execution. Cron batch for all auto-execute users + on-demand manual. Invokes decision engine + strategy selector, executes via bridge, logs Trade entity."],
  ["hftExecutionEngine", "HFT engine. Ignores all rules, scalps any profit, multiplies lot on each profitable close (hard max cap), resets on loss. Cron for all HFT users + manual."],
  ["adaptiveStrategyManager", "Scores all 9 core strategies live, auto-activates best-fit per regime. Suitability + win rate + profit factor + drawdown + cooldown tracking. Logs switches to StrategySwitchLog + upserts StrategyMetrics."],
  ["aiStrategySelector", "AI (LLM) picks the single best strategy from live scanner data (ADX/RSI/ATR/EMA/spread). Returns strategy + reason + confidence."],
  ["multiPairSelector", "AI scans all pair quotes, ranks top N by spread + session fit. Returns selected pairs + reasoning."],
  ["multiPairOrchestrator", "Coordinates concurrent multi-pair trades for running robots. AI recommends direction per available pair, executes via bridge."],
  ["floubaSignalScanner", "Scans market, generates FloubaSignal records (8-pillar breakdown) when decision engine fires TRADE. Broker-pending or virtual-trigger entry styles. Cron + manual."],
  ["floubaSignalMonitor", "Monitors active signals. Virtual trigger executes when price reaches entry. Expiration handling. Cron across all users + manual."],
  ["floubaSignalExecute", "Manual signal actions: execute (market order), place_pending (Buy/Sell Stop/Limit), cancel. Updates signal status + logs Trade."],
  ["lsr3rScanner", "Liquidity Sweep → CHOCH → FVG scanner on M1/M5 with anchor-time detection, ATR buffers, lot calc, safety filters. Creates LSR3RSignal records."],
  ["lsr3rWebhook", "Receives MT5 EA webhook (bid/ask/spread/server time/equity) and updates LSR3RSettings for the scanner."],
  ["dynamicDailyTargetEngine", "Dynamic Daily Target tiered system (Target 1/2/Final + hard loss stop). Risk reduction at tiers, locks at final/loss. NY-day reset. Auto-stops robot when locked."],
  ["sessionManager", "Session detection (Asian/London/NY) with DST-aware ET time, rollover blackout, quality scoring, pair allow-lists."],
  ["trailingTpMonitor", "Pyramiding scale-ins + dynamic trailing TP. HTF trend confirmation for pyramids. Progressive trailing tightening."],
  ["syncTradeHistory", "Syncs closed-trade history from MT5 into Trade entity (dedup by ticket_id). Cron all users + manual."],
  ["notifyTradeEvent", "Entity automation for Trade create/update → user-scoped Notification (open/close events)."],
  ["tradeWebhook", "External webhook receiver (MT5_API_TOKEN auth). Dedup by ticket, bulk create trades, win-compounding lot tracking."],
  ["dailySummaryEmail", "Cron: sends branded daily performance summary email to each registered user (per-user data isolation)."],
  ["provisionMT5Account", "Provisions bridge account + API key + JWT for users on signup (entity automation) or manual/batch. Stores flouba_token."],
  ["sendEaFile", "Emails EA file + Bridge preset (.set) with API key + base URL + symbol suffix to the user."],
  ["generateSerialKeys", "Admin: generate FE-XXXX-XXXX-XXXX serial keys (Starter/Pro/Elite), optionally email to client."],
  ["redeemSerialKey", "User redeems key → marks used, activates subscription for duration, triggers EA delivery."],
  ["generateSystemDocumentation", "Generates branded multi-page PDF system reference (functions, strategies, DDT, risk, MT5 connectivity)."],
];

const PAGES = [
  ["/", "Home", "Premium HUD dashboard: robot start/stop, account overview, active pair, robot status, LSR-3R scanner link, trade journal, system docs, FAQ. Auto-reconnect + pull-to-refresh."],
  ["/strategy", "Strategy", "Strategy configuration & live cards for all 9 strategies."],
  ["/settings", "Settings", "Full configuration panels (moved from Home for minimal dashboard)."],
  ["/statistics", "Statistics", "Trade performance metrics & charts."],
  ["/subscription", "Subscription", "Plan status & serial key redemption."],
  ["/admin", "Admin", "Admin panel: serial key generation, user management."],
  ["/ai-signals", "AISignals", "Flouba signal feed with execution controls."],
  ["/ai-scanner", "AIScanner", "Live scanner engine & all-strategy scan."],
  ["/account", "Account", "MT5 account management & switcher."],
  ["/connect-mt5", "ConnectMT5", "MT5 account connection form (account/server/password)."],
  ["/notifications", "Notifications", "In-app notification feed."],
  ["/redeem", "Redeem", "Serial key redemption page."],
  ["/lsr3r", "LSR3RScanner", "LSR-3R live scanner dashboard."],
  ["/lsr3r/history", "LSR3RHistory", "LSR-3R signal history."],
  ["/lsr3r/analytics", "LSR3RAnalytics", "LSR-3R performance analytics."],
  ["/lsr3r/settings", "LSR3RSettings", "LSR-3R scanner configuration."],
  ["/lsr3r/webhook", "LSR3RWebhook", "LSR-3R webhook setup."],
  ["/trade-journal", "TradeJournal", "Closed-trade summary sheet with P&L & metrics."],
  ["/splash", "Splash", "Splash screen."],
];

const COMPONENT_GROUPS = [
  ["dashboard/hud", "HolographicHero, HudPanel — premium HUD dashboard elements"],
  ["dashboard", "DecisionGate, DynamicDailyTargetPanel, SignalAssistantPanel, StrategyTimeframePanel, AutoStartButton, AccountSwitcher, HftModeButton, AdaptiveStrategyPanel, CooldownBanner, StrategyControlCard, EmaIndicatorPanel, MarketWatch, AIStrategyScore, ConnectionCard, AccountOverview, RobotCard, TradesTable, FloubaHeader, SmartControlGrid, BotActionButtons, RobotControls, MarketChartCard, RecentTrades, FloubaLogo"],
  ["robotstart", "RobotStartModal + CollapsibleSection, FormControls, LiquiditySweepSettings, AutoScheduleSettings, HedgeScalperSettings, TrendFilterSettings, SwingPullbackSettings, EmaTrendRecoverySettings, HybridConfluenceSettings, NqKillZoneSettings, MsBosRetestSettings, OrderflowOpeningRangeSettings, GoldMorningRangeSettings, GoldDailyBreakoutSettings, PyramidingSettings, WinCompoundingSettings, AiAutoExecuteSettings, SignalAssistantSettings, constants"],
  ["strategy", "OrderflowOpeningRangeLiveCard, GoldDailyBreakoutLiveCard, GoldMorningRangeLiveCard, HybridConfluenceLiveCard, EmaTrendRecoveryLiveCard, NqKillZoneLiveCard, MsBosRetestLiveCard, SwingPullbackLiveCard"],
  ["scanner", "ScannerStatusPanel, TradeChecklist, LiveScannerEngine, ScanAllStrategies, LiveDebugPanel, EmaCrossOverlay"],
  ["analysis", "DrawdownProtection, AIDashboard, SessionNewsFilter"],
  ["trade", "PeriodStats, PositionsTable, PerformancePanel, TradingDiagnostics, PanicButton, LiveTradeCard, TradeHistoryTable"],
  ["lsr3r", "LSR3RLayout, SignalCard, LSR3RChart, SetupStatusBadge"],
  ["settings", "SettingRow"],
  ["ui", "Full shadcn/ui component library (button, card, dialog, tabs, select, etc.)"],
  ["core", "Layout, ProtectedRoute, ScrollToTop, MobileHeader, RiskDisclaimer, FAQ, GlassCard, AuthLayout, Logo, GoogleIcon, EAConnectionIndicator, MarketSessionStatus, StrategyFilterToggles, StatTile, MobileSelect"],
];

const SECRETS = [
  ["BASE44_API_KEY", "Base44 platform API key (auto-provided)"],
  ["MT5_API_TOKEN", "Shared secret for tradeWebhook auth (set by you)"],
  ["PROVISION_SECRET", "Secret for the MT5 bridge /provision/user endpoint"],
  ["CRON_SECRET", "Shared secret for scheduled automation invocations"],
  ["EA_FILE_URL", "Public URL to the EA (.ex5) file for download emails"],
  ["TIMEZONE", "Trading timezone, e.g. America/New_York"],
  ["NY_SESSION_START / NY_SESSION_END / NY_SESSION_ENABLED", "New York session window (ET)"],
  ["ASIAN_SESSION_START / ASIAN_SESSION_END / ASIAN_SESSION_ENABLED", "Asian session window (ET)"],
  ["SESSION_START / SESSION_END", "General session window"],
];

const AUTOMATIONS = [
  ["autoRobotManager", "scheduled", "5 min", "Auto-start robots + danger mode across users"],
  ["hftExecutionEngine", "scheduled", "1 min", "HFT scalp close/open cycle for HFT users"],
  ["executeAiTrade", "scheduled", "1-5 min", "AI auto-execute trades for enabled users"],
  ["adaptiveStrategyManager", "scheduled", "5-15 min", "Re-score & switch active strategy per user"],
  ["dynamicDailyTargetEngine", "scheduled", "5 min", "Recompute DDT tier + auto-stop when locked"],
  ["trailingTpMonitor", "scheduled", "1 min", "Pyramid + trail TP on open positions"],
  ["multiPairOrchestrator", "scheduled", "5 min", "Open multi-pair trades on running robots"],
  ["floubaSignalScanner", "scheduled", "1-5 min", "Scan for new signals across users"],
  ["floubaSignalMonitor", "scheduled", "1 min", "Execute virtual-trigger signals / expire"],
  ["syncTradeHistory", "scheduled", "5 min", "Sync MT5 closed trades into Trade entity"],
  ["dailySummaryEmail", "scheduled", "Daily", "Email daily performance summary to users"],
  ["provisionMT5Account", "entity", "User create", "Provision bridge account on signup"],
  ["notifyTradeEvent", "entity", "Trade create/update", "Log trade open/close notifications"],
];

function esc(s) { return String(s ?? ""); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}

    const ts = new Date().toISOString();
    const lines = [];

    lines.push("╔══════════════════════════════════════════════════════════════════════╗");
    lines.push("║          FLOUBA ELITE — FULL CODEBASE EXPORT                          ║");
    lines.push("║          AI-Driven Trading Robot — Complete Replication Bundle         ║");
    lines.push("╚══════════════════════════════════════════════════════════════════════╝");
    lines.push("");
    lines.push(`Generated: ${ts}`);
    lines.push(`Prepared for: ${user?.email || "(unauthenticated)"}`);
    lines.push("");
    lines.push("This bundle contains the complete data model (entity schemas), a full");
    lines.push("manifest of every backend function / page / component, the secrets and");
    lines.push("automations required, and a step-by-step deployment guide so the Flouba");
    lines.push("Elite robot can be replicated in another Base44 app.");
    lines.push("");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("  PART 1 — ENTITY SCHEMAS (DATA MODEL)");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push("Recreate each entity in the target app's base44/entities/ directory as");
    lines.push("<EntityName>.jsonc. Every schema below is the complete JSON object.");
    lines.push("Built-in fields (id, created_date, updated_date, created_by_id) are added");
    lines.push("automatically — do not declare them.");
    lines.push("");

    const entityNames = [
      "BotSettings", "SignalAssistantSettings", "FloubaSignal", "TradingAccount",
      "DynamicDailyTargetSettings", "Notification", "LSR3RSettings", "LSR3RSignal",
      "MT5Account", "Trade", "SerialKey", "Subscription", "StrategySwitchLog",
      "TradingViewStrategy", "StrategyMetrics",
    ];

    for (const name of entityNames) {
      try {
        const schema = await base44.asServiceRole.entities[name].schema().catch(() => null);
        lines.push(`── ${name}.jsonc ──────────────────────────────────────────────`);
        lines.push(JSON.stringify({ name, ...schema }, null, 2));
        lines.push("");
      } catch {
        lines.push(`── ${name}.jsonc ── (could not read schema at runtime) ──`);
        lines.push("");
      }
    }
    lines.push("── User.jsonc ── (built-in, read-only) ──");
    lines.push("User is built-in on every Base44 app. Fields: id, created_date, full_name,");
    lines.push("email, role (admin/user). Custom fields added by this app (stored on User):");
    lines.push("mt5_api_key, flouba_token, flouba_slug, mt5_slug, ea_download_url.");
    lines.push("");

    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("  PART 2 — BACKEND FUNCTIONS (26)");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push("Each function lives at base44/functions/<name>/entry.ts (Deno.serve handler).");
    lines.push("Recreate each folder + entry.ts in the target app. The full source for every");
    lines.push("function is available in the source app's base44/functions/ directory.");
    lines.push("");
    BACKEND_FUNCTIONS.forEach(([name, desc], i) => {
      lines.push(`${String(i + 1).padStart(2, "0")}. ${name}`);
      lines.push(`    ${desc}`);
      lines.push("");
    });

    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("  PART 3 — PAGES & ROUTES");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push("Route → Component file under src/pages/. Register each in src/App.jsx.");
    lines.push("");
    PAGES.forEach(([route, comp, desc]) => {
      lines.push(`${route}  →  ${comp}`);
      lines.push(`    ${desc}`);
      lines.push("");
    });

    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("  PART 4 — COMPONENT LIBRARY");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("");
    COMPONENT_GROUPS.forEach(([group, items]) => {
      lines.push(`▸ ${group}/`);
      lines.push(`  ${items}`);
      lines.push("");
    });

    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("  PART 5 — SECRETS / ENVIRONMENT VARIABLES");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push("Set each secret in the target app's dashboard → Settings → Environment");
    lines.push("Variables (or via set_secrets). Read with Deno.env.get(\"NAME\").");
    lines.push("");
    SECRETS.forEach(([name, desc]) => {
      lines.push(`• ${name}`);
      lines.push(`  ${desc}`);
      lines.push("");
    });

    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("  PART 6 — AUTOMATIONS");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push("Create these automations in the target app (dashboard → Automations).");
    lines.push("Scheduled ones use CRON_SECRET in the X-Cron-Secret header or body.");
    lines.push("");
    AUTOMATIONS.forEach(([fn, type, schedule, desc]) => {
      lines.push(`• ${fn}  [${type}${type === "scheduled" ? `: ${schedule}` : ""}]`);
      lines.push(`  ${desc}`);
      lines.push("");
    });

    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("  PART 7 — DEPLOYMENT GUIDE");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push("1. Create the 15 entities (Part 1) as base44/entities/<Name>.jsonc.");
    lines.push("2. Create the 26 backend functions (Part 2) as base44/functions/<name>/entry.ts.");
    lines.push("3. Recreate the pages (Part 3) under src/pages/ and register routes in App.jsx.");
    lines.push("4. Recreate the components (Part 4) under src/components/.");
    lines.push("5. Set the 9 secrets (Part 5) in dashboard settings.");
    lines.push("6. Create the 13 automations (Part 6) — scheduled + entity triggers.");
    lines.push("7. Copy the design system: src/index.css (tokens), tailwind.config.js (mappings).");
    lines.push("8. Install npm packages: framer-motion, lucide-react, recharts, jspdf, react-leaflet,");
    lines.push("   @hello-pangea/dnd, @tanstack/react-query, react-hook-form, date-fns, lodash, react-markdown.");
    lines.push("9. Configure the MT5 bridge BASE URL in each function (the Replit bridge endpoint).");
    lines.push("10. Provision the first admin user, generate serial keys, redeem to activate subscription.");
    lines.push("");
    lines.push("The MT5 bridge server (external Replit app) must be deployed separately — it is");
    lines.push("the engine that connects to MetaTrader 5 terminals and exposes the REST API that");
    lines.push("every backend function calls (BASE constant in each entry.ts).");
    lines.push("");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("  PART 8 — ARCHITECTURE OVERVIEW");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push("MENTALITY: Trade less, but better. Capital protection first. No martingale");
    lines.push("on losses, no revenge trades, no grid stacking after losses. The robot");
    lines.push("refuses to trade when conditions are poor (NO_TRADE is a valid decision).");
    lines.push("");
    lines.push("TRADE DECISION ENGINE: 9-pillar weighted confluence (Structure 20, Trend 20,");
    lines.push("ADX 15, RSI 10, Volatility 10, S/R-Liquidity 10, Spread 5, Session 5, News 5).");
    lines.push("Capital Protection is a hard gate. Modes: Conservative 85+, Balanced 75+,");
    lines.push("Aggressive 70+. AI LLM proposes dynamic ATR SL + RR on a TRADE decision.");
    lines.push("");
    lines.push("ADAPTIVE ENGINE: Scores all 9 strategies live, auto-activates best per regime.");
    lines.push("Switches only when a rival outperforms active by threshold over N confirm bars.");
    lines.push("");
    lines.push("DYNAMIC DAILY TARGET: Tiered profit system (T1 risk -50%, T2 score≥85 only,");
    lines.push("Final stops all entries, hard loss stop halts trading). Resets at NY day rollover.");
    lines.push("");
    lines.push("EXECUTION MODES: HFT (bypass all limits), Recovery (equity<balance multi-trade),");
    lines.push("Pyramiding (scale into trend), Trailing TP, Win Compounding, Multi-Pair Auto-Select.");
    lines.push("");
    lines.push("SIGNAL ASSISTANT: Signal Only / Semi-Auto / Full Auto. Virtual Trigger or");
    lines.push("Broker Pending Order. Statuses: WAITING_FOR_ENTRY → CONFIRMED → EXECUTED / EXPIRED.");
    lines.push("");
    lines.push("CONNECTIVITY: mt5Bridge middleware with auto-reconnect (2 failed heartbeats),");
    lines.push("3-attempt retry on 502/503/504, cross-user privacy guard, symbol suffix handling.");
    lines.push("");
    lines.push("ACCESS: Serial keys (Starter/Pro/Elite) → subscription → EA + bridge provisioning.");
    lines.push("");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("  END OF EXPORT");
    lines.push("═══════════════════════════════════════════════════════════════════════");

    const text = lines.join("\n");

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="FloubaElite-Codebase-Export.txt"',
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});