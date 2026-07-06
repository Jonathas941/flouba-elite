import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function NqKillZoneSettings({ visible, form, set, Field, NumberInput, Toggle }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 px-4 py-4 space-y-4">
            <p className="text-[9px] uppercase tracking-[0.25em] text-indigo-300 font-heading font-bold">
              ⌁ NQ London Kill Zone Breakout
            </p>
            <p className="text-[9px] text-white/25 leading-relaxed -mt-2">
              London Kill Zone range breakout on NQ / NAS100. Builds the 03:00–09:30 ET range, then trades closed-candle breakouts only between 09:30 and 11:00 ET. Fixed 1:2 RR, one BUY + one SELL max per day. No grid, no martingale, no recovery.
            </p>

            {/* Core */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Core</p>
              <div className="space-y-2.5">
                <Field label="Lot Size">
                  <NumberInput value={form.nqkz_lot_size} onChange={set("nqkz_lot_size")} min={0.01} step={0.01} />
                </Field>
                <Field label="Max Open Trades">
                  <NumberInput value={form.nqkz_max_open_trades} onChange={set("nqkz_max_open_trades")} min={1} />
                </Field>
                <Field label="Max Trades / Day">
                  <NumberInput value={form.nqkz_max_trades_per_day} onChange={set("nqkz_max_trades_per_day")} min={1} />
                </Field>
                <Field label="Risk Reward (fixed)">
                  <NumberInput value={form.nqkz_risk_reward} onChange={set("nqkz_risk_reward")} min={1} step={0.1} />
                </Field>
              </div>
            </div>

            {/* Breakout protection */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Breakout Protection</p>
              <div className="space-y-2.5">
                <Field label="SL Buffer (points)">
                  <NumberInput value={form.nqkz_sl_buffer_points} onChange={set("nqkz_sl_buffer_points")} min={0} />
                </Field>
                <Field label="Breakout Buffer (points)">
                  <NumberInput value={form.nqkz_breakout_buffer_points} onChange={set("nqkz_breakout_buffer_points")} min={0} />
                </Field>
                <Field label="Min Body (points)">
                  <NumberInput value={form.nqkz_min_body_points} onChange={set("nqkz_min_body_points")} min={0} />
                </Field>
                <Field label="Max Wick/Body Ratio">
                  <NumberInput value={form.nqkz_max_wick_body_ratio} onChange={set("nqkz_max_wick_body_ratio")} min={0.1} step={0.1} />
                </Field>
                <Field label="Min Range (points)">
                  <NumberInput value={form.nqkz_min_range_points} onChange={set("nqkz_min_range_points")} min={0} />
                </Field>
                <Field label="Max Range (points)">
                  <NumberInput value={form.nqkz_max_range_points} onChange={set("nqkz_max_range_points")} min={0} />
                </Field>
              </div>
            </div>

            {/* Volatility filter */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Volatility Filter</p>
              <div className="space-y-2.5">
                <Field label="Use ATR Filter">
                  <Toggle value={form.nqkz_use_atr_filter} onChange={set("nqkz_use_atr_filter")} />
                </Field>
                <Field label="ATR Period">
                  <NumberInput value={form.nqkz_atr_period} onChange={set("nqkz_atr_period")} min={1} />
                </Field>
                <Field label="Min ATR">
                  <NumberInput value={form.nqkz_min_atr} onChange={set("nqkz_min_atr")} min={0} step={0.01} />
                </Field>
              </div>
            </div>

            {/* Trade management */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trade Management</p>
              <div className="space-y-2.5">
                <Field label="Break-Even at 1R">
                  <Toggle value={form.nqkz_use_break_even} onChange={set("nqkz_use_break_even")} />
                </Field>
                <Field label="Partial Close 50% @ 1R">
                  <Toggle value={form.nqkz_partial_close_50} onChange={set("nqkz_partial_close_50")} />
                </Field>
              </div>
            </div>

            {/* Risk & filters */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Risk & Filters</p>
              <div className="space-y-2.5">
                <Field label="Max Spread (points)">
                  <NumberInput value={form.nqkz_max_spread_points} onChange={set("nqkz_max_spread_points")} min={1} />
                </Field>
                <Field label="Max Daily Loss (%)">
                  <NumberInput value={form.nqkz_max_daily_loss_pct} onChange={set("nqkz_max_daily_loss_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Equity Stop (%)">
                  <NumberInput value={form.nqkz_equity_stop_pct} onChange={set("nqkz_equity_stop_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Max Consecutive Losses">
                  <NumberInput value={form.nqkz_max_consecutive_losses} onChange={set("nqkz_max_consecutive_losses")} min={1} />
                </Field>
                <Field label="Cooldown (hours)">
                  <NumberInput value={form.nqkz_cooldown_hours} onChange={set("nqkz_cooldown_hours")} min={1} />
                </Field>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}