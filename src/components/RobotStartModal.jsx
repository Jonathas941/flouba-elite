import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import RiskDisclaimer from "@/components/RiskDisclaimer";
import LiquiditySweepSettings from "@/components/robotstart/LiquiditySweepSettings";
import AutoScheduleSettings from "@/components/robotstart/AutoScheduleSettings";
import HedgeScalperSettings from "@/components/robotstart/HedgeScalperSettings";
import TrendFilterSettings from "@/components/robotstart/TrendFilterSettings";
import SwingPullbackSettings from "@/components/robotstart/SwingPullbackSettings";
import EmaTrendRecoverySettings from "@/components/robotstart/EmaTrendRecoverySettings";
import HybridConfluenceSettings from "@/components/robotstart/HybridConfluenceSettings";

const STRATEGIES = [
  "Momentum Scalping",
  "Range Breakout",
  "Volatility Spike",
  "Hybrid Manual",
  "HFT Scalper",
  "Grid Trading",
  "Liquidity Sweep Scalping",
  "Hedge Scalper",
  "Swing Trend Pullback Continuation 2026",
  "EMA Trend Progressive Recovery",
  "Hybrid Confluence Mode",
  "Auto (AI Select)",
];
const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD"];
const MODES = ["Conservative", "Balanced", "Aggressive"];

// Aggressive = more concurrent trades + bigger lots. Conservative = fewer trades + smaller lots.
const MODE_PRESETS = {
  Conservative: { max_concurrent_trades: 1, lot_size: 0.01 },
  Balanced:     { max_concurrent_trades: 2, lot_size: 0.02 },
  Aggressive:   { max_concurrent_trades: 5, lot_size: 0.05 },
};

const DEFAULT = {
  symbol: "XAUUSD",
  strategy: "Auto (AI Select)",
  trading_mode: "Balanced",
  // Lot & Risk
  lot_size: 0.03,
  max_concurrent_trades: 2,
  risk_percentage: 2,
  lot_multiplier: 2,        // compound: double lot on consecutive winning entries
  multiplier_min_equity_ratio: 2,  // equity must reach 2x balance before lot multiplier activates
  auto_multiplier_enabled: false,  // auto-enable compounding only after proven profitability
  // SL / TP
  stop_loss: 20,
  take_profit: 40,
  dynamic_stop_loss: false, // scale stop loss with live ATR instead of a fixed value
  atr_sl_multiplier: 2,
  // Daily limits
  max_daily_trades: 999999, // unlimited — daily trade cap removed
  stop_after_losses: 2,
  daily_profit_target: 200,
  daily_loss_limit: 20,
  // HFT Scalper specific — tuned for frequent small in/out positions, not trend-riding
  hft_max_trades: 15,
  hft_burst_points: 8,
  hft_basket_tp_pts: 60,
  hft_stop_loss_pts: 150,
  hft_use_break_even: true,
  hft_be_trigger: 20,
  hft_be_lock: 3,
  hft_trailing_dist: 15,
  hft_max_spread: 20,
  hft_ma_period: 20,
  // Grid Trading specific — buy/sell levels stacked at fixed distance from price
  grid_distance_pips: 10,
  grid_max_levels: 5,
  // Liquidity Sweep Scalping specific — HTF trend filter + trick-move/liquidity-sweep entry
  liq_htf_timeframe: "M15",
  liq_entry_timeframe: "M1",
  liq_htf_ema_period: 200,
  liq_rsi_overbought: 80,
  liq_rsi_oversold: 20,
  liq_use_vwap: true,
  liq_session_only: true,
  liq_news_buffer_minutes: 10,
  // Equity Guard — hard-stop that force-closes all trades if equity falls too low
  equity_guard_enabled: true,
  equity_guard_min_equity_pct: 75,
  // Trend Filter — HTF 200 EMA direction gate applied to every strategy
  trend_filter_enabled: true,
  trend_filter_timeframe: "M15",
  trend_filter_ema_period: 200,
  // Auto Schedule — calendar-based auto-start and auto-stop on daily limits
  auto_start_enabled: false,
  auto_start_time: "09:00",
  auto_stop_enabled: true,
  // Hedge Scalper — dual-direction: Buy + Sell simultaneously, close winner when loser hits SL
  hedge_scalp_tp_pips: 30,
  hedge_scalp_sl_pips: 15,
  hedge_scalp_lot_size: 0.02,
  hedge_scalp_max_pairs: 3,
  hedge_scalp_close_winner_on_sl: true,
  hedge_scalp_reopen_delay_sec: 5,
  // Phase 1: Trend-following entry
  hedge_scalp_trend_entry: true,
  hedge_scalp_trend_timeframe: "M15",
  hedge_scalp_trend_ema_period: 200,
  // Phase 3: Hedge mode
  hedge_scalp_hedge_mode: "Same Pair",
  hedge_scalp_hedge_trigger_pips: 15,
  // Phase 4: Scalping over hedge
  hedge_scalp_scalp_over_hedge: true,
  hedge_scalp_scalp_tp_pips: 5,
  // Phase 5: Drawdown reduction
  hedge_scalp_drawdown_reduction: true,
  hedge_scalp_dd_close_ratio: 1,
  // Phase 6: Pair prioritization
  hedge_scalp_pair_priority: true,
  hedge_scalp_priority_lookback_trades: 20,
  // Swing Trend Pullback Continuation 2026 — trend pullback + engulfing confirmation, ATR SL, min 1:2 RR
  swing_timeframe: "M15",
  swing_ema_fast: 20,
  swing_ema_slow: 50,
  swing_atr_period: 14,
  swing_atr_sl_multiplier: 1.5,
  swing_min_rr: 2,
  swing_lot_size: 0.01,
  swing_max_open_trades: 2,
  swing_max_trades_per_day: 3,
  swing_max_consecutive_losses: 2,
  swing_cooldown_hours: 8,
  swing_max_daily_loss_pct: 2,
  swing_max_daily_drawdown_pct: 3,
  swing_max_spread_points: 30,
  swing_use_break_even: true,
  swing_be_at_r: 1,
  swing_use_trailing: false,
  swing_trailing_atr_mult: 1.5,
  swing_pullback_zone_atr: 0.25,
  swing_block_deep_pullback: true,
  swing_partial_close_50: true,
  // EMA Trend Progressive Recovery — EMA 6/25 trend + single capped recovery position, ATR emergency SL, basket TP
  tpr_ema_fast: 6,
  tpr_ema_slow: 25,
  tpr_atr_period: 14,
  tpr_min_ema_distance: 0,
  tpr_trend_strength: 0,
  tpr_lot_size: 0.01,
  tpr_max_open_positions: 2,
  tpr_max_recovery_positions: 1,
  tpr_lot_multiplier: 1.0,
  tpr_max_lot_multiplier: 1.25,
  tpr_recovery_atr_mult: 1.2,
  tpr_basket_profit_target: 10,
  tpr_emergency_sl_atr: 1.8,
  tpr_equity_stop_pct: 3,
  tpr_daily_loss_limit_pct: 2,
  tpr_max_trades_per_day: 3,
  tpr_max_consecutive_losses: 2,
  tpr_cooldown_hours: 8,
  tpr_use_break_even: true,
  tpr_partial_close_50: true,
  tpr_min_rr: 2,
  tpr_max_spread_points: 30,
  // Hybrid Confluence Mode — EMA trend + EMA pullback + SMC liquidity sweep merged as confirmation layers
  hybrid_timeframe: "M15",
  hybrid_ema_6: 6,
  hybrid_ema_20: 20,
  hybrid_ema_25: 25,
  hybrid_ema_50: 50,
  hybrid_atr_period: 14,
  hybrid_min_ema_distance: 0,
  hybrid_min_atr: 0,
  hybrid_pullback_zone_atr: 0.25,
  hybrid_max_pullback_depth_atr: 0.5,
  hybrid_swing_lookback: 20,
  hybrid_require_engulfing: true,
  hybrid_lot_size: 0.01,
  hybrid_max_positions: 2,
  hybrid_max_recovery_positions: 1,
  hybrid_lot_multiplier: 1.0,
  hybrid_max_lot_multiplier: 1.25,
  hybrid_recovery_atr_mult: 1.2,
  hybrid_sl_atr_min: 1.5,
  hybrid_sl_atr_max: 1.8,
  hybrid_min_rr: 2,
  hybrid_use_break_even: true,
  hybrid_partial_close_50: true,
  hybrid_max_trades_per_day: 3,
  hybrid_max_consecutive_losses: 2,
  hybrid_cooldown_hours: 8,
  hybrid_max_daily_loss_pct: 2,
  hybrid_equity_stop_pct: 3,
  hybrid_max_spread_points: 30,
  hybrid_min_score: 80,
  hybrid_score_trend: 30,
  hybrid_score_pullback: 20,
  hybrid_score_sweep: 30,
  hybrid_score_engulfing: 10,
  hybrid_score_filters: 10,
};

