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
import NqKillZoneSettings from "@/components/robotstart/NqKillZoneSettings";
import MsBosRetestSettings from "@/components/robotstart/MsBosRetestSettings";
import OrderflowOpeningRangeSettings from "@/components/robotstart/OrderflowOpeningRangeSettings";
import GoldMorningRangeSettings from "@/components/robotstart/GoldMorningRangeSettings";
import GoldDailyBreakoutSettings from "@/components/robotstart/GoldDailyBreakoutSettings";
import CollapsibleSection from "@/components/robotstart/CollapsibleSection";

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
  "NQ London Kill Zone Breakout",
  "Market Structure BOS Retest Scalper",
  "Orderflow Opening Range Breakout",
  "Gold Morning Range Breakout",
  "Gold Daily Breakout",
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
  // Daily Profit Target — toggleable, amount ($) or % of balance
  daily_profit_target_enabled: true,
  daily_profit_target_amount: 200,
  daily_profit_target_mode: "Fixed",
  session_cooldown_minutes: 60,
  daily_profit_target_percent: 0,
  stop_trading_at_daily_target: true,
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
  // NQ London Kill Zone Breakout — 03:00–09:30 ET range, 09:30–11:00 ET entries, fixed 1:2 RR, no recovery
  nqkz_lot_size: 0.01,
  nqkz_max_open_trades: 1,
  nqkz_max_trades_per_day: 2,
  nqkz_risk_reward: 2,
  nqkz_sl_buffer_points: 5,
  nqkz_breakout_buffer_points: 2,
  nqkz_min_body_points: 5,
  nqkz_max_wick_body_ratio: 0.6,
  nqkz_min_range_points: 20,
  nqkz_max_range_points: 400,
  nqkz_use_atr_filter: true,
  nqkz_atr_period: 14,
  nqkz_min_atr: 0,
  nqkz_use_break_even: true,
  nqkz_partial_close_50: false,
  nqkz_max_spread_points: 30,
  nqkz_max_daily_loss_pct: 2,
  nqkz_equity_stop_pct: 3,
  nqkz_max_consecutive_losses: 2,
  nqkz_cooldown_hours: 8,
  // Market Structure BOS Retest Scalper — H1 structure → M5 BOS → retest → confirmation candle, fixed 1:2 RR, no indicators
  ms_htf_timeframe: "H1",
  ms_entry_timeframe: "M5",
  ms_confirm_timeframe: "M15",
  ms_swing_lookback: 20,
  ms_require_confirmation: true,
  ms_retest_buffer_points: 10,
  ms_lot_size: 0.01,
  ms_max_open_trades: 1,
  ms_max_trades_per_day: 3,
  ms_risk_reward: 2,
  ms_sl_buffer_points: 5,
  ms_use_break_even: true,
  ms_partial_close_50: false,
  ms_max_spread_points: 30,
  ms_max_daily_loss_pct: 2,
  ms_max_daily_drawdown_pct: 3,
  ms_max_consecutive_losses: 2,
  ms_cooldown_hours: 8,
  // Orderflow Opening Range Breakout — 09:30–10:00 ET opening range, breakout confirmed by order-flow/volume, retest preferred, fixed 1:2 RR, no recovery
  ofor_lot_size: 0.01,
  ofor_max_open_trades: 1,
  ofor_max_trades_per_day: 2,
  ofor_risk_reward: 2,
  ofor_sl_buffer_points: 5,
  ofor_breakout_buffer_points: 2,
  ofor_min_body_points: 5,
  ofor_max_wick_body_ratio: 0.6,
  ofor_min_range_points: 20,
  ofor_max_range_points: 400,
  ofor_require_retest: true,
  ofor_retest_buffer_points: 10,
  ofor_use_orderflow_filter: true,
  ofor_volume_expansion_mult: 1.5,
  ofor_use_atr_filter: true,
  ofor_atr_period: 14,
  ofor_min_atr: 0,
  ofor_use_break_even: true,
  ofor_partial_close_50: false,
  ofor_max_spread_points: 30,
  ofor_max_daily_loss_pct: 2,
  ofor_equity_stop_pct: 3,
  ofor_max_consecutive_losses: 2,
  ofor_cooldown_hours: 8,
  // Gold Morning Range Breakout — XAUUSD 08:00–09:30 ET morning range, M5 breakout confirmed by tick volume + ATR, retest preferred, fixed 1:2 RR, no recovery
  gmr_lot_size: 0.01,
  gmr_max_open_trades: 1,
  gmr_max_trades_per_day: 2,
  gmr_risk_reward: 2,
  gmr_sl_buffer_points: 5,
  gmr_min_body_points: 5,
  gmr_min_range_points: 20,
  gmr_max_range_points: 400,
  gmr_require_retest: true,
  gmr_retest_buffer_points: 10,
  gmr_use_volume_filter: true,
  gmr_volume_threshold_mult: 1,
  gmr_use_atr_filter: true,
  gmr_atr_period: 14,
  gmr_min_atr: 0,
  gmr_use_news_filter: true,
  gmr_use_break_even: true,
  gmr_partial_close_50: false,
  gmr_max_spread_points: 30,
  gmr_max_daily_loss_pct: 2,
  gmr_equity_stop_pct: 3,
  gmr_max_consecutive_losses: 2,
  gmr_cooldown_hours: 8,
  // Gold Daily Breakout — XAUUSD previous-day high/low breakout, OCO pending stops, max 1 trade/day, fixed 1:2 RR, BE at 1R, trailing after 1R
  gdb_lot_size: 0.01,
  gdb_max_open_trades: 1,
  gdb_max_trades_per_day: 1,
  gdb_risk_reward: 2,
  gdb_sl_buffer_points: 5,
  gdb_breakout_buffer_points: 3,
  gdb_min_range_points: 50,
  gdb_max_range_points: 2000,
  gdb_use_atr_filter: true,
  gdb_atr_period: 14,
  gdb_min_atr: 0,
  gdb_use_break_even: true,
  gdb_break_even_at_r: 1,
  gdb_use_trailing: true,
  gdb_trailing_start_r: 1,
  gdb_trailing_atr_mult: 1.5,
  gdb_cancel_at_session_end: true,
  gdb_max_spread_points: 30,
  gdb_max_daily_loss_pct: 2,
  gdb_equity_stop_pct: 3,
  gdb_max_consecutive_losses: 2,
  gdb_cooldown_hours: 8,
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
        daily_profit_target_enabled: s.daily_profit_target_enabled ?? prev.daily_profit_target_enabled,
        daily_profit_target_amount: s.daily_profit_target_amount ?? prev.daily_profit_target_amount,
        daily_profit_target_mode: s.daily_profit_target_mode ?? prev.daily_profit_target_mode,
        session_cooldown_minutes: s.session_cooldown_minutes ?? prev.session_cooldown_minutes,
        daily_profit_target_percent: s.daily_profit_target_percent ?? prev.daily_profit_target_percent,
        stop_trading_at_daily_target: s.stop_trading_at_daily_target ?? prev.stop_trading_at_daily_target,
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
        nqkz_lot_size: s.nqkz_lot_size ?? prev.nqkz_lot_size,
        nqkz_max_open_trades: s.nqkz_max_open_trades ?? prev.nqkz_max_open_trades,
        nqkz_max_trades_per_day: s.nqkz_max_trades_per_day ?? prev.nqkz_max_trades_per_day,
        nqkz_risk_reward: s.nqkz_risk_reward ?? prev.nqkz_risk_reward,
        nqkz_sl_buffer_points: s.nqkz_sl_buffer_points ?? prev.nqkz_sl_buffer_points,
        nqkz_breakout_buffer_points: s.nqkz_breakout_buffer_points ?? prev.nqkz_breakout_buffer_points,
        nqkz_min_body_points: s.nqkz_min_body_points ?? prev.nqkz_min_body_points,
        nqkz_max_wick_body_ratio: s.nqkz_max_wick_body_ratio ?? prev.nqkz_max_wick_body_ratio,
        nqkz_min_range_points: s.nqkz_min_range_points ?? prev.nqkz_min_range_points,
        nqkz_max_range_points: s.nqkz_max_range_points ?? prev.nqkz_max_range_points,
        nqkz_use_atr_filter: s.nqkz_use_atr_filter ?? prev.nqkz_use_atr_filter,
        nqkz_atr_period: s.nqkz_atr_period ?? prev.nqkz_atr_period,
        nqkz_min_atr: s.nqkz_min_atr ?? prev.nqkz_min_atr,
        nqkz_use_break_even: s.nqkz_use_break_even ?? prev.nqkz_use_break_even,
        nqkz_partial_close_50: s.nqkz_partial_close_50 ?? prev.nqkz_partial_close_50,
        nqkz_max_spread_points: s.nqkz_max_spread_points ?? prev.nqkz_max_spread_points,
        nqkz_max_daily_loss_pct: s.nqkz_max_daily_loss_pct ?? prev.nqkz_max_daily_loss_pct,
        nqkz_equity_stop_pct: s.nqkz_equity_stop_pct ?? prev.nqkz_equity_stop_pct,
        nqkz_max_consecutive_losses: s.nqkz_max_consecutive_losses ?? prev.nqkz_max_consecutive_losses,
        nqkz_cooldown_hours: s.nqkz_cooldown_hours ?? prev.nqkz_cooldown_hours,
        ms_htf_timeframe: s.ms_htf_timeframe ?? prev.ms_htf_timeframe,
        ms_entry_timeframe: s.ms_entry_timeframe ?? prev.ms_entry_timeframe,
        ms_confirm_timeframe: s.ms_confirm_timeframe ?? prev.ms_confirm_timeframe,
        ms_swing_lookback: s.ms_swing_lookback ?? prev.ms_swing_lookback,
        ms_require_confirmation: s.ms_require_confirmation ?? prev.ms_require_confirmation,
        ms_retest_buffer_points: s.ms_retest_buffer_points ?? prev.ms_retest_buffer_points,
        ms_lot_size: s.ms_lot_size ?? prev.ms_lot_size,
        ms_max_open_trades: s.ms_max_open_trades ?? prev.ms_max_open_trades,
        ms_max_trades_per_day: s.ms_max_trades_per_day ?? prev.ms_max_trades_per_day,
        ms_risk_reward: s.ms_risk_reward ?? prev.ms_risk_reward,
        ms_sl_buffer_points: s.ms_sl_buffer_points ?? prev.ms_sl_buffer_points,
        ms_use_break_even: s.ms_use_break_even ?? prev.ms_use_break_even,
        ms_partial_close_50: s.ms_partial_close_50 ?? prev.ms_partial_close_50,
        ms_max_spread_points: s.ms_max_spread_points ?? prev.ms_max_spread_points,
        ms_max_daily_loss_pct: s.ms_max_daily_loss_pct ?? prev.ms_max_daily_loss_pct,
        ms_max_daily_drawdown_pct: s.ms_max_daily_drawdown_pct ?? prev.ms_max_daily_drawdown_pct,
        ms_max_consecutive_losses: s.ms_max_consecutive_losses ?? prev.ms_max_consecutive_losses,
        ms_cooldown_hours: s.ms_cooldown_hours ?? prev.ms_cooldown_hours,
        ofor_lot_size: s.ofor_lot_size ?? prev.ofor_lot_size,
        ofor_max_open_trades: s.ofor_max_open_trades ?? prev.ofor_max_open_trades,
        ofor_max_trades_per_day: s.ofor_max_trades_per_day ?? prev.ofor_max_trades_per_day,
        ofor_risk_reward: s.ofor_risk_reward ?? prev.ofor_risk_reward,
        ofor_sl_buffer_points: s.ofor_sl_buffer_points ?? prev.ofor_sl_buffer_points,
        ofor_breakout_buffer_points: s.ofor_breakout_buffer_points ?? prev.ofor_breakout_buffer_points,
        ofor_min_body_points: s.ofor_min_body_points ?? prev.ofor_min_body_points,
        ofor_max_wick_body_ratio: s.ofor_max_wick_body_ratio ?? prev.ofor_max_wick_body_ratio,
        ofor_min_range_points: s.ofor_min_range_points ?? prev.ofor_min_range_points,
        ofor_max_range_points: s.ofor_max_range_points ?? prev.ofor_max_range_points,
        ofor_require_retest: s.ofor_require_retest ?? prev.ofor_require_retest,
        ofor_retest_buffer_points: s.ofor_retest_buffer_points ?? prev.ofor_retest_buffer_points,
        ofor_use_orderflow_filter: s.ofor_use_orderflow_filter ?? prev.ofor_use_orderflow_filter,
        ofor_volume_expansion_mult: s.ofor_volume_expansion_mult ?? prev.ofor_volume_expansion_mult,
        ofor_use_atr_filter: s.ofor_use_atr_filter ?? prev.ofor_use_atr_filter,
        ofor_atr_period: s.ofor_atr_period ?? prev.ofor_atr_period,
        ofor_min_atr: s.ofor_min_atr ?? prev.ofor_min_atr,
        ofor_use_break_even: s.ofor_use_break_even ?? prev.ofor_use_break_even,
        ofor_partial_close_50: s.ofor_partial_close_50 ?? prev.ofor_partial_close_50,
        ofor_max_spread_points: s.ofor_max_spread_points ?? prev.ofor_max_spread_points,
        ofor_max_daily_loss_pct: s.ofor_max_daily_loss_pct ?? prev.ofor_max_daily_loss_pct,
        ofor_equity_stop_pct: s.ofor_equity_stop_pct ?? prev.ofor_equity_stop_pct,
        ofor_max_consecutive_losses: s.ofor_max_consecutive_losses ?? prev.ofor_max_consecutive_losses,
        ofor_cooldown_hours: s.ofor_cooldown_hours ?? prev.ofor_cooldown_hours,
        gmr_lot_size: s.gmr_lot_size ?? prev.gmr_lot_size,
        gmr_max_open_trades: s.gmr_max_open_trades ?? prev.gmr_max_open_trades,
        gmr_max_trades_per_day: s.gmr_max_trades_per_day ?? prev.gmr_max_trades_per_day,
        gmr_risk_reward: s.gmr_risk_reward ?? prev.gmr_risk_reward,
        gmr_sl_buffer_points: s.gmr_sl_buffer_points ?? prev.gmr_sl_buffer_points,
        gmr_min_body_points: s.gmr_min_body_points ?? prev.gmr_min_body_points,
        gmr_min_range_points: s.gmr_min_range_points ?? prev.gmr_min_range_points,
        gmr_max_range_points: s.gmr_max_range_points ?? prev.gmr_max_range_points,
        gmr_require_retest: s.gmr_require_retest ?? prev.gmr_require_retest,
        gmr_retest_buffer_points: s.gmr_retest_buffer_points ?? prev.gmr_retest_buffer_points,
        gmr_use_volume_filter: s.gmr_use_volume_filter ?? prev.gmr_use_volume_filter,
        gmr_volume_threshold_mult: s.gmr_volume_threshold_mult ?? prev.gmr_volume_threshold_mult,
        gmr_use_atr_filter: s.gmr_use_atr_filter ?? prev.gmr_use_atr_filter,
        gmr_atr_period: s.gmr_atr_period ?? prev.gmr_atr_period,
        gmr_min_atr: s.gmr_min_atr ?? prev.gmr_min_atr,
        gmr_use_news_filter: s.gmr_use_news_filter ?? prev.gmr_use_news_filter,
        gmr_use_break_even: s.gmr_use_break_even ?? prev.gmr_use_break_even,
        gmr_partial_close_50: s.gmr_partial_close_50 ?? prev.gmr_partial_close_50,
        gmr_max_spread_points: s.gmr_max_spread_points ?? prev.gmr_max_spread_points,
        gmr_max_daily_loss_pct: s.gmr_max_daily_loss_pct ?? prev.gmr_max_daily_loss_pct,
        gmr_equity_stop_pct: s.gmr_equity_stop_pct ?? prev.gmr_equity_stop_pct,
        gmr_max_consecutive_losses: s.gmr_max_consecutive_losses ?? prev.gmr_max_consecutive_losses,
        gmr_cooldown_hours: s.gmr_cooldown_hours ?? prev.gmr_cooldown_hours,
        gdb_lot_size: s.gdb_lot_size ?? prev.gdb_lot_size,
        gdb_max_open_trades: s.gdb_max_open_trades ?? prev.gdb_max_open_trades,
        gdb_max_trades_per_day: s.gdb_max_trades_per_day ?? prev.gdb_max_trades_per_day,
        gdb_risk_reward: s.gdb_risk_reward ?? prev.gdb_risk_reward,
        gdb_sl_buffer_points: s.gdb_sl_buffer_points ?? prev.gdb_sl_buffer_points,
        gdb_breakout_buffer_points: s.gdb_breakout_buffer_points ?? prev.gdb_breakout_buffer_points,
        gdb_min_range_points: s.gdb_min_range_points ?? prev.gdb_min_range_points,
        gdb_max_range_points: s.gdb_max_range_points ?? prev.gdb_max_range_points,
        gdb_use_atr_filter: s.gdb_use_atr_filter ?? prev.gdb_use_atr_filter,
        gdb_atr_period: s.gdb_atr_period ?? prev.gdb_atr_period,
        gdb_min_atr: s.gdb_min_atr ?? prev.gdb_min_atr,
        gdb_use_break_even: s.gdb_use_break_even ?? prev.gdb_use_break_even,
        gdb_break_even_at_r: s.gdb_break_even_at_r ?? prev.gdb_break_even_at_r,
        gdb_use_trailing: s.gdb_use_trailing ?? prev.gdb_use_trailing,
        gdb_trailing_start_r: s.gdb_trailing_start_r ?? prev.gdb_trailing_start_r,
        gdb_trailing_atr_mult: s.gdb_trailing_atr_mult ?? prev.gdb_trailing_atr_mult,
        gdb_cancel_at_session_end: s.gdb_cancel_at_session_end ?? prev.gdb_cancel_at_session_end,
        gdb_max_spread_points: s.gdb_max_spread_points ?? prev.gdb_max_spread_points,
        gdb_max_daily_loss_pct: s.gdb_max_daily_loss_pct ?? prev.gdb_max_daily_loss_pct,
        gdb_equity_stop_pct: s.gdb_equity_stop_pct ?? prev.gdb_equity_stop_pct,
        gdb_max_consecutive_losses: s.gdb_max_consecutive_losses ?? prev.gdb_max_consecutive_losses,
        gdb_cooldown_hours: s.gdb_cooldown_hours ?? prev.gdb_cooldown_hours,
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
  const isNqKz = form.strategy === "NQ London Kill Zone Breakout";
  const isMsBos = form.strategy === "Market Structure BOS Retest Scalper";
  const isOfOr = form.strategy === "Orderflow Opening Range Breakout";
  const isGmr = form.strategy === "Gold Morning Range Breakout";
  const isGdb = form.strategy === "Gold Daily Breakout";

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
        daily_profit_target_enabled: form.daily_profit_target_enabled,
        daily_profit_target_amount: form.daily_profit_target_amount,
        daily_profit_target_mode: form.daily_profit_target_mode,
        session_cooldown_minutes: form.session_cooldown_minutes,
        daily_profit_target_percent: form.daily_profit_target_percent,
        stop_trading_at_daily_target: form.stop_trading_at_daily_target,
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
        nqkz_lot_size: form.nqkz_lot_size,
        nqkz_max_open_trades: form.nqkz_max_open_trades,
        nqkz_max_trades_per_day: form.nqkz_max_trades_per_day,
        nqkz_risk_reward: form.nqkz_risk_reward,
        nqkz_sl_buffer_points: form.nqkz_sl_buffer_points,
        nqkz_breakout_buffer_points: form.nqkz_breakout_buffer_points,
        nqkz_min_body_points: form.nqkz_min_body_points,
        nqkz_max_wick_body_ratio: form.nqkz_max_wick_body_ratio,
        nqkz_min_range_points: form.nqkz_min_range_points,
        nqkz_max_range_points: form.nqkz_max_range_points,
        nqkz_use_atr_filter: form.nqkz_use_atr_filter,
        nqkz_atr_period: form.nqkz_atr_period,
        nqkz_min_atr: form.nqkz_min_atr,
        nqkz_use_break_even: form.nqkz_use_break_even,
        nqkz_partial_close_50: form.nqkz_partial_close_50,
        nqkz_max_spread_points: form.nqkz_max_spread_points,
        nqkz_max_daily_loss_pct: form.nqkz_max_daily_loss_pct,
        nqkz_equity_stop_pct: form.nqkz_equity_stop_pct,
        nqkz_max_consecutive_losses: form.nqkz_max_consecutive_losses,
        nqkz_cooldown_hours: form.nqkz_cooldown_hours,
        ms_htf_timeframe: form.ms_htf_timeframe,
        ms_entry_timeframe: form.ms_entry_timeframe,
        ms_confirm_timeframe: form.ms_confirm_timeframe,
        ms_swing_lookback: form.ms_swing_lookback,
        ms_require_confirmation: form.ms_require_confirmation,
        ms_retest_buffer_points: form.ms_retest_buffer_points,
        ms_lot_size: form.ms_lot_size,
        ms_max_open_trades: form.ms_max_open_trades,
        ms_max_trades_per_day: form.ms_max_trades_per_day,
        ms_risk_reward: form.ms_risk_reward,
        ms_sl_buffer_points: form.ms_sl_buffer_points,
        ms_use_break_even: form.ms_use_break_even,
        ms_partial_close_50: form.ms_partial_close_50,
        ms_max_spread_points: form.ms_max_spread_points,
        ms_max_daily_loss_pct: form.ms_max_daily_loss_pct,
        ms_max_daily_drawdown_pct: form.ms_max_daily_drawdown_pct,
        ms_max_consecutive_losses: form.ms_max_consecutive_losses,
        ms_cooldown_hours: form.ms_cooldown_hours,
        ofor_lot_size: form.ofor_lot_size,
        ofor_max_open_trades: form.ofor_max_open_trades,
        ofor_max_trades_per_day: form.ofor_max_trades_per_day,
        ofor_risk_reward: form.ofor_risk_reward,
        ofor_sl_buffer_points: form.ofor_sl_buffer_points,
        ofor_breakout_buffer_points: form.ofor_breakout_buffer_points,
        ofor_min_body_points: form.ofor_min_body_points,
        ofor_max_wick_body_ratio: form.ofor_max_wick_body_ratio,
        ofor_min_range_points: form.ofor_min_range_points,
        ofor_max_range_points: form.ofor_max_range_points,
        ofor_require_retest: form.ofor_require_retest,
        ofor_retest_buffer_points: form.ofor_retest_buffer_points,
        ofor_use_orderflow_filter: form.ofor_use_orderflow_filter,
        ofor_volume_expansion_mult: form.ofor_volume_expansion_mult,
        ofor_use_atr_filter: form.ofor_use_atr_filter,
        ofor_atr_period: form.ofor_atr_period,
        ofor_min_atr: form.ofor_min_atr,
        ofor_use_break_even: form.ofor_use_break_even,
        ofor_partial_close_50: form.ofor_partial_close_50,
        ofor_max_spread_points: form.ofor_max_spread_points,
        ofor_max_daily_loss_pct: form.ofor_max_daily_loss_pct,
        ofor_equity_stop_pct: form.ofor_equity_stop_pct,
        ofor_max_consecutive_losses: form.ofor_max_consecutive_losses,
        ofor_cooldown_hours: form.ofor_cooldown_hours,
        gmr_lot_size: form.gmr_lot_size,
        gmr_max_open_trades: form.gmr_max_open_trades,
        gmr_max_trades_per_day: form.gmr_max_trades_per_day,
        gmr_risk_reward: form.gmr_risk_reward,
        gmr_sl_buffer_points: form.gmr_sl_buffer_points,
        gmr_min_body_points: form.gmr_min_body_points,
        gmr_min_range_points: form.gmr_min_range_points,
        gmr_max_range_points: form.gmr_max_range_points,
        gmr_require_retest: form.gmr_require_retest,
        gmr_retest_buffer_points: form.gmr_retest_buffer_points,
        gmr_use_volume_filter: form.gmr_use_volume_filter,
        gmr_volume_threshold_mult: form.gmr_volume_threshold_mult,
        gmr_use_atr_filter: form.gmr_use_atr_filter,
        gmr_atr_period: form.gmr_atr_period,
        gmr_min_atr: form.gmr_min_atr,
        gmr_use_news_filter: form.gmr_use_news_filter,
        gmr_use_break_even: form.gmr_use_break_even,
        gmr_partial_close_50: form.gmr_partial_close_50,
        gmr_max_spread_points: form.gmr_max_spread_points,
        gmr_max_daily_loss_pct: form.gmr_max_daily_loss_pct,
        gmr_equity_stop_pct: form.gmr_equity_stop_pct,
        gmr_max_consecutive_losses: form.gmr_max_consecutive_losses,
        gmr_cooldown_hours: form.gmr_cooldown_hours,
        gdb_lot_size: form.gdb_lot_size,
        gdb_max_open_trades: form.gdb_max_open_trades,
        gdb_max_trades_per_day: form.gdb_max_trades_per_day,
        gdb_risk_reward: form.gdb_risk_reward,
        gdb_sl_buffer_points: form.gdb_sl_buffer_points,
        gdb_breakout_buffer_points: form.gdb_breakout_buffer_points,
        gdb_min_range_points: form.gdb_min_range_points,
        gdb_max_range_points: form.gdb_max_range_points,
        gdb_use_atr_filter: form.gdb_use_atr_filter,
        gdb_atr_period: form.gdb_atr_period,
        gdb_min_atr: form.gdb_min_atr,
        gdb_use_break_even: form.gdb_use_break_even,
        gdb_break_even_at_r: form.gdb_break_even_at_r,
        gdb_use_trailing: form.gdb_use_trailing,
        gdb_trailing_start_r: form.gdb_trailing_start_r,
        gdb_trailing_atr_mult: form.gdb_trailing_atr_mult,
        gdb_cancel_at_session_end: form.gdb_cancel_at_session_end,
        gdb_max_spread_points: form.gdb_max_spread_points,
        gdb_max_daily_loss_pct: form.gdb_max_daily_loss_pct,
        gdb_equity_stop_pct: form.gdb_equity_stop_pct,
        gdb_max_consecutive_losses: form.gdb_max_consecutive_losses,
        gdb_cooldown_hours: form.gdb_cooldown_hours,
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
                <p className="text-[10px] text-white/30">Strategy &amp; risk</p>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">

              <CollapsibleSection title="Pair & Strategy" defaultOpen={true}>
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
              </CollapsibleSection>

              <CollapsibleSection title="Lot & Risk" defaultOpen={true}>
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
                      ? "Auto: compounding activates only after proven profitability."
                      : "Multiplier activates when equity reaches this ratio × balance."}
                  </p>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Stop Loss & Take Profit" defaultOpen={false}>
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
                    {dynamicSlPoints ? `SL ≈ ${dynamicSlPoints} pips (live ATR).` : "Fetching live ATR…"}
                  </p>
                )}
              </CollapsibleSection>

              <CollapsibleSection title="Daily Limits" defaultOpen={false}>
                <div className="space-y-2.5">
                  <Field label="Stop After Losses">
                    <NumberInput value={form.stop_after_losses} onChange={set("stop_after_losses")} min={1} />
                  </Field>
                  <Field label="Daily Profit Target">
                    <Toggle value={form.daily_profit_target_enabled} onChange={set("daily_profit_target_enabled")} />
                  </Field>
                  {form.daily_profit_target_enabled && (
                    <>
                      <Field label="Target Mode">
                        <SelectInput value={form.daily_profit_target_mode} onChange={set("daily_profit_target_mode")} options={["Fixed", "Auto"]} />
                      </Field>
                      {form.daily_profit_target_mode === "Fixed" ? (
                        <>
                          <Field label="Target Amount ($)">
                            <NumberInput value={form.daily_profit_target_amount} onChange={set("daily_profit_target_amount")} min={0} step={10} />
                          </Field>
                          <Field label="Target % (Balance)">
                            <NumberInput value={form.daily_profit_target_percent} onChange={set("daily_profit_target_percent")} min={0} max={100} step={0.5} />
                          </Field>
                        </>
                      ) : (
                        <p className="text-[9px] text-white/25 leading-relaxed">
                          Bot sets the target from market conditions (regime + volatility + balance).
                        </p>
                      )}
                      <Field label="Stop at Target">
                        <Toggle value={form.stop_trading_at_daily_target} onChange={set("stop_trading_at_daily_target")} />
                      </Field>
                      <p className="text-[9px] text-white/25 leading-relaxed">
                        {form.daily_profit_target_mode === "Auto"
                          ? "Pauses at the auto-computed session profit."
                          : `Pauses at ${form.daily_profit_target_percent > 0 ? `${form.daily_profit_target_percent}%` : `$${form.daily_profit_target_amount}`} session profit.`}
                      </p>
                      <Field label="Cooldown (min)">
                        <NumberInput value={form.session_cooldown_minutes} onChange={set("session_cooldown_minutes")} min={0} step={5} />
                      </Field>
                      <p className="text-[9px] text-white/25 leading-relaxed">
                        Waits this long after hitting target before resuming.
                      </p>
                    </>
                  )}
                  <Field label="Loss Limit ($)">
                    <NumberInput value={form.daily_loss_limit} onChange={set("daily_loss_limit")} min={0} />
                  </Field>
                </div>
              </CollapsibleSection>

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
                <p className="text-[9px] text-white/25 leading-relaxed">Closes all trades if equity drops below this %.</p>
              </div>

              <CollapsibleSection title="Trend Filter" defaultOpen={false} accent="blue">
                <TrendFilterSettings
                  form={form}
                  set={set}
                  Field={Field}
                  NumberInput={NumberInput}
                  SelectInput={SelectInput}
                  Toggle={Toggle}
                />
              </CollapsibleSection>

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
                      <p className="text-[9px] text-white/25 leading-relaxed">Stacks Buy/Sell orders at fixed price intervals.</p>
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

              <NqKillZoneSettings
                visible={isNqKz}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                Toggle={Toggle}
              />

              <MsBosRetestSettings
                visible={isMsBos}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              <OrderflowOpeningRangeSettings
                visible={isOfOr}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                Toggle={Toggle}
              />

              <GoldMorningRangeSettings
                visible={isGmr}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                Toggle={Toggle}
              />

              <GoldDailyBreakoutSettings
                visible={isGdb}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
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

                      {/* Break Even */}
                      <div className="space-y-2.5">
                        <Field label="Break Even">
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

                      {/* Trend filter */}
                      <div className="space-y-2.5">
                        <Field label="EMA Period">
                          <NumberInput value={form.hft_ma_period} onChange={set("hft_ma_period")} min={5} />
                        </Field>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <CollapsibleSection title="Auto Schedule" defaultOpen={false} accent="purple">
                <AutoScheduleSettings
                  form={form}
                  set={set}
                  Field={Field}
                  Toggle={Toggle}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Risk Disclaimer" defaultOpen={false}>
                <RiskDisclaimer />
              </CollapsibleSection>

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