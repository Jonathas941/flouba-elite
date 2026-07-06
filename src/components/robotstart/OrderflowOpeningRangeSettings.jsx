import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function OrderflowOpeningRangeSettings({ visible, form, set, Field, NumberInput, Toggle }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/5 px-4 py-4 space-y-4">
            <p className="text-[9px] uppercase tracking-[0.25em] text-fuchsia-300 font-heading font-bold">
              ⌁ Orderflow Opening Range Breakout
            </p>
            <p className="text-[9px] text-white/25 leading-relaxed -mt-2">
              Builds the 09:30–10:00 ET opening range, then trades only closed-candle breakouts (10:00–11:00 ET) confirmed by order-flow / volume participation. Prefers a retest. Fixed 1:2 RR, max 1 open, 2 trades/day. No grid, no martingale, no recovery.
            </p>

            {/* Core */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Core</p>
              <div className="space-y-2.5">
                <Field label="Lot Size">
                  <NumberInput value={form.ofor_lot_size} onChange={set("ofor_lot_size")} min={0.01} step={0.01} />
                </Field>
                <Field label="Max Open Trades">
                  <NumberInput value={form.ofor_max_open_trades} onChange={set("ofor_max_open_trades")} min={1} />
                </Field>
                <Field label="Max Trades / Day">
                  <NumberInput value={form.ofor_max_trades_per_day} onChange={set("ofor_max_trades_per_day")} min={1} />
                </Field>
                <Field label="Risk Reward (fixed)">
                  <NumberInput value={form.ofor_risk_reward} onChange={set("ofor_risk_reward")} min={1} step={0.1} />
                </Field>
              </div>
            </div>

            {/* Breakout protection */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Breakout Protection</p>
              <div className="space-y-2.5">
                <Field label="SL Buffer (points)">
                  <NumberInput value={form.ofor_sl_buffer_points} onChange={set("ofor_sl_buffer_points")} min={0} />
                </Field>
                <Field label="Breakout Buffer (points)">
                  <NumberInput value={form.ofor_breakout_buffer_points} onChange={set("ofor_breakout_buffer_points")} min={0} />
                </Field>
                <Field label="Min Body (points)">
                  <NumberInput value={form.ofor_min_body_points} onChange={set("ofor_min_body_points")} min={0} />
                </Field>
                <Field label="Max Wick/Body Ratio">
                  <NumberInput value={form.ofor_max_wick_body_ratio} onChange={set("ofor_max_wick_body_ratio")} min={0.1} step={0.1} />
                </Field>
                <Field label="Min Range (points)">
                  <NumberInput value={form.ofor_min_range_points} onChange={set("ofor_min_range_points")} min={0} />
                </Field>
                <Field label="Max Range (points)">
                  <NumberInput value={form.ofor_max_range_points} onChange={set("ofor_max_range_points")} min={0} />
                </Field>
              </div>
            </div>

            {/* Order-flow & retest */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Order-Flow & Retest</p>
              <div className="space-y-2.5">
                <Field label="Order-Flow Filter">
                  <Toggle value={form.ofor_use_orderflow_filter} onChange={set("ofor_use_orderflow_filter")} />
                </Field>
                <Field label="Volume Expansion (×)">
                  <NumberInput value={form.ofor_volume_expansion_mult} onChange={set("ofor_volume_expansion_mult")} min={1} step={0.1} />
                </Field>
                <Field label="Require Retest">
                  <Toggle value={form.ofor_require_retest} onChange={set("ofor_require_retest")} />
                </Field>
                <Field label="Retest Buffer (points)">
                  <NumberInput value={form.ofor_retest_buffer_points} onChange={set("ofor_retest_buffer_points")} min={0} />
                </Field>
              </div>
            </div>

            {/* Volatility filter */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Volatility Filter</p>
              <div className="space-y-2.5">
                <Field label="Use ATR Filter">
                  <Toggle value={form.ofor_use_atr_filter} onChange={set("ofor_use_atr_filter")} />
                </Field>
                <Field label="ATR Period">
                  <NumberInput value={form.ofor_atr_period} onChange={set("ofor_atr_period")} min={1} />
                </Field>
                <Field label="Min ATR">
                  <NumberInput value={form.ofor_min_atr} onChange={set("ofor_min_atr")} min={0} step={0.01} />
                </Field>
              </div>
            </div>

            {/* Trade management */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trade Management</p>
              <div className="space-y-2.5">
                <Field label="Break-Even at 1R">
                  <Toggle value={form.ofor_use_break_even} onChange={set("ofor_use_break_even")} />
                </Field>
                <Field label="Partial Close 50% @ 1R">
                  <Toggle value={form.ofor_partial_close_50} onChange={set("ofor_partial_close_50")} />
                </Field>
              </div>
            </div>

            {/* Risk & filters */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Risk & Filters</p>
              <div className="space-y-2.5">
                <Field label="Max Spread (points)">
                  <NumberInput value={form.ofor_max_spread_points} onChange={set("ofor_max_spread_points")} min={1} />
                </Field>
                <Field label="Max Daily Loss (%)">
                  <NumberInput value={form.ofor_max_daily_loss_pct} onChange={set("ofor_max_daily_loss_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Equity Stop (%)">
                  <NumberInput value={form.ofor_equity_stop_pct} onChange={set("ofor_equity_stop_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Max Consecutive Losses">
                  <NumberInput value={form.ofor_max_consecutive_losses} onChange={set("ofor_max_consecutive_losses")} min={1} />
                </Field>
                <Field label="Cooldown (hours)">
                  <NumberInput value={form.ofor_cooldown_hours} onChange={set("ofor_cooldown_hours")} min={1} />
                </Field>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}