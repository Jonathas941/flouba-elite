import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import StrategyFilterToggles from "@/components/StrategyFilterToggles";
import SwingPullbackLiveCard from "@/components/strategy/SwingPullbackLiveCard";
import EmaTrendRecoveryLiveCard from "@/components/strategy/EmaTrendRecoveryLiveCard";
import HybridConfluenceLiveCard from "@/components/strategy/HybridConfluenceLiveCard";
import NqKillZoneLiveCard from "@/components/strategy/NqKillZoneLiveCard";
import MsBosRetestLiveCard from "@/components/strategy/MsBosRetestLiveCard";
import OrderflowOpeningRangeLiveCard from "@/components/strategy/OrderflowOpeningRangeLiveCard";
import GoldMorningRangeLiveCard from "@/components/strategy/GoldMorningRangeLiveCard";
import {
  Activity, Brain, Layers, Boxes, Zap, GitBranch,
  TrendingUp, Gauge, CandlestickChart, ChevronDown, ChevronUp, CheckCircle, ScanLine, Crosshair, Waves, BarChart3
} from "lucide-react";

const STRATEGY = [
  {
    icon: Activity,
    title: "Price Action",
    tag: "Core Foundation",
    tagColor: "bg-red-500/15 text-red-400",
    summary: "Pure price movement analysis without lagging indicators. Every decision is based on raw candle behavior, structure, and key level reactions.",
    details: [
      "Read market context directly from candlestick charts",
      "Identify clean, high-probability entry zones from price reactions",
      "No lagging indicators — only raw price truth",
      "Combined with volume analysis for confirmation",
    ],
  },
  {
    icon: Brain,
    title: "Smart Money Concept (SMC)",
    tag: "Institutional Logic",
    tagColor: "bg-purple-500/15 text-purple-400",
    summary: "Follow the footprints of banks and institutions. The robot tracks where smart money enters and exits, exploiting retail liquidity grabs.",
    details: [
      "Identifies institutional order flow and market maker manipulation",
      "Detects liquidity pools above swing highs and below swing lows",
      "Tracks displacement candles (impulse moves) marking institutional entries",
      "Avoids counter-institutional trades by reading smart money intent",
    ],
  },
  {
    icon: Layers,
    title: "Market Structure",
    tag: "Trend Engine",
    tagColor: "bg-sky-500/15 text-sky-400",
    summary: "Defines the overall trend using Higher Highs (HH), Higher Lows (HL) for bullish and Lower Highs (LH), Lower Lows (LL) for bearish. Break of Structure (BOS) and Change of Character (ChoCH) signal reversals.",
    details: [
      "Bullish: HH → HL sequence, trade only Buy setups",
      "Bearish: LH → LL sequence, trade only Sell setups",
      "Break of Structure (BOS): trend continuation confirmation",
      "Change of Character (ChoCH): early reversal warning, shift bias",
      "Only trade in the direction of higher-timeframe structure",
    ],
  },
  {
    icon: Boxes,
    title: "Supply & Demand Zones",
    tag: "Key Zones",
    tagColor: "bg-amber-500/15 text-amber-400",
    summary: "Mapping powerful price origin zones where institutional orders were placed. Price returns to these zones to fill remaining orders, creating high-probability reversal or continuation opportunities.",
    details: [
      "Demand zone: area where price exploded upward (strong buy pressure left)",
      "Supply zone: area where price collapsed sharply (strong sell pressure left)",
      "Fresh zones (untouched) carry more weight than tested ones",
      "Higher timeframe zones override lower timeframe entries",
      "Zone strength rated by the speed and size of the departure candle",
    ],
  },
  {
    icon: Boxes,
    title: "Order Blocks",
    tag: "SMC Entry Zone",
    tagColor: "bg-orange-500/15 text-orange-400",
    summary: "The last bearish candle before a bullish impulse (Bullish OB) or the last bullish candle before a bearish impulse (Bearish OB). These are the exact candles where institutions placed their orders.",
    details: [
      "Bullish OB: last red candle before a strong upward move",
      "Bearish OB: last green candle before a strong downward move",
      "Entry is placed at 50% of the OB candle body (mitigation level)",
      "SL placed below/above the OB wick for maximum safety",
      "OB + FVG (Fair Value Gap) confluence increases win probability significantly",
    ],
  },
  {
    icon: Zap,
    title: "Liquidity Sweep",
    tag: "Manipulation Detection",
    tagColor: "bg-red-500/15 text-red-400",
    summary: "Smart money deliberately pushes price beyond swing highs/lows to trigger retail stop losses and collect the resulting liquidity before reversing.",
    details: [
      "Equal highs / equal lows are prime liquidity targets (retail SL clusters)",
      "After a sweep, watch for immediate reversal (rejection wick)",
      "Sweep + Order Block + ChoCH = highest-confidence setup",
      "Avoid entries before a sweep — wait for the manipulation to complete",
      "Tighter SL after sweep since the manipulation low/high is clearly defined",
    ],
  },
  {
    icon: GitBranch,
    title: "Fibonacci 50% & 61.8%",
    tag: "Precision Filter",
    tagColor: "bg-green-500/15 text-green-400",
    summary: "After identifying an impulsive move, Fibonacci retracement levels 50% and 61.8% define the optimal trade entry zone (OTE). Confluence with OB or S&D at these levels triggers entry.",
    details: [
      "Draw Fibonacci from the swing low to swing high (or reverse for sells)",
      "50% level: first valid entry zone (strong momentum confirmation)",
      "61.8% golden ratio: highest probability entry, often aligns with OB",
      "78.6% used as final entry only if 61.8% fails with strong confluence",
      "Do NOT enter above 78.6% — trade invalidated if swept",
    ],
  },
  {
    icon: TrendingUp,
    title: "Trendline Confirmation",
    tag: "Dynamic Support",
    tagColor: "bg-sky-500/15 text-sky-400",
    summary: "Valid trendlines require a minimum of two touch points. The robot confirms the trend direction and uses trendline breaks as breakout signals or bounces as continuation entries.",
    details: [
      "Minimum 2 touch points required to form a valid trendline",
      "3+ touches = higher reliability trendline",
      "Trendline bounce + OB = confluence buy/sell entry",
      "Trendline break with strong candle close = potential ChoCH signal",
      "False breaks (fakeouts) detected by waiting for candle close confirmation",
    ],
  },
  {
    icon: Gauge,
    title: "Psychological Levels",
    tag: "Magnet Zones",
    tagColor: "bg-purple-500/15 text-purple-400",
    summary: "Round numbers act as psychological magnets where large clusters of pending orders accumulate. These levels attract price and often cause sharp reactions.",
    details: [
      "Major: X.0000 (e.g. 1.10000, 3400, 44000) — strongest reactions",
      "Semi-major: X.X500 (e.g. 1.10500, 3350) — secondary magnets",
      "Price tends to sweep these levels before reversing (SL hunt)",
      "Used as TP targets — book profits slightly before round numbers",
      "OB or S&D zone aligning with psych level = premium entry",
    ],
  },
  {
    icon: TrendingUp,
    title: "Swing Trend Pullback Continuation 2026",
    tag: "Live Entry Strategy",
    tagColor: "bg-emerald-500/15 text-emerald-400",
    summary: "Conservative swing-trading engine: confirms EMA 20/50 trend alignment, waits for a pullback into the EMA 20 zone, and enters only after a closed-candle engulfing confirmation. ATR-based stop loss with a minimum 1:2 reward-to-risk.",
    details: [
      "BUY: EMA 20 above EMA 50, both sloping up, price pulls back to EMA 20, bullish engulfing candle closes above its open.",
      "SELL: EMA 20 below EMA 50, both sloping down, price pulls back to EMA 20, bearish engulfing candle closes below its open.",
      "Stop Loss = ATR(14) × 1.5 beyond entry (+ optional buffer); Take Profit = risk distance × RR (default 2.0).",
      "Break-even at 1R, optional 50% partial close at 1R, remainder runs to 2R; optional ATR trailing stop.",
      "No grid, no martingale, no averaging down, no recovery trades — closed candles only for confirmation.",
      "Risk locks: 2% daily loss, 3% daily drawdown, 3 trades/day, and an 8-hour cooldown after 2 consecutive losses.",
      "Sessions (ET): Asian 19:15–03:45, London/NY overlap 08:00–12:00; blocks 16:55–17:15 rollover and Friday 16:55 → Sunday 17:10.",
    ],
  },
  {
    icon: Gauge,
    title: "EMA Trend Progressive Recovery",
    tag: "Trend + Capped Recovery",
    tagColor: "bg-amber-500/15 text-amber-400",
    summary: "Controlled trend-following recovery. One initial entry on EMA 6/25 alignment + pullback confirmation, then a single capped recovery position only while the EMA trend stays valid. ATR emergency SL, basket TP, equity stop. No unlimited grid, no martingale.",
    details: [
      "Trend: EMA 6 > EMA 25 (bullish) or EMA 6 < EMA 25 (bearish), both sloping, EMA distance above minimum, price near the fast EMA zone.",
      "Initial BUY/SELL: EMA alignment + rising/falling slopes + pullback to fast EMA + confirmation candle + spread/session/risk checks. Default 0.01 lot.",
      "Recovery (max 1 by default): only when the original trade still aligns with the EMA trend, price has moved against by ≥ 1.2×ATR, spread normal, no cooldown, below all drawdown/equity stops, and max recovery count not reached. Recovery lot never exceeds 1.25×.",
      "Never add recovery when EMA fast crosses against slow, in a weak/flat/high-spread market, after Friday 16:55 ET, or during rollover.",
      "Basket exit: weighted-average entry, basket take-profit closes all positions together at the configured target; hard emergency basket stop on equity-stop breach.",
      "Protection: emergency SL = 1.8×ATR, equity stop 3%, daily loss 2%, daily profit target, 3 trades/day, 2 consecutive losses → 8h cooldown, break-even at 1R, optional 50% partial close, min 1:2 RR when single position.",
      "Hard trend reversal exit: EMA cross against, slope reversal, close beyond slow EMA by ATR distance, or equity/daily-loss limit → close all and disable recovery.",
      "Adaptive selection: only when regime is Trending, EMA alignment + slope strong, ATR healthy, spread acceptable, score ≥ 70. Never in a ranging market.",
    ],
  },
  {
    icon: GitBranch,
    title: "Market Structure BOS Retest Scalper",
    tag: "Price-Action BOS",
    tagColor: "bg-violet-500/15 text-violet-300",
    summary: "Pure price-action scalper: H1 market structure → M5 Break of Structure → retest the broken level → confirmation candle → entry. Fixed 1:2 RR with stop off the confirmation candle. No indicators, no grid, no martingale, no recovery.",
    details: [
      "MARKETS: XAUUSD, NQ / NAS100, US30, forex majors, crypto (broker permitting). HTF H1, entry M5, optional confirm M15.",
      "H1 STRUCTURE: Bullish = higher highs + higher lows; Bearish = lower highs + lower lows; Range = mixed (no trade until a clear BOS).",
      "SELL: H1 bearish/reversal → M5 closes below a confirmed swing low/higher low → wait for retest → bearish confirmation (engulfing, long upper wick, or bearish close) → SELL. SL above confirmation candle high + buffer, TP 2× risk. No repeat SELL from the same broken level.",
      "BUY: H1 bullish/reversal → M5 closes above a confirmed swing high/lower high → wait for retest → bullish confirmation (engulfing, long lower wick, or bullish close) → BUY. SL below confirmation candle low + buffer, TP 2× risk. No repeat BUY from the same broken level.",
      "BOS RULES: a closed M5 candle must close beyond the marked swing high/low — wick-only breakouts do not count.",
      "RETEST RULES: price revisits or comes within a configurable distance of the broken level; old resistance becomes new support (and vice versa).",
      "CONFIRMATION: bullish — bullish engulfing, long lower-wick rejection, or strong bullish close from retest. Bearish — bearish engulfing, long upper-wick rejection, or strong bearish close. Entry only after the confirmation candle closes.",
      "RISK: lot 0.01, max 1 open trade, max 3/day, fixed 1:2 RR, SL beyond confirmation candle + buffer, TP exactly 2R, optional break-even at 1R, optional 50% partial at 1R.",
      "PROTECTION: 2% daily loss, 3% daily drawdown, stop after 2 consecutive losses for 8 hours, reject high spread, reject outside enabled sessions.",
      "SESSIONS (ET): Asian 19:15–03:45, London/NY overlap 08:00–12:00. Blocks 16:55–17:15 rollover and Friday 16:55 → Sunday 17:10. No trades after daily profit target.",
    ],
  },
  {
    icon: Crosshair,
    title: "NQ London Kill Zone Breakout",
    tag: "Time-Window Breakout",
    tagColor: "bg-indigo-500/15 text-indigo-300",
    summary: "London Kill Zone range breakout on NQ / NAS100. Builds the 03:00–09:30 ET high-low range, then trades only closed-candle breakouts between 09:30 and 11:00 ET. Stop loss off the breakout candle, fixed 1:2 RR, one BUY + one SELL max per day. No grid, no martingale, no recovery.",
    details: [
      "MARKET: NQ / NAS100 / US100 (broker symbol mapped). Default timeframe M5. All times America/New_York (DST auto-handled).",
      "KILL ZONE RANGE: built from 03:00 AM to 09:30 AM ET. KillZoneHigh = highest high; KillZoneLow = lowest low. No trades before 09:30.",
      "ENTRY WINDOW: 09:30 AM to 11:00 AM ET only. At 11:00 AM hard cutoff — no new trades; existing trades run to SL/TP/managed exit.",
      "BUY: a fully closed M5 candle closes above KillZoneHigh (not just a wick). Enter BUY. SL just below the breakout candle LOW + buffer. TP = 2× risk.",
      "SELL: a fully closed M5 candle closes below KillZoneLow. Enter SELL. SL just above the breakout candle HIGH + buffer. TP = 2× risk.",
      "One trade per direction per day (max 2 total: 1 BUY + 1 SELL). No re-entry from the same breakout level.",
      "RISK: fixed 1:2 RR, reject if SL distance too small/large, reject if spread > max, reject on daily loss/drawdown/cooldown/target reached. Never widen SL.",
      "FALSE BREAKOUT PROTECTION: min candle body (points), close buffer beyond the zone, reject excessive wick-to-body ratio, range size bounds, optional ATR 14 filter.",
      "SESSION RESET: Kill Zone levels and daily trade flags reset at the next 03:00 AM ET. Never trades weekends or when the market is closed.",
    ],
  },
  {
    icon: Waves,
    title: "Orderflow Opening Range Breakout",
    tag: "Order-Flow Breakout",
    tagColor: "bg-fuchsia-500/15 text-fuchsia-300",
    summary: "Opening Range breakout on NQ / NAS100. Builds the 09:30–10:00 ET opening range, then trades only closed-candle breakouts (10:00–11:00 ET) confirmed by order-flow / volume participation. Prefers a retest of the broken level. Fixed 1:2 RR, max 1 open, 2 trades/day. No grid, no martingale, no recovery.",
    details: [
      "MARKET: NQ / NAS100 / US100 (broker symbol mapped). Default timeframe M5. All times America/New_York (DST auto-handled).",
      "OPENING RANGE: built from 09:30 AM to 10:00 AM ET. OpeningRangeHigh / Low / Midpoint recorded. No trades while the range is building.",
      "ENTRY WINDOW: 10:00 AM to 11:00 AM ET only. At 11:00 AM hard cutoff — no new trades; existing trades run to SL/TP/managed exit.",
      "BUY: a fully closed M5 candle closes above OpeningRangeHigh (not just a wick). Order-flow confirmed (positive delta / buyer imbalance, aggressive buy volume, or volume expansion vs average).",
      "SELL: a fully closed M5 candle closes below OpeningRangeLow. Order-flow confirmed (negative delta / seller imbalance, aggressive sell volume, or volume expansion vs average).",
      "RETEST (preferred): price pulls back to the broken level and holds beyond it; entry after a bullish/bearish confirmation candle from the retest.",
      "RISK: SL below retest candle low or below OpeningRangeHigh (BUY) / above retest candle high or above OpeningRangeLow (SELL) — whichever is safer. TP = previous session high/low, next volume node, or minimum 1:2 RR. Fixed 1:2 default.",
      "ORDER-FLOW FILTER: validate only when delta imbalance in breakout direction, large aggressive market orders, volume expansion vs average, or price accepts outside the range instead of immediately returning inside.",
      "FALSE BREAKOUT REJECT: wick-only close back inside, delta opposite direction, weak breakout volume, immediate re-entry into the range, high spread, or abnormally small/large opening range.",
      "PROTECTION: lot 0.01, max 1 open trade, max 2/day, stop after 2 consecutive losses (8h cooldown), 2% daily loss, 3% equity stop, daily profit target enforced. No grid, no martingale, no averaging down. No new entries after 11:00 AM ET.",
      "MENTALITY: the bot waits for acceptance, not just breakout. Price outside the range alone is not enough — volume and order flow must confirm one side is in control. No clean confirmation = no trade.",
    ],
  },
  {
    icon: BarChart3,
    title: "Gold Morning Range Breakout",
    tag: "XAUUSD Morning Breakout",
    tagColor: "bg-amber-400/15 text-amber-300",
    summary: "XAUUSD morning range breakout. Builds the 08:00–09:30 ET Gold Morning Range, then trades only closed M5 breakouts (09:30–11:00 ET) confirmed by tick volume + ATR. Retest preferred, fixed 1:2 RR, max 1 open, 2 trades/day. No grid, no martingale, no recovery.",
    details: [
      "MARKET: XAUUSD (Gold). Default timeframe M5. All times America/New_York (DST auto-handled).",
      "MORNING RANGE: built from 08:00 AM to 09:30 AM ET. MorningRangeHigh / Low / Midpoint recorded, plus average tick volume during the range. No trades while the range is building.",
      "ENTRY WINDOW: 09:30 AM to 11:00 AM ET only. At 11:00 AM hard cutoff — no new trades; existing trades run to SL/TP/managed exit.",
      "BUY: a fully closed M5 candle closes above MorningRangeHigh (not a wick). Breakout candle body above configured minimum, tick volume above average threshold, ATR 14 healthy. Prefer a retest of MorningRangeHigh as support, then a bullish confirmation candle.",
      "SELL: a fully closed M5 candle closes below MorningRangeLow. Same body / tick volume / ATR confirmation. Prefer a retest of MorningRangeLow as resistance, then a bearish confirmation candle.",
      "RISK: SL below retest/trigger candle low + buffer (BUY) / above retest/trigger candle high + buffer (SELL). TP fixed at 2R. Max 1 open trade, max 2 trades/day.",
      "FILTERS: spread filter required, reject abnormally small or oversized morning ranges, reject high-impact news when news data is available, optional break-even at 1R.",
      "PROTECTION: 2% daily loss, 3% equity stop, daily profit target enforced, stop after 2 consecutive losses (8h cooldown). No grid, no martingale, no recovery positions. No new entries after daily target or daily loss limit.",
      "MENTALITY: waits for a clean breakout with real participation — volume and volatility must confirm one side is in control. No confirmation = no trade.",
    ],
  },
  {
    icon: ScanLine,
    title: "Hybrid Confluence Mode",
    tag: "Multi-Strategy Merge",
    tagColor: "bg-cyan-500/15 text-cyan-300",
    summary: "Merges EMA Trend (direction) + Swing Pullback (setup) + SMC Liquidity Sweep (confirmation) into a single high-quality entry. Strategies act as confirmation layers — never separate trades. One controlled recovery only, max 2 positions, no martingale.",
    details: [
      "TREND LAYER (30 pts): EMA 6 above EMA 25 AND EMA 20 above EMA 50, all sloping upward (buy) or downward (sell), EMA distance above minimum, ATR above volatility floor.",
      "PULLBACK LAYER (20 pts): price retraces toward the EMA 20 zone (within configurable ATR distance), and does not close deeply beyond EMA 50.",
      "SMC CONFIRMATION LAYER (30 pts): price sweeps a confirmed swing low (buy) or swing high (sell), the closed candle returns back through it, and a bullish/bearish engulfing candle forms immediately after. Entry only after candle close.",
      "ENGULFING CONFIRMATION (10 pts): directional engulfing matches the trend and sweep bias.",
      "FILTERS (10 pts): spread below max, session open, no cooldown, daily loss & drawdown limits not hit, daily target not reached, no opposite position, no duplicate from the same swing.",
      "ENTRY: only when total confluence score ≥ 80/100 and all layers agree in direction. One trade per confluence — no separate strategy trades.",
      "POSITION MANAGEMENT: initial lot 0.01, max 2 total positions, SL 1.5–1.8×ATR beyond sweep wick, TP min 1:2 RR, break-even at 1R, optional 50% partial at 1R, final target 2R.",
      "RECOVERY: one controlled recovery position only while EMA trend stays valid, price has moved against ≥ 1.2×ATR, no EMA reversal, spread normal, max positions not reached. Recovery lot never exceeds 1.25×.",
      "DO NOT MERGE WHEN: flat/ranging market, EMAs too close or crossing, ATR too low, high spread, rollover, cooldown, daily target reached, or after 2 consecutive losses.",
    ],
  },
];

