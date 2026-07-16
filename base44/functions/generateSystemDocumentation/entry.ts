import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { jsPDF } from 'npm:jspdf@4.2.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Optional auth — allow both authed and unauthed (static documentation)
    let user = null;
    try { user = await base44.auth.me(); } catch {}

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 44;
    const contentW = pageW - margin * 2;
    let y = margin;

    const colors = {
      green: [0, 200, 65] as [number, number, number],
      dark: [10, 12, 14] as [number, number, number],
      gold: [255, 180, 40] as [number, number, number],
      red: [220, 50, 50] as [number, number, number],
      gray: [90, 95, 100] as [number, number, number],
      light: [230, 232, 235] as [number, number, number],
    };

    function newPage() {
      doc.addPage();
      y = margin;
    }

    function ensureSpace(needed: number) {
      if (y + needed > pageH - margin - 24) newPage();
    }

    function fillPageBg() {
      doc.setFillColor(...colors.dark);
      doc.rect(0, 0, pageW, pageH, 'F');
    }

    function headerFooter() {
      doc.setFontSize(7);
      doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
      doc.setFont('helvetica', 'normal');
      doc.text('FLOUBA ELITE — SYSTEM DOCUMENTATION', margin, pageH - 16);
      doc.text(`v2026.07  |  Generated ${new Date().toISOString().slice(0, 10)}`, pageW - margin, pageH - 16, { align: 'right' });
    }

    function h1(text: string) {
      ensureSpace(60);
      y += 16;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(colors.green[0], colors.green[1], colors.green[2]);
      doc.text(text, margin, y);
      y += 6;
      doc.setDrawColor(colors.green[0], colors.green[1], colors.green[2]);
      doc.setLineWidth(1.2);
      doc.line(margin, y, margin + 80, y);
      doc.setDrawColor(colors.gray[0], colors.gray[1], colors.gray[2]);
      doc.setLineWidth(0.3);
      doc.line(margin + 84, y, pageW - margin, y);
      y += 16;
    }

    function h2(text: string) {
      ensureSpace(40);
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(colors.light[0], colors.light[1], colors.light[2]);
      doc.text(text, margin, y);
      y += 12;
    }

    function h3(text: string) {
      ensureSpace(24);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
      doc.text(text, margin, y);
      y += 10;
    }

    function para(text: string, opts: { indent?: number; color?: [number, number, number]; size?: number } = {}) {
      const indent = opts.indent ?? 0;
      const size = opts.size ?? 9;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(size);
      const c = opts.color ?? colors.light;
      doc.setTextColor(c[0], c[1], c[2]);
      const lines = doc.splitTextToSize(text, contentW - indent);
      for (const ln of lines) {
        ensureSpace(size + 3);
        doc.text(ln, margin + indent, y);
        y += size + 3;
      }
    }

    function bullet(text: string, indent = 0) {
      ensureSpace(12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(colors.light[0], colors.light[1], colors.light[2]);
      doc.text('•', margin + indent, y);
      const lines = doc.splitTextToSize(text, contentW - indent - 12);
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) ensureSpace(11);
        doc.text(lines[i], margin + indent + 10, y);
        y += 11;
      }
    }

    function paramRow(label: string, value: string) {
      ensureSpace(11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(colors.green[0], colors.green[1], colors.green[2]);
      doc.text(label, margin + 8, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.light[0], colors.light[1], colors.light[2]);
      doc.text(value, margin + 150, y);
      y += 11;
    }

    function divider() {
      ensureSpace(10);
      y += 4;
      doc.setDrawColor(colors.gray[0], colors.gray[1], colors.gray[2]);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageW - margin, y);
      y += 8;
    }

    // ═══════════════════════════════════════════════════════════════
    // TITLE PAGE
    // ═══════════════════════════════════════════════════════════════
    fillPageBg();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(34);
    doc.setTextColor(colors.green[0], colors.green[1], colors.green[2]);
    doc.text('FLOUBA ELITE', pageW / 2, pageH * 0.28, { align: 'center' });
    doc.setFontSize(13);
    doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
    doc.text('AI-Driven Trading System — Complete Reference', pageW / 2, pageH * 0.34, { align: 'center' });
    doc.setDrawColor(colors.green[0], colors.green[1], colors.green[2]);
    doc.setLineWidth(1.5);
    doc.line(pageW * 0.3, pageH * 0.38, pageW * 0.7, pageH * 0.38);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.light[0], colors.light[1], colors.light[2]);
    const intro = [
      'This document details every function, every strategy, every setup,',
      'and the core trading mentality of the Flouba Elite algorithm.',
      '',
      'It covers the full architecture: backend functions, the Trade Decision',
      'Engine, the Dynamic Daily Target system, all specialized execution',
      'modes, risk management guardrails, and AI auto-execution.',
    ];
    intro.forEach((line, i) => doc.text(line, pageW / 2, pageH * 0.46 + i * 16, { align: 'center' }));

    doc.setFontSize(9);
    doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    doc.text(`Document generated: ${new Date().toLocaleString()}`, pageW / 2, pageH * 0.82, { align: 'center' });
    if (user) doc.text(`Prepared for: ${user.email}`, pageW / 2, pageH * 0.86, { align: 'center' });
    doc.text('CONFIDENTIAL — Flouba Elite Algorithm', pageW / 2, pageH * 0.92, { align: 'center' });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 1 — CORE MENTALITY
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('1. CORE MENTALITY & PHILOSOPHY');

    h2('The Flouba Elite Doctrine');
    para('Flouba Elite is built on a single overriding principle: trade less, but better. The system is engineered to wait patiently for high-confluence setups and to protect capital above all else. It does not chase the market, does not revenge-trade after losses, and does not increase lot size after a loss.');

    h3('Capital Protection First');
    bullet('A "NO TRADE" mode is enforced whenever market conditions are ambiguous, choppy, or high-spread — the robot would rather sit idle than gamble.');
    bullet('The bot never increases lot size after a loss to chase the market (no Martingale on adverse outcomes).');
    bullet('Equity guard halts all trading if equity drops below a configurable percentage of balance.');
    bullet('Daily loss limits, consecutive-loss cooldowns, and session-level drawdown caps are all enforced.');

    h3('Trade Less, But Better');
    bullet('Every entry requires multiple technical confirmations (8-pillar / 9-pillar confluence) before the robot commits capital.');
    bullet('Strict strategy modes (Conservative 85+, Balanced 75+, Aggressive 70+) gate the minimum confluence score required.');
    bullet('Mandatory news filter blocks trading around high-impact events.');
    bullet('EMA pullback validation ensures entries are at quality retracement levels, not extended tops/bottoms.');

    h3('Bi-Directional & Adaptive');
    bullet('The robot supports both long and short positions simultaneously (trade_direction: both / buy / sell).');
    bullet('An Adaptive AI Strategy Engine continuously scores all 9 core strategies against live market data and auto-activates the best-fit strategy per market regime.');
    bullet('Multi-trade recovery is allowed when equity falls below balance, opening larger confirmed-direction positions to pull equity back up — preventing account blowup.');

    h3('Transparency & Professional Workflow');
    bullet('Every signal displays full breakdown: symbol, direction, entry, SL, TP, lot size, risk, confidence, reason, and market structure before execution.');
    bullet('Signals carry clear status: WAITING_FOR_ENTRY, CONFIRMED, EXECUTED, EXPIRED, CANCELLED.');
    bullet('No fake or demo data is ever shown — placeholders ("--", "N/A") appear when disconnected.');

    h3('Danger Mode (Override)');
    para('Danger Mode is an explicit override that bypasses ALL safety limits — including daily loss caps and minimum profit thresholds. It triggers HFT live execution immediately without waiting. This mode is gated behind a visible red dashboard banner and is intended only for advanced users who accept full risk.', { color: colors.red });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 2 — ARCHITECTURE / BACKEND FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('2. SYSTEM ARCHITECTURE — BACKEND FUNCTIONS');

    h2('Core Trading Functions');
    const funcs = [
      ['mt5Bridge', 'The central middleware bridging all MT5 operations. Handles user-specific credential retrieval, symbol normalization (strips broker suffixes while preserving them as metadata), lot-size field aliasing (lot_size / volume / lots), automated 3-attempt retry on 502/503/504 errors, and a privacy guard preventing cross-user data exposure.'],
      ['tradeDecisionEngine', 'The unified 8/9-pillar confluence gatekeeper. Evaluates market structure, trend alignment (EMA/VWAP), pullbacks, liquidity sweeps, ADX trend strength, RSI momentum, volatility, spread cost, and news safety. Produces a weighted 0-100 Trade Quality Score and a TRADE / NO_TRADE decision. Supports Conservative (85+), Balanced (75+), and Aggressive (70+) modes.'],
      ['autoRobotManager', 'Orchestrates automated robot sessions across users. Enforces risk management, session rules, scheduled activation, and multi-pair strategies. Processes Auto-Start and Danger/HFT modes with custom lot-sizing.'],
      ['executeAiTrade', 'Automated AI trade execution. Fetches AI signals and bridges them to MT5. Supports scheduled cron-based batch processing for multiple users and on-demand manual execution.'],
      ['hftExecutionEngine', 'High-Frequency Trading execution engine. Ignores all rules and scalps for any profit. Multiplies lot on every profitable close, capped by a hard max-lot ceiling.'],
      ['provisionMT5Account', 'Provisions a new MT5 bridge account with user credentials for secure terminal login.'],
      ['sessionManager', 'Detects and manages trading sessions (Asian, London, New York) with session-specific quality scoring and rollover handling.'],
    ];
    funcs.forEach(([name, desc]) => {
      h3(name);
      para(desc);
    });

    h2('Strategy & Selection Functions');
    const stratFuncs = [
      ['aiStrategySelector', 'AI engine that selects the optimal strategy from live market data when "Auto (AI Select)" is chosen. Returns a strategy name and human-readable reason.'],
      ['adaptiveStrategyManager', 'Continuously scores all 9 core strategies against live market data and auto-activates the best-fit strategy per market regime. Tracks suitability, win rates, and cooldowns.'],
      ['multiPairSelector', 'AI scans all available pairs and auto-selects the best N for concurrent trading when Multi-Pair Auto-Select is enabled.'],
      ['multiPairOrchestrator', 'Coordinates concurrent multi-pair trading sessions, balancing load and risk across selected instruments.'],
    ];
    stratFuncs.forEach(([name, desc]) => {
      h3(name);
      para(desc);
    });

    h2('Signal & Scanner Functions');
    const signalFuncs = [
      ['floubaSignalScanner', 'Continuously scans the market for Flouba signals (Liquidity Sweep, CHOCH, FVG) and generates trade candidates with full pillar breakdown.'],
      ['floubaSignalExecute', 'Executes a confirmed Flouba signal to MT5 — places the order, records the ticket, and updates signal status to EXECUTED.'],
      ['floubaSignalMonitor', 'Monitors active signals in real-time. Triggers virtual entry execution when price reaches the entry level, or cancels expired signals.'],
      ['lsr3rScanner', 'Dedicated LSR-3R (Liquidity Sweep, CHOCH, Retest, Re-entry) scanner module for M1/M5 charts with anchor-time detection.'],
      ['lsr3rWebhook', 'Receives MT5 webhook data for real-time instrument quotes and feeds them to the LSR-3R scanner.'],
    ];
    signalFuncs.forEach(([name, desc]) => {
      h3(name);
      para(desc);
    });

    h2('Risk, Target & Monitoring Functions');
    const riskFuncs = [
      ['dynamicDailyTargetEngine', 'The Dynamic Daily Target (DDT) system. Enforces a tiered daily profit target (Target 1, Target 2, Final) with progressive risk reduction. Halts trading when the hard loss stop or final target is reached. Computes the live tier and lock status.'],
      ['trailingTpMonitor', 'Trails the take profit ahead of price once profit exceeds the trigger threshold. Optionally tightens the trailing distance as profit grows to capture more of the trend.'],
      ['notifyTradeEvent', 'Logs trade events (opens, closes, signals) as in-app notifications for the dashboard activity feed.'],
      ['syncTradeHistory', 'Syncs closed-trade history from MT5 into the Trade entity for journaling and statistics.'],
      ['tradeWebhook', 'Receives external webhook trade signals and routes them through the decision engine.'],
    ];
    riskFuncs.forEach(([name, desc]) => {
      h3(name);
      para(desc);
    });

    h2('Admin & Utility Functions');
    const utilFuncs = [
      ['dailySummaryEmail', 'Sends a daily performance summary email to registered users. Uses strict per-user data isolation to prevent cross-user leakage.'],
      ['sendEaFile', 'Delivers the Expert Advisor (EA) file to the user\'s MT5 terminal for installation.'],
      ['generateSerialKeys', 'Admin function to generate serial key codes (Starter / Pro / Elite plans) for subscription redemption.'],
      ['redeemSerialKey', 'Redeems a serial key against the current user, activating a subscription for the granted duration.'],
    ];
    utilFuncs.forEach(([name, desc]) => {
      h3(name);
      para(desc);
    });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 3 — TRADE DECISION ENGINE
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('3. THE TRADE DECISION ENGINE');

    h2('9-Pillar Weighted Confluence System');
    para('The Trade Decision Engine is the gatekeeper of every trade. It evaluates nine independent pillars and aggregates them into a weighted Trade Quality Score from 0 to 100. A trade is only permitted when the score meets or exceeds the threshold defined by the active strategy mode.');

    h3('Pillar 1 — Market Structure (BOS / CHOCH)');
    para('Detects Break of Structure and Change of Character on the entry timeframe. Confirms whether the market has committed to a directional move by breaking a prior swing high or low.');

    h3('Pillar 2 — Trend Alignment (EMA / VWAP)');
    para('Validates that price is on the correct side of key EMAs (e.g., EMA 200 on the HTF) and aligned with VWAP where applicable. Trades against the dominant trend are heavily penalized.');

    h3('Pillar 3 — Pullback Quality (EMA 20)');
    para('Ensures the entry occurs at a quality retracement to EMA 20, not at an extended top or bottom. Deep pullbacks beyond EMA 50 can be blocked entirely.');

    h3('Pillar 4 — Liquidity Sweep');
    para('Detects whether a liquidity pool (prior session high/low) has been swept before the reversal — a hallmark of institutional order flow.');

    h3('Pillar 5 — ADX Trend Strength');
    para('Uses ADX to confirm that a genuine trend exists. Low ADX (choppy / range-bound) reduces the score and can block the trade entirely.');

    h3('Pillar 6 — RSI Momentum');
    para('Analyzes RSI to confirm momentum is in the trade direction and not in an extreme overbought/oversold state that would signal exhaustion.');

    h3('Pillar 7 — Volatility (ATR)');
    para('Checks that ATR is within a healthy band — not too low (dead market) and not too high (dangerous volatility).');

    h3('Pillar 8 — Spread Cost');
    para('Rejects trades when the live spread exceeds the configured maximum, protecting against slippage eating into the edge.');

    h3('Pillar 9 — News Safety (Mandatory)');
    para('A mandatory pillar. Blocks all trading within a configurable buffer window around high-impact news releases. If this pillar fails, no trade is taken regardless of the other scores.');

    h2('Strategy Modes');
    para('The minimum confluence score required for entry depends on the active mode:');
    bullet('Conservative — Score 85+ required. The most selective mode; only A+ setups are traded.');
    bullet('Balanced — Score 75+ required. The default; a balance between selectivity and opportunity.');
    bullet('Aggressive — Score 70+ required. More permissive; accepts B-grade setups for higher trade frequency.');

    h2('AI Trade Parameter Engine');
    para('When a TRADE decision is reached, the engine invokes an LLM to dynamically propose an ATR-adjusted stop loss and risk-reward ratio based on live market context. It then computes the final lot size strictly within user-defined risk-percentage constraints and hard guardrails, producing the complete trade ticket: entry, SL, TP, lot, and risk.');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 4 — TRADING STRATEGIES
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('4. TRADING STRATEGIES');
    para('Flouba Elite ships with 9 core strategies plus several specialized execution modes. The Adaptive AI engine scores all of them live and auto-activates the best fit. Below is every strategy with its key setup parameters.');

    h2('4.1 Swing Trend Pullback Continuation 2026');
    para('A trend-following strategy that enters on pullbacks to EMA within an established trend, using ATR for dynamic exits.');
    paramRow('Timeframe', 'M15 / M30 / H1');
    paramRow('EMA Fast / Slow', '20 / 50');
    paramRow('ATR Period', '14');
    paramRow('ATR SL Multiplier', '1.5');
    paramRow('Min Risk-Reward', '2');
    paramRow('Pullback Zone (ATR)', '0.25 — blocks deep pullbacks beyond EMA 50');
    paramRow('Break-Even', 'Yes, at 1R');
    paramRow('Partial Close', '50% at 1R');
    paramRow('Max Trades / Day', '3');
    paramRow('Max Consecutive Losses', '2 → cooldown 8h');

    h2('4.2 SMC Liquidity Sweep Scalping');
    para('Smart-Money-Concepts strategy that trades liquidity sweeps on M1/M5 after HTF confirmation. Detects sweep → CHOCH → FVG sequences.');
    paramRow('HTF Timeframe', 'M15 / H1 (EMA 200 trend filter)');
    paramRow('Entry Timeframe', 'M1 / M5');
    paramRow('RSI Overbought / Oversold', '80 / 20');
    paramRow('VWAP Filter', 'Enabled');
    paramRow('Session-Only', 'London / NY');
    paramRow('News Buffer', '10 minutes');

    h2('4.3 EMA Trend Progressive Recovery (TPR)');
    para('A trend-following recovery strategy using fast/slow EMA separation. Adds controlled recovery positions (capped multiplier) when price moves adversely, with a basket profit target that closes all positions together.');
    paramRow('EMA Fast / Slow', '6 / 25');
    paramRow('Recovery ATR Mult', '1.2 (adverse distance before recovery)');
    paramRow('Lot Multiplier', '1.0 (capped at max 1.25 — never Martingale)');
    paramRow('Max Open Positions', '2');
    paramRow('Max Recovery Positions', '1');
    paramRow('Basket Profit Target', '$10');
    paramRow('Emergency SL', '1.8 × ATR');
    paramRow('Equity Stop', '3% of balance');
    paramRow('Daily Loss Limit', '2% of balance');

    h2('4.4 Hybrid Confluence Mode');
    para('A multi-layer confluence strategy merging EMA trend, pullback zones, liquidity sweeps, and engulfing confirmation. Uses a weighted score (0-100) requiring a minimum to trade.');
    paramRow('Timeframe', 'M5 / M15 / M30 / H1');
    paramRow('EMAs', '6 / 20 / 25 / 50');
    paramRow('Pullback Zone', '0.25 ATR from EMA 20');
    paramRow('Max Pullback Depth', '0.5 ATR beyond EMA 50');
    paramRow('Swing Lookback', '20 bars');
    paramRow('Require Engulfing', 'Yes (bullish/bearish after sweep)');
    paramRow('Min Confluence Score', '80 / 100');
    paramRow('Score Weights', 'Trend 30, Pullback 20, Sweep 30, Engulfing 10, Filters 10');
    paramRow('SL ATR Range', '1.5 – 1.8 × ATR beyond sweep wick');

    h2('4.5 NQ London Kill Zone Breakout');
    para('Breakout strategy targeting the London Kill Zone range. One BUY + one SELL per day max, with strict body/wick quality filters.');
    paramRow('Max Trades / Day', '2 (one BUY + one SELL)');
    paramRow('Risk-Reward', '2');
    paramRow('Breakout Buffer', '2 points beyond Kill Zone high/low');
    paramRow('Min Body', '5 points');
    paramRow('Max Wick/Body Ratio', '0.6');
    paramRow('Min / Max Range', '20 / 400 points');
    paramRow('ATR Filter', 'Enabled (period 14)');

    h2('4.6 Market Structure BOS Retest Scalper');
    para('Trades Break-of-Structure followed by a retest of the broken level on the entry timeframe, confirmed by HTF structure.');
    paramRow('HTF Timeframe', 'H1 / H4 / D1');
    paramRow('Entry Timeframe', 'M5 / M15');
    paramRow('Confirm Timeframe', 'M15 / M30 / H1');
    paramRow('Swing Lookback', '20 bars');
    paramRow('Retest Buffer', '10 points');
    paramRow('Require Confirmation Candle', 'Yes');
    paramRow('Max Trades / Day', '3');

    h2('4.7 Orderflow Opening Range Breakout');
    para('Breakout of the opening range with order-flow / volume confirmation and optional retest requirement.');
    paramRow('Max Trades / Day', '2');
    paramRow('Risk-Reward', '2');
    paramRow('Require Retest', 'Yes (10-point buffer)');
    paramRow('Volume Expansion Mult', '1.5× recent average');
    paramRow('Min / Max Range', '20 / 400 points');
    paramRow('ATR Filter', 'Enabled');

    h2('4.8 Gold Morning Range Breakout (GMR)');
    para('Breakout of the morning range on Gold (XAUUSD) with volume and ATR confirmation, plus an optional news filter.');
    paramRow('Max Trades / Day', '2');
    paramRow('Risk-Reward', '2');
    paramRow('Volume Threshold Mult', '1.0× range average');
    paramRow('Require Retest', 'Yes (10-point buffer)');
    paramRow('News Filter', 'Enabled');
    paramRow('ATR Filter', 'Enabled');

    h2('4.9 Gold Daily Breakout (GDB)');
    para('Breakout of the previous day\'s high/low on Gold. One trade per day, with trailing stop and session-end cancellation of unfilled pending orders.');
    paramRow('Max Trades / Day', '1');
    paramRow('Risk-Reward', '2');
    paramRow('Breakout Buffer', '3 points beyond prev-day high/low');
    paramRow('Min / Max Range', '50 / 2000 points');
    paramRow('Break-Even', 'Yes, at 1R');
    paramRow('Trailing', 'Yes (activates at 1R, 1.5× ATR distance)');
    paramRow('Cancel at Session End', 'Yes');

    h2('4.10 Hedge Scalper');
    para('A multi-phase strategy that opens a primary scalp and hedges it if price moves adversely by a trigger distance, then scalps for small profits over the hedge.');
    paramRow('TP / SL (primary)', '30 / 15 pips');
    paramRow('Lot Size', '0.02');
    paramRow('Max Pairs', '3');
    paramRow('Hedge Mode', 'Same Pair / Cross Pair / Both');
    paramRow('Hedge Trigger', '15 pips adverse');
    paramRow('Scalp TP over Hedge', '5 pips');
    paramRow('Drawdown Reduction', 'Enabled (close ratio 1)');
    paramRow('Pair Priority', 'By recent win rate (20-trade lookback)');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 5 — SPECIALIZED EXECUTION MODES
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('5. SPECIALIZED EXECUTION MODES');

    h2('5.1 HFT Mode (High-Frequency Trading)');
    para('When enabled, HFT mode ignores ALL rules and scalps for any profit. It multiplies the lot on every profitable close, escalating aggressively, but capped by a hard max-lot ceiling to prevent runaway risk. Resets to base lot on any loss.');
    paramRow('Lot Multiplier (per win)', '1.5');
    paramRow('Min Profit to Close', '3 points');
    paramRow('Hard Max Lot', '0.5 (never exceeded)');
    paramRow('Reset on Loss', 'Yes → back to base lot');
    para('NOTE: In Danger Mode, toggling HFT triggers live robot execution immediately with no further user intervention.', { color: colors.red });

    h2('5.2 Multi-Trade Recovery Engine');
    para('When equity drops below balance, the recovery engine opens larger confirmed-direction positions to pull equity back up — preventing account blowup. It requires trend confirmation before each recovery position and never uses Martingale escalation beyond the configured multiplier.');
    paramRow('Lot Multiplier', '2 (e.g., double the base lot)');
    paramRow('Max Recovery Positions', '2 beyond max concurrent');
    paramRow('Drawdown Trigger', '1% (equity this far below balance)');
    paramRow('Require Confirmation', 'Yes (trend signal before each recovery trade)');

    h2('5.3 Multi-Level Pyramiding');
    para('Scales into the trend by adding positions every pyramiding_step_usd of favorable price movement, up to a max number of layers. Requires HTF trend confirmation to remain valid before each scale-in.');
    paramRow('Step', '$2.00 favorable movement');
    paramRow('Max Layers', '5 (including initial)');
    paramRow('Lot per Layer', '0.01');
    paramRow('HTF Trend Confirm', 'Yes (H1, EMA 200)');

    h2('5.4 Trailing TP Monitor');
    para('Trails the take profit ahead of price once profit exceeds a trigger threshold. Optionally tightens the trailing distance progressively as profit grows, capturing more of the trend.');
    paramRow('Trigger', '$2.00 profit before trailing begins');
    paramRow('Trailing Distance', '$1.50 ahead of price');
    paramRow('Tightening', 'Enabled — min distance $0.30 at peak');

    h2('5.5 Win Compounding');
    para('Every confirmed winning trade multiplies the lot size for the next trade to grow the account. Resets to base lot on any loss. Hard-capped at a max lot to prevent runaway risk.');
    paramRow('Multiplier (per win)', '1.5');
    paramRow('Base / Reset Lot', '0.01');
    paramRow('Hard Max Lot', '0.5');
    paramRow('Reset on Loss', 'Yes');

    h2('5.6 Auto-Lot Multiplier');
    para('When enabled, automatically multiplies the lot when equity exceeds a configured ratio above balance (e.g., 2×), compounding gains as the account grows. Capped and gated by equity ratio.');
    paramRow('Lot Multiplier', '2');
    paramRow('Min Equity Ratio', '2 (equity must be 2× balance to activate)');
    paramRow('Auto-Enable', 'Off by default');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 6 — DYNAMIC DAILY TARGET
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('6. DYNAMIC DAILY TARGET (DDT) SYSTEM');

    para('The DDT system enforces a tiered daily profit target with progressive risk reduction. It locks trading when the hard loss stop or final target is reached, and computes the live tier every cycle.');

    h2('Tiers');
    h3('Pre-Target');
    para('Normal trading. Full risk allowed. Strategy score threshold per active mode.');
    h3('Tier 1');
    para('After reaching Target 1 ($75 default), risk is reduced by 50% and only A+ setups are taken. The lot size is halved automatically.');
    h3('Tier 2');
    para('After reaching Target 2 ($120 default), trading only continues if the strategy score ≥ 85, spread is normal, and market conditions are strong.');
    h3('Final Reached');
    para('After reaching the Final target ($200 default), all new entries stop immediately for the rest of the NY trading day.');
    h3('Loss Stopped');
    para('If realized loss reaches the hard loss stop ($60 default), all trading stops for the day with a lock message.');

    h2('Key Parameters');
    paramRow('Target 1', '$75 (risk -50%)');
    paramRow('Target 2', '$120 (score ≥ 85 only)');
    paramRow('Final Target', '$200 (stop all new entries)');
    paramRow('Hard Loss Stop', '$60 (stop all trading)');
    paramRow('Max Trades / Day', '3');
    paramRow('Max Open Positions', '1');
    paramRow('Stop After Losses', '2 consecutive → halt');
    paramRow('Risk Reduction', '50% lot reduction at Tier 1');
    paramRow('Min Score (Tier 2)', '85 / 100');
    paramRow('Reset', 'Daily at NY trading day rollover');

    h2('Session Cooldown');
    para('After hitting the session profit target, the bot waits a configurable cooldown (default 60 minutes) before resuming trading in the next session. The effective target can be Fixed or Auto (dynamically set from market regime, volatility, and balance).');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 7 — SIGNAL ASSISTANT
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('7. FLOUBA SIGNAL ASSISTANT');

    para('The Signal Assistant governs how AI-generated signals are displayed and executed. It operates in three modes, from passive observation to full automation.');

    h2('Execution Modes');
    h3('Signal Only (Default)');
    para('Signals are displayed only — no trades are opened automatically. The user sees the full breakdown and can manually execute if desired. This is the safest default.');
    h3('Semi-Auto');
    para('Signals are displayed and the user confirms before execution. The bot prepares the order but waits for explicit approval.');
    h3('Full Auto');
    para('Signals are auto-executed at the entry trigger. The bot monitors live price and places the trade when the entry level is reached.');

    h2('Entry Trigger Modes');
    h3('Virtual Trigger (Default)');
    para('Monitors live price (ask/bid) in real-time and executes the market order when price reaches the configured entry level.');
    h3('Broker Pending Order');
    para('Places a real MT5 pending order (Buy Stop / Buy Limit / Sell Stop / Sell Limit) immediately at the entry level.');

    h2('Signal Lifecycle');
    para('Every signal progresses through a clear status: WAITING_FOR_ENTRY → CONFIRMED → EXECUTED, or EXPIRED / CANCELLED. The expiration window is configurable (default 30 minutes). Expired signals are auto-cancelled.');

    h2('Key Parameters');
    paramRow('Min Confidence Score', '70 / 100');
    paramRow('Signal Expiration', '30 minutes');
    paramRow('Magic Number', '20260001');
    paramRow('Trade Comment', '"Flouba Gold HFT"');
    paramRow('Show on Chart', 'Entry/SL/TP lines + direction arrows + expiration timer');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 8 — AI AUTO-EXECUTE & ADAPTIVE
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('8. AI AUTO-EXECUTE & ADAPTIVE STRATEGY ENGINE');

    h2('AI Auto-Execute');
    para('When enabled, the robot automatically places a trade whenever the AI Trade Decision Engine produces a TRADE signal across all strategies. It runs on a scheduled check and enforces a minimum confluence score.');
    paramRow('Enabled', 'Off by default');
    paramRow('Min Score', '70 / 100');
    para('This is the highest level of automation. Combined with Full Auto Signal Assistant mode, the entire scan → decide → execute pipeline runs without user input.');

    h2('Adaptive AI Strategy Engine');
    para('When enabled, the bot continuously scores all 9 core strategies against live market data and auto-activates the best-fit strategy per market regime. It tracks each strategy\'s suitability, win rate, profit factor, and max drawdown, and switches only when a candidate strategy outperforms the active one by a configurable threshold over a confirmation window.');
    paramRow('Enabled', 'On by default');
    paramRow('Min Score', '70');
    paramRow('Switch Threshold', '15 points above active strategy');
    paramRow('Confirmation Bars', '3 bars of sustained outperformance');
    paramRow('ADX Threshold', '25 (trend vs range)');
    paramRow('Eval Window', 'Last 5 trades');
    paramRow('Global Cooldown', 'After a switch, a cooldown prevents rapid oscillation');

    para('Every strategy switch is logged to the StrategySwitchLog entity with the from/to strategy, scores, regime, and reason — providing a full audit trail of the AI\'s decisions.');

    h2('Multi-Pair Auto-Select');
    para('When enabled, the AI scans all available pairs and auto-selects the best N (default 3) for concurrent trading, based on spread, volatility, and trend quality.');
    paramRow('Pairs to Select', '3');
    paramRow('Selection Criteria', 'Lowest spread + healthy ATR + clear trend');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 9 — RISK MANAGEMENT
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('9. RISK MANAGEMENT & CAPITAL PROTECTION');

    h2('Core Risk Parameters');
    paramRow('Lot Size Mode', 'Fixed or Auto Risk (risk % of balance)');
    paramRow('Default Lot', '0.03 (user-configurable, single source of truth)');
    paramRow('Risk Percentage', '1-2% per trade (Auto Risk mode)');
    paramRow('Max Concurrent Trades', '2 (Balanced default)');
    paramRow('Stop Loss', '20-50 pips (or ATR dynamic)');
    paramRow('Dynamic SL', 'ATR × multiplier when enabled');
    paramRow('Take Profit', '40-100 pips');
    paramRow('Break-Even', 'Yes, at 1R (default on)');

    h2('Daily Limits');
    paramRow('Max Daily Trades', 'Unlimited (cap removed by design)');
    paramRow('Stop After Losses', '2 consecutive → cooldown');
    paramRow('Daily Profit Target', '$200 (Fixed or Auto)');
    paramRow('Daily Loss Limit', '$20-$50');
    paramRow('Stop at Daily Target', 'Yes (default on)');

    h2('Equity Guard (Always On)');
    para('A permanent safety net. If equity drops below a configurable percentage of balance, all trading halts immediately to protect the account from further drawdown.');
    paramRow('Min Equity %', '75% of balance (default)');

    h2('Trend Filter');
    para('Optional HTF trend filter that blocks trades against the dominant trend on M15 or H1 using EMA 200.');
    paramRow('Timeframe', 'M15 (default)');
    paramRow('EMA Period', '200');

    h2('Session Filters');
    para('Trading can be restricted to specific sessions: London, New York, and Asian. By default, London and NY are enabled and Asian is disabled, focusing activity on the highest-liquidity windows.');
    paramRow('London Session', 'Enabled');
    paramRow('New York Session', 'Enabled');
    paramRow('Asian Session', 'Disabled');

    h2('Spread & Volatility Filters');
    bullet('Spread Filter — rejects trades when live spread exceeds the max (default 30 points).');
    bullet('Volatility Filter — ATR must be within a healthy band; too-low (dead market) or too-high (dangerous) blocks trading.');

    h2('Bot Mentality');
    para('Two execution mentalities:');
    bullet('Basic — patient, selective, defensive. Fewer trades, tighter risk.');
    bullet('Premium — aggressive execution with controlled risk. More trades, higher frequency, but still within risk guardrails.');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 10 — LSR-3R SCANNER
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('10. LSR-3R SCANNER MODULE');

    para('A dedicated Liquidity Sweep → CHOCH → Retest → Re-entry scanner operating on M1/M5 charts. It anchors to specific session times and detects the full SMC sequence with precision risk control at 1:3 risk-reward.');

    h2('Detection Sequence');
    h3('1. Anchor');
    para('Establishes a reference high/low at configured anchor times (default 14:00 and 20:00 GMT+8).');
    h3('2. Liquidity Sweep');
    para('Detects when price sweeps the anchor high/low (wicks beyond it) to grab liquidity, using an ATR-based buffer to filter noise.');
    h3('3. CHOCH (Change of Character)');
    para('Confirms a reversal when price breaks the opposing swing — the first sign of a directional shift.');
    h3('4. FVG (Fair Value Gap)');
    para('Detects an imbalance / fair value gap left during the move, which becomes the entry zone.');
    h3('5. Entry Signal');
    para('When price retraces into the FVG, the entry signal is ready with calculated entry, SL (beyond the sweep wick), and TP at 1:3 RR.');

    h2('Key Parameters');
    paramRow('Symbols', 'EURUSD, GBPUSD, XAUUSD');
    paramRow('Risk per Trade', '0.5% of balance');
    paramRow('Max Daily Loss', '1% of balance');
    paramRow('Max Trades / Day', '2');
    paramRow('Max Consecutive Losses', '2');
    paramRow('Risk-Reward', '3');
    paramRow('Setup Expiry', '75 minutes');
    paramRow('FVG Entry Expiry', '20 minutes');
    paramRow('One Trade per Anchor', 'Yes (default)');
    paramRow('Spread Filter', 'Max 12% of SL distance');
    paramRow('News Filter', 'Enabled');
    paramRow('Safe Mode', 'Enabled (conservative defaults)');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 11 — CONNECTIVITY & AUTO-RECONNECT
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('11. MT5 CONNECTIVITY & AUTO-RECONNECT');

    h2('Connection Model');
    para('All MT5 operations pass through the mt5Bridge backend function, keeping the MT5 API token server-side. User credentials are stored per-user and injected at request time. The bridge normalizes symbols (strips broker suffixes like "m" while preserving them as broker_symbol metadata) and aliases the lot size across lot_size / volume / lots for EA compatibility.');

    h2('Auto-Reconnect');
    para('The dashboard polls the MT5 account every 8 seconds. If two consecutive heartbeats fail (~16 seconds), the system automatically attempts to restore the link:');
    bullet('Calls mt5Api.connect() to re-establish the terminal login.');
    bullet('Verifies the link with a fresh account read (balance must be present).');
    bullet('On success: restores live data, resets the failure counter, and shows a "Connection Restored" toast.');
    bullet('On failure: keeps the counter climbing — the next poll cycle retries automatically.');
    bullet('Triggers on both account-read failures and network-level errors.');
    bullet('A visible amber "RECONNECTING MT5…" banner and matching status panel state inform the user during the process.');

    h2('Bridge Reliability');
    bullet('Automated 3-attempt retry on transient 502 / 503 / 504 HTTP errors.');
    bullet('Privacy guard verifies returned account data matches the authenticated user to prevent cross-user leakage.');
    bullet('Account snapshots (balance, equity, margin) are persisted to BotSettings for consistent dashboard reporting.');

    // ═══════════════════════════════════════════════════════════════
    // SECTION 12 — SUBSCRIPTION & ACCESS
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('12. SUBSCRIPTION & ACCESS CONTROL');

    h2('Serial Key System');
    para('Access is granted via serial keys generated by admins. Each key carries a plan and duration:');
    paramRow('Plans', 'Starter, Pro, Elite');
    paramRow('Default Duration', '30 days');
    paramRow('Statuses', 'Available, Used, Expired, Revoked');
    para('Users redeem a key on the /redeem page, which activates a subscription for the granted duration. Only admins can generate keys.');

    h2('Account Management');
    para('Users manage multiple MT5 accounts via the TradingAccount entity (account number, broker, server, password, nickname). An account switcher allows toggling between live and prop-challenge accounts. The MT5Account entity (admin-only) holds shared bridge-level account records.');

    // ═══════════════════════════════════════════════════════════════
    // CLOSING
    // ═══════════════════════════════════════════════════════════════
    newPage();
    fillPageBg();
    h1('SUMMARY');
    para('Flouba Elite is a complete AI-driven trading system engineered around capital protection and high-confluence execution. Its 9-pillar Trade Decision Engine, 9 adaptive strategies, tiered Dynamic Daily Target, and specialized recovery/compounding modes give it the discipline to trade less but better — while the Adaptive AI engine ensures the right strategy is always active for the current market regime.');
    y += 10;
    para('Every function, every setup, and every guardrail documented here is designed to serve one goal: consistent, protected, professional execution. The robot will refuse to trade when conditions are poor, will never chase losses, and will always prioritize the safety of your capital.', { color: colors.green, size: 11 });
    y += 20;
    doc.setDrawColor(colors.green[0], colors.green[1], colors.green[2]);
    doc.setLineWidth(1);
    doc.line(margin, y, pageW - margin, y);
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
    doc.text('FLOUBA ELITE — Trade Less, But Better.', margin, y);

    // Apply footer to every page (bg already filled when each page was created)
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      headerFooter();
    }

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="FloubaElite-System-Documentation.pdf"',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});