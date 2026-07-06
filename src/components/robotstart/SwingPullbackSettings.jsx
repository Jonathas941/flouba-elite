import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const TIMEFRAMES = ["M15", "M30", "H1"];

export default function SwingPullbackSettings({ visible, form, set, Field, NumberInput, SelectInput, Toggle }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-4 space-y-4">
            <p className="text-[9px] uppercase tracking-[0.25em] text-emerald-400 font-heading font-bold">
              ↯ Swing Trend Pullback Continuation 2026
            </p>
            <p className="text-[9px] text-white/25 leading-relaxed -mt-2">
              Trend-following pullback engine. Waits for EMA 20/50 alignment, a pullback into the EMA 20 zone, then a closed-candle engulfing confirmation. ATR-based SL, minimum 1:2 RR. No grid, no martingale.
            </p>

            {/* Indicators */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Indicators</p>
              <div className="space-y-2.5">
                <Field label="Timeframe">
                  <SelectInput value={form.swing_timeframe} onChange={set("swing_timeframe")} options={TIMEFRAMES} />
                </Field>
                <Field label="EMA Fast">
                  <NumberInput value={form.swing_ema_fast} onChange={set("swing_ema_fast")} min={2} />
                </Field>
                <Field label="EMA Slow">
                  <NumberInput value={form.swing_ema_slow} onChange={set("swing_ema_slow")} min={5} />
                </Field>
                <Field label="ATR Period">
                  <NumberInput value={form.swing_atr_period} onChange={set("swing_atr_period")} min={1} />
                </Field>
                <Field label="ATR SL Multiplier">
                  <NumberInput value={form.swing_atr_sl_multiplier} onChange={set("swing_atr_sl_multiplier")} min={0.1} step={0.1} />
                </Field>
                <Field label="Min Risk Reward">
                  <NumberInput value={form.swing_min_rr} onChange={set("swing_min_rr")} min={1} step={0.1} />
                </Field>
                <Field label="Pullback Zone (×ATR)">
                  <NumberInput value={form.swing_pullback_zone_atr} onChange={set("swing_pullback_zone_atr")} min={0.05} step={0.05} />
                </Field>
              </div>
            </div>

            {/* Risk */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Risk Management</p>
              <div className="space-y-2.5">
                <Field label="Lot Size">
                  <NumberInput value={form.swing_lot_size} onChange={set("swing_lot_size")} min={0.01} step={0.01} />
                </Field>
                <Field label="Max Open Trades">
                  <NumberInput value={form.swing_max_open_trades} onChange={set("swing_max_open_trades")} min={1} />
                </Field>
                <Field label="Max Trades / Day">
                  <NumberInput value={form.swing_max_trades_per_day} onChange={set("swing_max_trades_per_day")} min={1} />
                </Field>
                <Field label="Max Consecutive Losses">
                  <NumberInput value={form.swing_max_consecutive_losses} onChange={set("swing_max_consecutive_losses")} min={1} />
                </Field>
                <Field label="Cooldown (hours)">
                  <NumberInput value={form.swing_cooldown_hours} onChange={set("swing_cooldown_hours")} min={1} />
                </Field>
                <Field label="Max Daily Loss (%)">
                  <NumberInput value={form.swing_max_daily_loss_pct} onChange={set("swing_max_daily_loss_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Max Daily Drawdown (%)">
                  <NumberInput value={form.swing_max_daily_drawdown_pct} onChange={set("swing_max_daily_drawdown_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Max Spread (points)">
                  <NumberInput value={form.swing_max_spread_points} onChange={set("swing_max_spread_points")} min={1} />
                </Field>
              </div>
            </div>

            {/* Position management */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Position Management</p>
              <div className="space-y-2.5">
                <Field label="Break-Even at 1R">
                  <Toggle value={form.swing_use_break_even} onChange={set("swing_use_break_even")} />
                </Field>
                <Field label="BE Trigger (R)">
                  <NumberInput value={form.swing_be_at_r} onChange={set("swing_be_at_r")} min={0.1} step={0.1} />
                </Field>
                <Field label="Partial Close 50% @ 1R">
                  <Toggle value={form.swing_partial_close_50} onChange={set("swing_partial_close_50")} />
                </Field>
                <Field label="ATR Trailing Stop">
                  <Toggle value={form.swing_use_trailing} onChange={set("swing_use_trailing")} />
                </Field>
                <Field label="Trailing ATR Mult">
                  <NumberInput value={form.swing_trailing_atr_mult} onChange={set("swing_trailing_atr_mult")} min={0.1} step={0.1} />
                </Field>
                <Field label="Block Deep Pullback">
                  <Toggle value={form.swing_block_deep_pullback} onChange={set("swing_block_deep_pullback")} />
                </Field>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}