const PATTERNS = [
  {
    name: "Hammer",
    type: "Bullish",
    signal: "Reversal",
    desc: "Small body at top, long lower wick. Price rejected lows, buyers took control. Valid at demand zones and OBs.",
    power: 82,
  },
  {
    name: "Bullish Engulfing",
    type: "Bullish",
    signal: "Reversal",
    desc: "Large green candle fully engulfs the prior red candle. Strong shift in momentum from sellers to buyers.",
    power: 88,
  },
  {
    name: "Morning Star",
    type: "Bullish",
    signal: "Reversal",
    desc: "3-candle pattern: bearish → small doji/indecision → strong bullish. Marks exhaustion of sellers at key lows.",
    power: 85,
  },
  {
    name: "Tweezer Bottoms",
    type: "Bullish",
    signal: "Reversal",
    desc: "Two candles with identical lows. Double rejection of a level — institutional orders sitting at that price.",
    power: 78,
  },
  {
    name: "Piercing Line",
    type: "Bullish",
    signal: "Reversal",
    desc: "Bearish candle followed by bullish candle closing above the midpoint. Strong buyer re-entry after a sell push.",
    power: 74,
  },
  {
    name: "Three White Soldiers",
    type: "Bullish",
    signal: "Continuation",
    desc: "3 consecutive bullish candles with closing near highs. Sustained buying pressure — trend continuation signal.",
    power: 80,
  },
  {
    name: "Evening Star",
    type: "Bearish",
    signal: "Reversal",
    desc: "3-candle pattern: bullish → doji → strong bearish. Exhaustion of buyers at key highs. Mirror of Morning Star.",
    power: 85,
  },
  {
    name: "Shooting Star",
    type: "Bearish",
    signal: "Reversal",
    desc: "Small body at bottom, long upper wick. Price rejected highs sharply — sellers dominated the session close.",
    power: 81,
  },
  {
    name: "Hanging Man",
    type: "Bearish",
    signal: "Reversal",
    desc: "Looks like a Hammer but appears at market tops. Signals sellers starting to push despite early buyer pressure.",
    power: 72,
  },
  {
    name: "Bearish Engulfing",
    type: "Bearish",
    signal: "Reversal",
    desc: "Large red candle fully engulfs prior green candle. Decisive shift from buyers to sellers at key supply zones.",
    power: 88,
  },
];

