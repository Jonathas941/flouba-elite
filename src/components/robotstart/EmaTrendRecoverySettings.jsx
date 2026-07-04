import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function EmaTrendRecoverySettings({ visible, form, set, Field, NumberInput, Toggle }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-4 space-y-4">
            <p className="text-[9px] uppercase tracking-[0.25em] text-amber-400 font-heading font-bold">
              ↯ EMA Trend Progressive Recovery
            </p>
            <p className="text-[9px] text-white/25 leading-relaxed -mt-2">
              Controlled trend-following recovery. One initial entry on EMA 6/25 alignment + pullback confirmation, then a single capped recovery position only while the EMA trend stays valid. ATR emergency SL, basket TP, equity stop. No unlimited grid, no martingale.
            </p>

            {/* Indicators */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Indicators</p>
              <div className="space-y-2.5">
                <Field label="EMA Fast">
                  <NumberInput value={form.tpr_ema_fast} onChange={set("tpr_ema_fast")} min={2} />
                </Field>
                <Field label="EMA Slow">
                  <NumberInput value={form.tpr_ema_slow} onChange={set("tpr_ema_slow")} min={5} />
                </Field>
                <Field label="ATR Period">
                  <NumberInput value={form.tpr_atr_period} onChange={set("tpr_atr_period")} min={1} />
                </Field>
                <Field label="Min EMA Distance">
                  <NumberInput value={form.tpr_min_ema_distance} onChange={set("tpr_min_ema_distance")} min={0} step={0.01} />
                </Field>
                <Field label="Trend Strength (slope)">
                  <NumberInput value={form.tpr_trend_strength} onChange={set("tpr_trend_strength")} min={0} step={0.0001} />
                </Field>
              </div>
            </div>

            {/* Recovery */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Progressive Recovery</p>
              <div className="space-y-2.5">
                <Field label="Lot Size">
                  <NumberInput value={form.tpr_lot_size} onChange={set("tpr_lot_size")} min={0.01} step={0.01} />
                </Field>
                <Field label="Max Open Positions">
                  <NumberInput value={form.tpr_max_open_positions} onChange={set("tpr_max_open_positions")} min={1} />
                </Field>
                <Field label="Max Recovery Positions">
                  <NumberInput value={form.tpr_max_recovery_positions} onChange={set("tpr_max_recovery_positions")} min={0} />
                </Field>
                <Field label="Lot Multiplier">
                  <NumberInput value={form.tpr_lot_multiplier} onChange={set("tpr_lot_multiplier")} min={1} step={0.05} />
                </Field>
                <Field label="Max Lot Multiplier (cap)">
                  <NumberInput value={form.tpr_max_lot_multiplier} onChange={set("tpr_max_lot_multiplier")} min={1} step={0.05} />
                </Field>
                <Field label="Recovery Distance (×ATR)">
                  <NumberInput value={form.tpr_recovery_atr_mult} onChange={set("tpr_recovery_atr_mult")} min={0.1} step={0.1} />
                </Field>
                <Field label="Basket Profit Target ($)">
                  <NumberInput value={form.tpr_basket_profit_target} onChange={set("tpr_basket_profit_target")} min={0.1} step={0.5} />
                </Field>
                <Field label="Emergency SL (×ATR)">
                  <NumberInput value={form.tpr_emergency_sl_atr} onChange={set("tpr_emergency_sl_atr")} min={0.1} step={0.1} />
                </Field>
                <Field label="Min Risk Reward">
                  <NumberInput value={form.tpr_min_rr} onChange={set("tpr_min_rr")} min={1} step={0.1} />
                </Field>
              </div>
            </div>

            {/* Risk & Protection */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Risk & Protection</p>
              <div className="space-y-2.5">
                <Field label="Equity Stop (%)">
                  <NumberInput value={form.tpr_equity_stop_pct} onChange={set("tpr_equity_stop_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Daily Loss Limit (%)">
                  <NumberInput value={form.tpr_daily_loss_limit_pct} onChange={set("tpr_daily_loss_limit_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Max Trades / Day">
                  <NumberInput value={form.tpr_max_trades_per_day} onChange={set("tpr_max_trades_per_day")} min={1} />
                </Field>
                <Field label="Max Consecutive Losses">
                  <NumberInput value={form.tpr_max_consecutive_losses} onChange={set("tpr_max_consecutive_losses")} min={1} />
                </Field>
                <Field label="Cooldown (hours)">
                  <NumberInput value={form.tpr_cooldown_hours} onChange={set("tpr_cooldown_hours")} min={1} />
                </Field>
                <Field label="Max Spread (points)">
                  <NumberInput value={form.tpr_max_spread_points} onChange={set("tpr_max_spread_points")} min={1} />
                </Field>
                <Field label="Break-Even at 1R">
                  <Toggle value={form.tpr_use_break_even} onChange={set("tpr_use_break_even")} />
                </Field>
                <Field label="Partial Close 50% @ 1R">
                  <Toggle value={form.tpr_partial_close_50} onChange={set("tpr_partial_close_50")} />
                </Field>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}