function Field({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-white/50 font-heading uppercase tracking-wider shrink-0 w-40">{label}</span>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, min, step = 1 }) {
  return (
    <input
      type="number"
      value={value}
      min={min ?? 0}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-24 text-right px-2 py-1.5 rounded-lg font-heading font-bold text-xs text-white bg-white/5 border border-white/10 focus:border-red-500/40 focus:outline-none"
    />
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1.5 rounded-lg font-heading font-bold text-xs text-white bg-white/5 border border-white/10 focus:border-red-500/40 focus:outline-none appearance-none text-right"
      style={{ background: "rgba(255,255,255,0.06)", minWidth: 96 }}
    >
      {options.map((o) => <option key={o} value={o} style={{ background: "#111" }}>{o}</option>)}
    </select>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full flex items-center transition-colors shrink-0 ${value ? "bg-red-500" : "bg-white/10"}`}
    >
      <motion.div
        layout
        className="w-5 h-5 rounded-full bg-white shadow mx-0.5"
        animate={{ x: value ? 18 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    </button>
  );
}

function SectionLabel({ children }) {
  return <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading mb-3 mt-1">{children}</p>;
}

export default function RobotStartModal({ open, onClose, onStart }) {
  const [form, setForm] = useState({ ...DEFAULT });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [atrPreview, setAtrPreview] = useState(null);

  // Load saved BotSettings on open
  useEffect(() => {
    if (!open) return;
    base44.entities.BotSettings.list().then((records) => {
      if (!records?.length) return;
      const s = records[0];
      setForm((prev) => ({
        ...prev,
        symbol: s.active_pair ?? prev.symbol,
        trading_mode: s.trading_mode ?? prev.trading_mode,
        lot_size: s.lot_size ?? prev.lot_size,
        max_concurrent_trades: s.max_concurrent_trades ?? prev.max_concurrent_trades,
        risk_percentage: s.risk_percentage ?? prev.risk_percentage,
        stop_loss: s.stop_loss ?? prev.stop_loss,
        take_profit: s.take_profit ?? prev.take_profit,
        stop_after_losses: s.stop_after_losses ?? prev.stop_after_losses,
        daily_profit_target: s.daily_profit_target ?? prev.daily_profit_target,
        daily_loss_limit: s.daily_loss_limit ?? prev.daily_loss_limit,
        grid_distance_pips: s.grid_distance_pips ?? prev.grid_distance_pips,
        grid_max_levels: s.grid_max_levels ?? prev.grid_max_levels,
        equity_guard_enabled: s.equity_guard_enabled ?? prev.equity_guard_enabled,
        equity_guard_min_equity_pct: s.equity_guard_min_equity_pct ?? prev.equity_guard_min_equity_pct,
        trend_filter_enabled: s.trend_filter_enabled ?? prev.trend_filter_enabled,
        trend_filter_timeframe: s.trend_filter_timeframe ?? prev.trend_filter_timeframe,
        trend_filter_ema_period: s.trend_filter_ema_period ?? prev.trend_filter_ema_period,
        liq_htf_timeframe: s.liq_htf_timeframe ?? prev.liq_htf_timeframe,
        liq_entry_timeframe: s.liq_entry_timeframe ?? prev.liq_entry_timeframe,
        liq_rsi_overbought: s.liq_rsi_overbought ?? prev.liq_rsi_overbought,
        liq_rsi_oversold: s.liq_rsi_oversold ?? prev.liq_rsi_oversold,
        liq_use_vwap: s.liq_use_vwap ?? prev.liq_use_vwap,
        liq_session_only: s.liq_session_only ?? prev.liq_session_only,
        liq_news_buffer_minutes: s.liq_news_buffer_minutes ?? prev.liq_news_buffer_minutes,
        lot_multiplier: s.lot_multiplier ?? prev.lot_multiplier,
        multiplier_min_equity_ratio: s.multiplier_min_equity_ratio ?? prev.multiplier_min_equity_ratio,
        auto_multiplier_enabled: s.auto_multiplier_enabled ?? prev.auto_multiplier_enabled,
        auto_start_enabled: s.auto_start_enabled ?? prev.auto_start_enabled,
        auto_start_time: s.auto_start_time ?? prev.auto_start_time,
        auto_stop_enabled: s.auto_stop_enabled ?? prev.auto_stop_enabled,
        hedge_scalp_tp_pips: s.hedge_scalp_tp_pips ?? prev.hedge_scalp_tp_pips,
        hedge_scalp_sl_pips: s.hedge_scalp_sl_pips ?? prev.hedge_scalp_sl_pips,
        hedge_scalp_lot_size: s.hedge_scalp_lot_size ?? prev.hedge_scalp_lot_size,
        hedge_scalp_max_pairs: s.hedge_scalp_max_pairs ?? prev.hedge_scalp_max_pairs,
        hedge_scalp_close_winner_on_sl: s.hedge_scalp_close_winner_on_sl ?? prev.hedge_scalp_close_winner_on_sl,
        hedge_scalp_reopen_delay_sec: s.hedge_scalp_reopen_delay_sec ?? prev.hedge_scalp_reopen_delay_sec,
        hedge_scalp_trend_entry: s.hedge_scalp_trend_entry ?? prev.hedge_scalp_trend_entry,
        hedge_scalp_trend_timeframe: s.hedge_scalp_trend_timeframe ?? prev.hedge_scalp_trend_timeframe,
        hedge_scalp_trend_ema_period: s.hedge_scalp_trend_ema_period ?? prev.hedge_scalp_trend_ema_period,
        hedge_scalp_hedge_mode: s.hedge_scalp_hedge_mode ?? prev.hedge_scalp_hedge_mode,
        hedge_scalp_hedge_trigger_pips: s.hedge_scalp_hedge_trigger_pips ?? prev.hedge_scalp_hedge_trigger_pips,
        hedge_scalp_scalp_over_hedge: s.hedge_scalp_scalp_over_hedge ?? prev.hedge_scalp_scalp_over_hedge,
        hedge_scalp_scalp_tp_pips: s.hedge_scalp_scalp_tp_pips ?? prev.hedge_scalp_scalp_tp_pips,
        hedge_scalp_drawdown_reduction: s.hedge_scalp_drawdown_reduction ?? prev.hedge_scalp_drawdown_reduction,
        hedge_scalp_dd_close_ratio: s.hedge_scalp_dd_close_ratio ?? prev.hedge_scalp_dd_close_ratio,
        hedge_scalp_pair_priority: s.hedge_scalp_pair_priority ?? prev.hedge_scalp_pair_priority,
        hedge_scalp_priority_lookback_trades: s.hedge_scalp_priority_lookback_trades ?? prev.hedge_scalp_priority_lookback_trades,
        swing_timeframe: s.swing_timeframe ?? prev.swing_timeframe,
        swing_ema_fast: s.swing_ema_fast ?? prev.swing_ema_fast,
        swing_ema_slow: s.swing_ema_slow ?? prev.swing_ema_slow,
        swing_atr_period: s.swing_atr_period ?? prev.swing_atr_period,
        swing_atr_sl_multiplier: s.swing_atr_sl_multiplier ?? prev.swing_atr_sl_multiplier,
        swing_min_rr: s.swing_min_rr ?? prev.swing_min_rr,
        swing_lot_size: s.swing_lot_size ?? prev.swing_lot_size,
        swing_max_open_trades: s.swing_max_open_trades ?? prev.swing_max_open_trades,
        swing_max_trades_per_day: s.swing_max_trades_per_day ?? prev.swing_max_trades_per_day,
        swing_max_consecutive_losses: s.swing_max_consecutive_losses ?? prev.swing_max_consecutive_losses,
        swing_cooldown_hours: s.swing_cooldown_hours ?? prev.swing_cooldown_hours,
        swing_max_daily_loss_pct: s.swing_max_daily_loss_pct ?? prev.swing_max_daily_loss_pct,
        swing_max_daily_drawdown_pct: s.swing_max_daily_drawdown_pct ?? prev.swing_max_daily_drawdown_pct,
        swing_max_spread_points: s.swing_max_spread_points ?? prev.swing_max_spread_points,
        swing_use_break_even: s.swing_use_break_even ?? prev.swing_use_break_even,
        swing_be_at_r: s.swing_be_at_r ?? prev.swing_be_at_r,
        swing_use_trailing: s.swing_use_trailing ?? prev.swing_use_trailing,
        swing_trailing_atr_mult: s.swing_trailing_atr_mult ?? prev.swing_trailing_atr_mult,
        swing_pullback_zone_atr: s.swing_pullback_zone_atr ?? prev.swing_pullback_zone_atr,
        swing_block_deep_pullback: s.swing_block_deep_pullback ?? prev.swing_block_deep_pullback,
        swing_partial_close_50: s.swing_partial_close_50 ?? prev.swing_partial_close_50,
        tpr_ema_fast: s.tpr_ema_fast ?? prev.tpr_ema_fast,
        tpr_ema_slow: s.tpr_ema_slow ?? prev.tpr_ema_slow,
        tpr_atr_period: s.tpr_atr_period ?? prev.tpr_atr_period,
        tpr_min_ema_distance: s.tpr_min_ema_distance ?? prev.tpr_min_ema_distance,
        tpr_trend_strength: s.tpr_trend_strength ?? prev.tpr_trend_strength,
        tpr_lot_size: s.tpr_lot_size ?? prev.tpr_lot_size,
        tpr_max_open_positions: s.tpr_max_open_positions ?? prev.tpr_max_open_positions,
        tpr_max_recovery_positions: s.tpr_max_recovery_positions ?? prev.tpr_max_recovery_positions,
        tpr_lot_multiplier: s.tpr_lot_multiplier ?? prev.tpr_lot_multiplier,
        tpr_max_lot_multiplier: s.tpr_max_lot_multiplier ?? prev.tpr_max_lot_multiplier,
        tpr_recovery_atr_mult: s.tpr_recovery_atr_mult ?? prev.tpr_recovery_atr_mult,
        tpr_basket_profit_target: s.tpr_basket_profit_target ?? prev.tpr_basket_profit_target,
        tpr_emergency_sl_atr: s.tpr_emergency_sl_atr ?? prev.tpr_emergency_sl_atr,
        tpr_equity_stop_pct: s.tpr_equity_stop_pct ?? prev.tpr_equity_stop_pct,
        tpr_daily_loss_limit_pct: s.tpr_daily_loss_limit_pct ?? prev.tpr_daily_loss_limit_pct,
        tpr_max_trades_per_day: s.tpr_max_trades_per_day ?? prev.tpr_max_trades_per_day,
        tpr_max_consecutive_losses: s.tpr_max_consecutive_losses ?? prev.tpr_max_consecutive_losses,
        tpr_cooldown_hours: s.tpr_cooldown_hours ?? prev.tpr_cooldown_hours,
        tpr_use_break_even: s.tpr_use_break_even ?? prev.tpr_use_break_even,
        tpr_partial_close_50: s.tpr_partial_close_50 ?? prev.tpr_partial_close_50,
        tpr_min_rr: s.tpr_min_rr ?? prev.tpr_min_rr,
        tpr_max_spread_points: s.tpr_max_spread_points ?? prev.tpr_max_spread_points,
        hybrid_timeframe: s.hybrid_timeframe ?? prev.hybrid_timeframe,
        hybrid_ema_6: s.hybrid_ema_6 ?? prev.hybrid_ema_6,
        hybrid_ema_20: s.hybrid_ema_20 ?? prev.hybrid_ema_20,
        hybrid_ema_25: s.hybrid_ema_25 ?? prev.hybrid_ema_25,
        hybrid_ema_50: s.hybrid_ema_50 ?? prev.hybrid_ema_50,
        hybrid_atr_period: s.hybrid_atr_period ?? prev.hybrid_atr_period,
        hybrid_min_ema_distance: s.hybrid_min_ema_distance ?? prev.hybrid_min_ema_distance,
        hybrid_min_atr: s.hybrid_min_atr ?? prev.hybrid_min_atr,
        hybrid_pullback_zone_atr: s.hybrid_pullback_zone_atr ?? prev.hybrid_pullback_zone_atr,
        hybrid_max_pullback_depth_atr: s.hybrid_max_pullback_depth_atr ?? prev.hybrid_max_pullback_depth_atr,
        hybrid_swing_lookback: s.hybrid_swing_lookback ?? prev.hybrid_swing_lookback,
        hybrid_require_engulfing: s.hybrid_require_engulfing ?? prev.hybrid_require_engulfing,
        hybrid_lot_size: s.hybrid_lot_size ?? prev.hybrid_lot_size,
        hybrid_max_positions: s.hybrid_max_positions ?? prev.hybrid_max_positions,
        hybrid_max_recovery_positions: s.hybrid_max_recovery_positions ?? prev.hybrid_max_recovery_positions,
        hybrid_lot_multiplier: s.hybrid_lot_multiplier ?? prev.hybrid_lot_multiplier,
        hybrid_max_lot_multiplier: s.hybrid_max_lot_multiplier ?? prev.hybrid_max_lot_multiplier,
        hybrid_recovery_atr_mult: s.hybrid_recovery_atr_mult ?? prev.hybrid_recovery_atr_mult,
        hybrid_sl_atr_min: s.hybrid_sl_atr_min ?? prev.hybrid_sl_atr_min,
        hybrid_sl_atr_max: s.hybrid_sl_atr_max ?? prev.hybrid_sl_atr_max,
        hybrid_min_rr: s.hybrid_min_rr ?? prev.hybrid_min_rr,
        hybrid_use_break_even: s.hybrid_use_break_even ?? prev.hybrid_use_break_even,
        hybrid_partial_close_50: s.hybrid_partial_close_50 ?? prev.hybrid_partial_close_50,
        hybrid_max_trades_per_day: s.hybrid_max_trades_per_day ?? prev.hybrid_max_trades_per_day,
        hybrid_max_consecutive_losses: s.hybrid_max_consecutive_losses ?? prev.hybrid_max_consecutive_losses,
        hybrid_cooldown_hours: s.hybrid_cooldown_hours ?? prev.hybrid_cooldown_hours,
        hybrid_max_daily_loss_pct: s.hybrid_max_daily_loss_pct ?? prev.hybrid_max_daily_loss_pct,
        hybrid_equity_stop_pct: s.hybrid_equity_stop_pct ?? prev.hybrid_equity_stop_pct,
        hybrid_max_spread_points: s.hybrid_max_spread_points ?? prev.hybrid_max_spread_points,
        hybrid_min_score: s.hybrid_min_score ?? prev.hybrid_min_score,
        hybrid_score_trend: s.hybrid_score_trend ?? prev.hybrid_score_trend,
        hybrid_score_pullback: s.hybrid_score_pullback ?? prev.hybrid_score_pullback,
        hybrid_score_sweep: s.hybrid_score_sweep ?? prev.hybrid_score_sweep,
        hybrid_score_engulfing: s.hybrid_score_engulfing ?? prev.hybrid_score_engulfing,
        hybrid_score_filters: s.hybrid_score_filters ?? prev.hybrid_score_filters,
      }));
    }).catch(() => {});
  }, [open]);

  // Fetch live ATR to preview the volatility-adjusted stop loss
  useEffect(() => {
    if (!open || !form.dynamic_stop_loss) { setAtrPreview(null); return; }
    mt5Api.scannerStatus().then((res) => {
      const atr = res?.ok && res?.data?.scanner?.indicators?.atr_14;
      setAtrPreview(atr || null);
    }).catch(() => setAtrPreview(null));
  }, [open, form.dynamic_stop_loss, form.symbol]);

  const dynamicSlPoints = atrPreview ? Math.round(atrPreview * form.atr_sl_multiplier * 10) : null;

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  // Aggressive/Conservative mode auto-scales lot size and max concurrent trades
  const setTradingMode = (mode) => setForm((f) => ({ ...f, trading_mode: mode, ...MODE_PRESETS[mode] }));

  const isHFT = form.strategy === "HFT Scalper";
  const isGrid = form.strategy === "Grid Trading";
  const isLiquiditySweep = form.strategy === "Liquidity Sweep Scalping";
  const isHedgeScalper = form.strategy === "Hedge Scalper";
  const isSwingPullback = form.strategy === "Swing Trend Pullback Continuation 2026";
  const isTpr = form.strategy === "EMA Trend Progressive Recovery";
  const isHybrid = form.strategy === "Hybrid Confluence Mode";

  const handleStart = async () => {
    setLoading(true);
    setSaving(true);
    setError(null);
    try {
      // If dynamic (ATR-based) SL is on, resolve the fixed pip value to send to the robot now
      // Apply the lot multiplier to the base lot size so bigger lots (and faster balance growth) actually get sent
      const finalForm = {
        ...form,
        ...(form.dynamic_stop_loss && dynamicSlPoints ? { stop_loss: dynamicSlPoints } : {}),
      };

      // Persist common settings back to BotSettings
      const records = await base44.entities.BotSettings.list();
      const patch = {
        active_pair: finalForm.symbol,
        trading_mode: finalForm.trading_mode,
        lot_size: finalForm.lot_size,
        max_concurrent_trades: finalForm.max_concurrent_trades,
        risk_percentage: finalForm.risk_percentage,
        stop_loss: finalForm.stop_loss,
        take_profit: finalForm.take_profit,
        max_daily_trades: form.max_daily_trades,
        stop_after_losses: form.stop_after_losses, // max_daily_trades kept unlimited, no UI control
        daily_profit_target: form.daily_profit_target,
        daily_loss_limit: form.daily_loss_limit,
        grid_distance_pips: form.grid_distance_pips,
        grid_max_levels: form.grid_max_levels,
        equity_guard_enabled: true, // permanently locked ON — account safety
        equity_guard_min_equity_pct: form.equity_guard_min_equity_pct,
        trend_filter_enabled: form.trend_filter_enabled,
        trend_filter_timeframe: form.trend_filter_timeframe,
        trend_filter_ema_period: form.trend_filter_ema_period,
        liq_htf_timeframe: form.liq_htf_timeframe,
        liq_entry_timeframe: form.liq_entry_timeframe,
        liq_rsi_overbought: form.liq_rsi_overbought,
        liq_rsi_oversold: form.liq_rsi_oversold,
        liq_use_vwap: form.liq_use_vwap,
        liq_session_only: form.liq_session_only,
        liq_news_buffer_minutes: form.liq_news_buffer_minutes,
        lot_multiplier: form.lot_multiplier,
        multiplier_min_equity_ratio: form.multiplier_min_equity_ratio,
        auto_multiplier_enabled: form.auto_multiplier_enabled,
        auto_start_enabled: form.auto_start_enabled,
        auto_start_time: form.auto_start_time,
        auto_stop_enabled: true, // permanently locked ON — account safety
        hedge_scalp_tp_pips: form.hedge_scalp_tp_pips,
        hedge_scalp_sl_pips: form.hedge_scalp_sl_pips,
        hedge_scalp_lot_size: form.hedge_scalp_lot_size,
        hedge_scalp_max_pairs: form.hedge_scalp_max_pairs,
        hedge_scalp_close_winner_on_sl: form.hedge_scalp_close_winner_on_sl,
        hedge_scalp_reopen_delay_sec: form.hedge_scalp_reopen_delay_sec,
        hedge_scalp_trend_entry: form.hedge_scalp_trend_entry,
        hedge_scalp_trend_timeframe: form.hedge_scalp_trend_timeframe,
        hedge_scalp_trend_ema_period: form.hedge_scalp_trend_ema_period,
        hedge_scalp_hedge_mode: form.hedge_scalp_hedge_mode,
        hedge_scalp_hedge_trigger_pips: form.hedge_scalp_hedge_trigger_pips,
        hedge_scalp_scalp_over_hedge: form.hedge_scalp_scalp_over_hedge,
        hedge_scalp_scalp_tp_pips: form.hedge_scalp_scalp_tp_pips,
        hedge_scalp_drawdown_reduction: form.hedge_scalp_drawdown_reduction,
        hedge_scalp_dd_close_ratio: form.hedge_scalp_dd_close_ratio,
        hedge_scalp_pair_priority: form.hedge_scalp_pair_priority,
        hedge_scalp_priority_lookback_trades: form.hedge_scalp_priority_lookback_trades,
        swing_timeframe: form.swing_timeframe,
        swing_ema_fast: form.swing_ema_fast,
        swing_ema_slow: form.swing_ema_slow,
        swing_atr_period: form.swing_atr_period,
        swing_atr_sl_multiplier: form.swing_atr_sl_multiplier,
        swing_min_rr: form.swing_min_rr,
        swing_lot_size: form.swing_lot_size,
        swing_max_open_trades: form.swing_max_open_trades,
        swing_max_trades_per_day: form.swing_max_trades_per_day,
        swing_max_consecutive_losses: form.swing_max_consecutive_losses,
        swing_cooldown_hours: form.swing_cooldown_hours,
        swing_max_daily_loss_pct: form.swing_max_daily_loss_pct,
        swing_max_daily_drawdown_pct: form.swing_max_daily_drawdown_pct,
        swing_max_spread_points: form.swing_max_spread_points,
        swing_use_break_even: form.swing_use_break_even,
        swing_be_at_r: form.swing_be_at_r,
        swing_use_trailing: form.swing_use_trailing,
        swing_trailing_atr_mult: form.swing_trailing_atr_mult,
        swing_pullback_zone_atr: form.swing_pullback_zone_atr,
        swing_block_deep_pullback: form.swing_block_deep_pullback,
        swing_partial_close_50: form.swing_partial_close_50,
        tpr_ema_fast: form.tpr_ema_fast,
        tpr_ema_slow: form.tpr_ema_slow,
        tpr_atr_period: form.tpr_atr_period,
        tpr_min_ema_distance: form.tpr_min_ema_distance,
        tpr_trend_strength: form.tpr_trend_strength,
        tpr_lot_size: form.tpr_lot_size,
        tpr_max_open_positions: form.tpr_max_open_positions,
        tpr_max_recovery_positions: form.tpr_max_recovery_positions,
        tpr_lot_multiplier: form.tpr_lot_multiplier,
        tpr_max_lot_multiplier: form.tpr_max_lot_multiplier,
        tpr_recovery_atr_mult: form.tpr_recovery_atr_mult,
        tpr_basket_profit_target: form.tpr_basket_profit_target,
        tpr_emergency_sl_atr: form.tpr_emergency_sl_atr,
        tpr_equity_stop_pct: form.tpr_equity_stop_pct,
        tpr_daily_loss_limit_pct: form.tpr_daily_loss_limit_pct,
        tpr_max_trades_per_day: form.tpr_max_trades_per_day,
        tpr_max_consecutive_losses: form.tpr_max_consecutive_losses,
        tpr_cooldown_hours: form.tpr_cooldown_hours,
        tpr_use_break_even: form.tpr_use_break_even,
        tpr_partial_close_50: form.tpr_partial_close_50,
        tpr_min_rr: form.tpr_min_rr,
        tpr_max_spread_points: form.tpr_max_spread_points,
        hybrid_timeframe: form.hybrid_timeframe,
        hybrid_ema_6: form.hybrid_ema_6,
        hybrid_ema_20: form.hybrid_ema_20,
        hybrid_ema_25: form.hybrid_ema_25,
        hybrid_ema_50: form.hybrid_ema_50,
        hybrid_atr_period: form.hybrid_atr_period,
        hybrid_min_ema_distance: form.hybrid_min_ema_distance,
        hybrid_min_atr: form.hybrid_min_atr,
        hybrid_pullback_zone_atr: form.hybrid_pullback_zone_atr,
        hybrid_max_pullback_depth_atr: form.hybrid_max_pullback_depth_atr,
        hybrid_swing_lookback: form.hybrid_swing_lookback,
        hybrid_require_engulfing: form.hybrid_require_engulfing,
        hybrid_lot_size: form.hybrid_lot_size,
        hybrid_max_positions: form.hybrid_max_positions,
        hybrid_max_recovery_positions: form.hybrid_max_recovery_positions,
        hybrid_lot_multiplier: form.hybrid_lot_multiplier,
        hybrid_max_lot_multiplier: form.hybrid_max_lot_multiplier,
        hybrid_recovery_atr_mult: form.hybrid_recovery_atr_mult,
        hybrid_sl_atr_min: form.hybrid_sl_atr_min,
        hybrid_sl_atr_max: form.hybrid_sl_atr_max,
        hybrid_min_rr: form.hybrid_min_rr,
        hybrid_use_break_even: form.hybrid_use_break_even,
        hybrid_partial_close_50: form.hybrid_partial_close_50,
        hybrid_max_trades_per_day: form.hybrid_max_trades_per_day,
        hybrid_max_consecutive_losses: form.hybrid_max_consecutive_losses,
        hybrid_cooldown_hours: form.hybrid_cooldown_hours,
        hybrid_max_daily_loss_pct: form.hybrid_max_daily_loss_pct,
        hybrid_equity_stop_pct: form.hybrid_equity_stop_pct,
        hybrid_max_spread_points: form.hybrid_max_spread_points,
        hybrid_min_score: form.hybrid_min_score,
        hybrid_score_trend: form.hybrid_score_trend,
        hybrid_score_pullback: form.hybrid_score_pullback,
        hybrid_score_sweep: form.hybrid_score_sweep,
        hybrid_score_engulfing: form.hybrid_score_engulfing,
        hybrid_score_filters: form.hybrid_score_filters,
      };
      if (records?.length) {
        await base44.entities.BotSettings.update(records[0].id, patch);
      } else {
        await base44.entities.BotSettings.create(patch);
      }
      setSaving(false);
      await onStart(finalForm);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
    setSaving(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="w-full max-w-md rounded-t-3xl overflow-hidden"
            style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none", maxHeight: "90vh", overflowY: "auto" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
              <div>
                <h2 className="font-heading font-black text-white text-sm uppercase tracking-widest">Start Robot</h2>
                <p className="text-[10px] text-white/30">Configure strategy &amp; risk before launch</p>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">

              {/* Pair & Strategy */}
              <div>
                <SectionLabel>Pair &amp; Strategy</SectionLabel>
                <div className="space-y-2.5">
                  <Field label="Symbol">
                    <SelectInput value={form.symbol} onChange={set("symbol")} options={PAIRS} />
                  </Field>
                  <Field label="Strategy">
                    <SelectInput value={form.strategy} onChange={set("strategy")} options={STRATEGIES} />
                  </Field>
                  <Field label="Trading Mode">
                    <SelectInput value={form.trading_mode} onChange={setTradingMode} options={MODES} />
                  </Field>
                </div>
              </div>

              {/* Lot & Risk */}
              <div>
                <SectionLabel>Lot &amp; Risk</SectionLabel>
                <div className="space-y-2.5">
                  <Field label="Lot Size">
                    <NumberInput value={form.lot_size} onChange={set("lot_size")} min={0.01} step={0.01} />
                  </Field>
                  <Field label="Max Concurrent Trades">
                    <NumberInput value={form.max_concurrent_trades} onChange={set("max_concurrent_trades")} min={1} />
                  </Field>
                  <Field label="Risk %">
                    <NumberInput value={form.risk_percentage} onChange={set("risk_percentage")} min={0.1} step={0.1} />
                  </Field>
                  <Field label="Lot Multiplier">
                    <NumberInput value={form.lot_multiplier} onChange={set("lot_multiplier")} min={1} step={0.1} />
                  </Field>
                  <Field label="Multiplier Equity Ratio">
                    <NumberInput value={form.multiplier_min_equity_ratio} onChange={set("multiplier_min_equity_ratio")} min={1} step={0.5} />
                  </Field>
                  <Field label="Auto Multiplier">
                    <Toggle value={form.auto_multiplier_enabled} onChange={set("auto_multiplier_enabled")} />
                  </Field>
                  <p className="text-[9px] text-white/25 leading-relaxed">
                    {form.auto_multiplier_enabled
                      ? "Auto: compounding activates only after 30+ closed trades, 55%+ win rate, net positive P&L, and equity ≥ 2x balance. Stays flat until proven."
                      : "Multiplier only activates when equity reaches this ratio × balance (default 2x). Below it, lot size stays flat. Toggle Auto to let performance data decide."}
                  </p>
                </div>
              </div>

              {/* SL / TP */}
              <div>
                <SectionLabel>Stop Loss &amp; Take Profit (pips)</SectionLabel>
                <div className="space-y-2.5">
                  <Field label="Dynamic SL (ATR-based)">
                    <Toggle value={form.dynamic_stop_loss} onChange={set("dynamic_stop_loss")} />
                  </Field>
                  {form.dynamic_stop_loss ? (
                    <Field label="ATR Multiplier">
                      <NumberInput value={form.atr_sl_multiplier} onChange={set("atr_sl_multiplier")} min={0.5} step={0.5} />
                    </Field>
                  ) : (
                    <Field label="Stop Loss">
                      <NumberInput value={form.stop_loss} onChange={set("stop_loss")} min={1} />
                    </Field>
                  )}
                  <Field label="Take Profit">
                    <NumberInput value={form.take_profit} onChange={set("take_profit")} min={1} />
                  </Field>
                </div>
                {form.dynamic_stop_loss && (
                  <p className="text-[9px] text-white/25 leading-relaxed mt-2">
                    {dynamicSlPoints
                      ? `Live ATR${atrPreview ? ` (${atrPreview.toFixed(3)})` : ""} → Stop Loss ≈ ${dynamicSlPoints} pips. Recalculated at launch.`
                      : "Fetching live volatility (ATR)…"}
                  </p>
                )}
              </div>

              {/* Daily Limits */}
              <div>
                <SectionLabel>Daily Limits</SectionLabel>
                <div className="space-y-2.5">
                  <Field label="Stop After Losses">
                    <NumberInput value={form.stop_after_losses} onChange={set("stop_after_losses")} min={1} />
                  </Field>
                  <Field label="Profit Target ($)">
                    <NumberInput value={form.daily_profit_target} onChange={set("daily_profit_target")} min={0} />
                  </Field>
                  <Field label="Loss Limit ($)">
                    <NumberInput value={form.daily_loss_limit} onChange={set("daily_loss_limit")} min={0} />
                  </Field>
                </div>
              </div>

              {/* Equity Guard — hard-stop protection, always visible */}
              <div className="rounded-2xl border border-red-500/25 bg-red-500/5 px-4 py-4 space-y-2.5">
                <p className="text-[9px] uppercase tracking-[0.25em] text-red-400 font-heading font-bold">🛑 Equity Guard (Hard-Stop)</p>
                <Field label="Enable Equity Guard">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-green-400" />
                    <div className="w-11 h-6 rounded-full bg-green-500 flex items-center pointer-events-none">
                      <div className="w-5 h-5 rounded-full bg-white shadow ml-[22px]" />
                    </div>
                  </div>
                </Field>
                {form.equity_guard_enabled && (
                  <Field label="Min Equity (% of Balance)">
                    <NumberInput value={form.equity_guard_min_equity_pct} onChange={set("equity_guard_min_equity_pct")} min={1} max={99} />
                  </Field>
                )}
                <p className="text-[9px] text-white/25 leading-relaxed">Force-closes all trades and pauses the robot if equity drops below this % of balance.</p>
              </div>

              <TrendFilterSettings
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              {/* Grid Trading Settings — only shown when that strategy is selected */}
              <AnimatePresence>
                {isGrid && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-sky-500/25 bg-sky-500/5 px-4 py-4 space-y-2.5">
                      <p className="text-[9px] uppercase tracking-[0.25em] text-sky-400 font-heading font-bold">▦ Grid Trading Settings</p>
                      <Field label="Grid Distance (pips)">
                        <NumberInput value={form.grid_distance_pips} onChange={set("grid_distance_pips")} min={1} />
                      </Field>
                      <Field label="Max Grid Levels">
                        <NumberInput value={form.grid_max_levels} onChange={set("grid_max_levels")} min={1} />
                      </Field>
                      <p className="text-[9px] text-white/25 leading-relaxed">Opens Buy/Sell orders at fixed distances from price and stacks further positions as each level is hit. Equity Guard is strongly recommended with this strategy.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <LiquiditySweepSettings
                visible={isLiquiditySweep}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              <HedgeScalperSettings
                visible={isHedgeScalper}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              <SwingPullbackSettings
                visible={isSwingPullback}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              <EmaTrendRecoverySettings
                visible={isTpr}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              <HybridConfluenceSettings
                visible={isHybrid}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              {/* HFT Scalper Settings — only shown when that strategy is selected */}
              <AnimatePresence>
                {isHFT && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-4 space-y-4">
                      <p className="text-[9px] uppercase tracking-[0.25em] text-amber-400 font-heading font-bold">⚡ HFT Scalper Settings</p>

                      {/* Multi-trade stacking */}
                      <div>
                        <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trade Stacking</p>
                        <div className="space-y-2.5">
                          <Field label="Max Stacked Trades">
                            <NumberInput value={form.hft_max_trades} onChange={set("hft_max_trades")} min={1} />
                          </Field>
                          <Field label="Burst Trigger (pts)">
                            <NumberInput value={form.hft_burst_points} onChange={set("hft_burst_points")} min={1} />
                          </Field>
                          <Field label="Basket TP (pts)">
                            <NumberInput value={form.hft_basket_tp_pts} onChange={set("hft_basket_tp_pts")} min={1} />
                          </Field>
                        </div>
                      </div>

                      {/* Protection */}
                      <div>
                        <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Protection</p>
                        <div className="space-y-2.5">
                          <Field label="Hard SL (pts)">
                            <NumberInput value={form.hft_stop_loss_pts} onChange={set("hft_stop_loss_pts")} min={1} />
                          </Field>
                          <Field label="Max Spread (pts)">
                            <NumberInput value={form.hft_max_spread} onChange={set("hft_max_spread")} min={1} />
                          </Field>
                          <Field label="Trailing Dist (pts)">
                            <NumberInput value={form.hft_trailing_dist} onChange={set("hft_trailing_dist")} min={1} />
                          </Field>
                        </div>
                      </div>

                      {/* Break Even */}
                      <div>
                        <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Auto Break Even</p>
                        <div className="space-y-2.5">
                          <Field label="Enable Break Even">
                            <Toggle value={form.hft_use_break_even} onChange={set("hft_use_break_even")} />
                          </Field>
                          {form.hft_use_break_even && (
                            <>
                              <Field label="BE Trigger (pts)">
                                <NumberInput value={form.hft_be_trigger} onChange={set("hft_be_trigger")} min={1} />
                              </Field>
                              <Field label="BE Lock (pts)">
                                <NumberInput value={form.hft_be_lock} onChange={set("hft_be_lock")} min={0} />
                              </Field>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Trend filter */}
                      <div>
                        <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trend Filter</p>
                        <div className="space-y-2.5">
                          <Field label="EMA Period">
                            <NumberInput value={form.hft_ma_period} onChange={set("hft_ma_period")} min={5} />
                          </Field>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AutoScheduleSettings
                form={form}
                set={set}
                Field={Field}
                Toggle={Toggle}
              />

              <RiskDisclaimer />

              {error && (
                <div className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10">
                  <p className="text-[10px] text-red-400 font-heading">{error}</p>
                </div>
              )}

              {/* Launch */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleStart}
                disabled={loading}
                className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-heading font-black text-sm tracking-widest disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.95)", color: "#16a34a" }}
              >
                {loading
                  ? <>
                      <div className="w-4 h-4 border-2 border-green-600/40 border-t-green-600 rounded-full animate-spin" />
                      <span>{saving ? "SAVING..." : "LAUNCHING..."}</span>
                    </>
                  : <><Play className="w-4 h-4 fill-current" /><span>LAUNCH ROBOT</span></>}
              </motion.button>

              <div style={{ height: "env(safe-area-inset-bottom, 16px)" }} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}