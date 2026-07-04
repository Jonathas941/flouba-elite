import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const TIMEFRAMES = ["M5", "M15", "M30", "H1"];

export default function HybridConfluenceSettings({ visible, form, set, Field, NumberInput, SelectInput, Toggle }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 px-4 py-4 space-y-4">
            <p className="text-[9px] uppercase tracking-[0.25em] text-cyan-400 font-heading font-bold">
              ⬡ Hybrid Confluence Mode
            </p>
            <p className="text-[9px] text-white/25 leading-relaxed -mt-2">
              Merges EMA Trend (direction) + EMA Pullback (setup) + SMC Liquidity Sweep (confirmation) into a single high-quality entry. Strategies act as confirmation layers — never separate trades. One controlled recovery only, max 2 positions, no martingale.
            </p>

            {/* Trend layer */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trend Layer</p>
              <div className="space-y-2.5">
                <Field label="Timeframe">
                  <SelectInput value={form.hybrid_timeframe} onChange={set("hybrid_timeframe")} options={TIMEFRAMES} />
                </Field>
                <Field label="EMA Fast (6)">
                  <NumberInput value={form.hybrid_ema_6} onChange={set("hybrid_ema_6")} min={2} />
                </Field>
                <Field label="EMA Mid (20)">
                  <NumberInput value={form.hybrid_ema_20} onChange={set("hybrid_ema_20")} min={5} />
                </Field>
                <Field label="EMA Mid (25)">
                  <NumberInput value={form.hybrid_ema_25} onChange={set("hybrid_ema_25")} min={5} />
                </Field>
                <Field label="EMA Slow (50)">
                  <NumberInput value={form.hybrid_ema_50} onChange={set("hybrid_ema_50")} min={10} />
                </Field>
                <Field label="ATR Period">
                  <NumberInput value={form.hybrid_atr_period} onChange={set("hybrid_atr_period")} min={1} />
                </Field>
                <Field label="Min EMA Distance">
                  <NumberInput value={form.hybrid_min_ema_distance} onChange={set("hybrid_min_ema_distance")} min={0} step={0.01} />
                </Field>
                <Field label="Min ATR (volatility)">
                  <NumberInput value={form.hybrid_min_atr} onChange={set("hybrid_min_atr")} min={0} step={0.01} />
                </Field>
              </div>
            </div>

            {/* Pullback layer */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Pullback Layer</p>
              <div className="space-y-2.5">
                <Field label="Pullback Zone (×ATR)">
                  <NumberInput value={form.hybrid_pullback_zone_atr} onChange={set("hybrid_pullback_zone_atr")} min={0.05} step={0.05} />
                </Field>
                <Field label="Max Pullback Depth (×ATR)">
                  <NumberInput value={form.hybrid_max_pullback_depth_atr} onChange={set("hybrid_max_pullback_depth_atr")} min={0.1} step={0.1} />
                </Field>
              </div>
            </div>

            {/* SMC layer */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">SMC Confirmation Layer</p>
              <div className="space-y-2.5">
                <Field label="Swing Lookback (bars)">
                  <NumberInput value={form.hybrid_swing_lookback} onChange={set("hybrid_swing_lookback")} min={3} />
                </Field>
                <Field label="Require Engulfing After Sweep">
                  <Toggle value={form.hybrid_require_engulfing} onChange={set("hybrid_require_engulfing")} />
                </Field>
              </div>
            </div>

            {/* Position management */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Position Management</p>
              <div className="space-y-2.5">
                <Field label="Lot Size">
                  <NumberInput value={form.hybrid_lot_size} onChange={set("hybrid_lot_size")} min={0.01} step={0.01} />
                </Field>
                <Field label="Max Total Positions">
                  <NumberInput value={form.hybrid_max_positions} onChange={set("hybrid_max_positions")} min={1} />
                </Field>
                <Field label="Max Recovery Positions">
                  <NumberInput value={form.hybrid_max_recovery_positions} onChange={set("hybrid_max_recovery_positions")} min={0} />
                </Field>
                <Field label="Recovery Lot Multiplier">
                  <NumberInput value={form.hybrid_lot_multiplier} onChange={set("hybrid_lot_multiplier")} min={1} step={0.05} />
                </Field>
                <Field label="Max Lot Multiplier Cap">
                  <NumberInput value={form.hybrid_max_lot_multiplier} onChange={set("hybrid_max_lot_multiplier")} min={1} step={0.05} />
                </Field>
                <Field label="Recovery Distance (×ATR)">
                  <NumberInput value={form.hybrid_recovery_atr_mult} onChange={set("hybrid_recovery_atr_mult")} min={0.1} step={0.1} />
                </Field>
                <Field label="SL ATR Min (×ATR)">
                  <NumberInput value={form.hybrid_sl_atr_min} onChange={set("hybrid_sl_atr_min")} min={0.1} step={0.1} />
                </Field>
                <Field label="SL ATR Max (×ATR)">
                  <NumberInput value={form.hybrid_sl_atr_max} onChange={set("hybrid_sl_atr_max")} min={0.1} step={0.1} />
                </Field>
                <Field label="Min Risk Reward">
                  <NumberInput value={form.hybrid_min_rr} onChange={set("hybrid_min_rr")} min={1} step={0.1} />
                </Field>
                <Field label="Break-Even at 1R">
                  <Toggle value={form.hybrid_use_break_even} onChange={set("hybrid_use_break_even")} />
                </Field>
                <Field label="Partial Close 50% @ 1R">
                  <Toggle value={form.hybrid_partial_close_50} onChange={set("hybrid_partial_close_50")} />
                </Field>
              </div>
            </div>

            {/* Risk & filters */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Risk & Filters</p>
              <div className="space-y-2.5">
                <Field label="Max Trades / Day">
                  <NumberInput value={form.hybrid_max_trades_per_day} onChange={set("hybrid_max_trades_per_day")} min={1} />
                </Field>
                <Field label="Max Consecutive Losses">
                  <NumberInput value={form.hybrid_max_consecutive_losses} onChange={set("hybrid_max_consecutive_losses")} min={1} />
                </Field>
                <Field label="Cooldown (hours)">
                  <NumberInput value={form.hybrid_cooldown_hours} onChange={set("hybrid_cooldown_hours")} min={1} />
                </Field>
                <Field label="Max Daily Loss (%)">
                  <NumberInput value={form.hybrid_max_daily_loss_pct} onChange={set("hybrid_max_daily_loss_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Equity Stop (%)">
                  <NumberInput value={form.hybrid_equity_stop_pct} onChange={set("hybrid_equity_stop_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Max Spread (points)">
                  <NumberInput value={form.hybrid_max_spread_points} onChange={set("hybrid_max_spread_points")} min={1} />
                </Field>
              </div>
            </div>

            {/* Scoring weights */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Confluence Scoring</p>
              <div className="space-y-2.5">
                <Field label="Min Entry Score">
                  <NumberInput value={form.hybrid_min_score} onChange={set("hybrid_min_score")} min={0} max={100} />
                </Field>
                <Field label="Trend Alignment (pts)">
                  <NumberInput value={form.hybrid_score_trend} onChange={set("hybrid_score_trend")} min={0} max={100} />
                </Field>
                <Field label="Pullback Quality (pts)">
                  <NumberInput value={form.hybrid_score_pullback} onChange={set("hybrid_score_pullback")} min={0} max={100} />
                </Field>
                <Field label="Liquidity Sweep (pts)">
                  <NumberInput value={form.hybrid_score_sweep} onChange={set("hybrid_score_sweep")} min={0} max={100} />
                </Field>
                <Field label="Engulfing Confirm (pts)">
                  <NumberInput value={form.hybrid_score_engulfing} onChange={set("hybrid_score_engulfing")} min={0} max={100} />
                </Field>
                <Field label="Filters (pts)">
                  <NumberInput value={form.hybrid_score_filters} onChange={set("hybrid_score_filters")} min={0} max={100} />
                </Field>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}