function StrategyBlock({ item, index }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <GlassCard className="p-0 overflow-hidden">
        <button className="w-full p-4 flex items-start gap-3 text-left" onClick={() => setOpen(!open)}>
          <div className="w-11 h-11 shrink-0 rounded-xl bg-red-500/10 flex items-center justify-center mt-0.5">
            <item.icon className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-heading text-sm font-bold text-white">{item.title}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${item.tagColor}`}>{item.tag}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.summary}</p>
          </div>
          <div className="shrink-0 mt-1">
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                {item.details.map((d, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">{d}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}

function PatternCard({ p, i }) {
  const buy = p.type === "Bullish";
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
      <GlassCard className="h-full">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${buy ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
            {p.type}
          </span>
          <span className="text-[10px] text-muted-foreground border border-white/10 px-2 py-0.5 rounded-full">{p.signal}</span>
        </div>
        <h4 className="font-heading text-sm font-bold text-white mb-1">{p.name}</h4>
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{p.desc}</p>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Reliability</span>
            <span className={`text-[10px] font-bold ${buy ? "text-green-400" : "text-red-400"}`}>{p.power}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${buy ? "bg-green-500" : "bg-red-500"}`}
              initial={{ width: 0 }}
              animate={{ width: `${p.power}%` }}
              transition={{ duration: 1, delay: 0.2 + i * 0.05, ease: "easeOut" }}
            />
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

export default function Strategy() {
  const [tab, setTab] = useState("strategy");

  return (
    <div className="px-4 pt-8 space-y-4">
      <header>
        <h1 className="font-heading text-2xl font-black text-white neon-text">Strategy Logic</h1>
        <p className="text-sm text-muted-foreground">Multi-layer SMC + Price Action confluence engine.</p>
      </header>

      {/* Tab Switch */}
      <div className="glass rounded-2xl p-1 flex gap-1">
        {["strategy", "patterns", "swing2026", "tpr", "hybrid", "nqkz", "msbos", "ofor", "gmr"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl font-heading text-[11px] uppercase tracking-widest font-bold transition-all ${tab === t ? "bg-red-600 text-white neon-red" : "text-muted-foreground"}`}>
            {t === "strategy" ? "Layers" : t === "patterns" ? "Patterns" : t === "swing2026" ? "Swing 2026" : t === "tpr" ? "EMA Recovery" : t === "hybrid" ? "Hybrid" : t === "nqkz" ? "NQ KillZone" : t === "msbos" ? "BOS Retest" : t === "ofor" ? "Orderflow" : "Gold Range"}
          </button>
        ))}
      </div>

      {tab === "swing2026" ? (
        <div className="space-y-4">
          <SwingPullbackLiveCard />
        </div>
      ) : tab === "tpr" ? (
        <div className="space-y-4">
          <EmaTrendRecoveryLiveCard />
        </div>
      ) : tab === "hybrid" ? (
        <div className="space-y-4">
          <HybridConfluenceLiveCard />
        </div>
      ) : tab === "nqkz" ? (
        <div className="space-y-4">
          <NqKillZoneLiveCard />
        </div>
      ) : tab === "msbos" ? (
        <div className="space-y-4">
          <MsBosRetestLiveCard />
        </div>
      ) : tab === "ofor" ? (
        <div className="space-y-4">
          <OrderflowOpeningRangeLiveCard />
        </div>
      ) : tab === "gmr" ? (
        <div className="space-y-4">
          <GoldMorningRangeLiveCard />
        </div>
      ) : tab === "strategy" ? (
        <div className="space-y-3">
          <StrategyFilterToggles />
          {STRATEGY.map((item, i) => <StrategyBlock key={item.title} item={item} index={i} />)}

          {/* Confluence Guide */}
          <GlassCard className="border border-red-500/20">
            <h3 className="font-heading text-sm uppercase tracking-[0.2em] text-red-400 mb-3">⚡ Confluence Score Guide</h3>
            <div className="space-y-2">
              {[
                { label: "5+ factors aligned", desc: "Premium setup — maximum lot size", color: "text-green-400" },
                { label: "3–4 factors aligned", desc: "Standard setup — normal lot size", color: "text-amber-400" },
                { label: "1–2 factors aligned", desc: "Low confidence — skip the trade", color: "text-red-400" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                  <div className={`w-2 h-2 rounded-full bg-current ${row.color}`} />
                  <div>
                    <p className={`text-xs font-semibold ${row.color}`}>{row.label}</p>
                    <p className="text-[11px] text-muted-foreground">{row.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-green-400 uppercase tracking-widest mb-3 font-semibold">Bullish Reversal Patterns</p>
            <div className="grid grid-cols-1 gap-3">
              {PATTERNS.filter(p => p.type === "Bullish").map((p, i) => <PatternCard key={p.name} p={p} i={i} />)}
            </div>
          </div>
          <div>
            <p className="text-xs text-red-400 uppercase tracking-widest mb-3 font-semibold">Bearish Reversal Patterns</p>
            <div className="grid grid-cols-1 gap-3">
              {PATTERNS.filter(p => p.type === "Bearish").map((p, i) => <PatternCard key={p.name} p={p} i={i} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}