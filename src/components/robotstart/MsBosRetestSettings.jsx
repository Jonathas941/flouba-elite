import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const HTF = ["H1", "H4", "D1"];
const ETF = ["M5", "M15"];
const CTF = ["M15", "M30", "H1"];

export default function MsBosRetestSettings({ visible, form, set, Field, NumberInput, SelectInput, Toggle }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 px-4 py-4 space-y-4">
            <p className="text-[9px] uppercase tracking-[0.25em] text-violet-300 font-heading font-bold">
              ⌖ Market Structure BOS Retest Scalper
            </p>
            <p className="text-[9px] text-white/25 leading-relaxed -mt-2">
              Pure price-action: H1 structure → M5 Break of Structure → retest the broken level → confirmation candle → entry. Fixed 1:2 RR, stop off the confirmation candle. No indicators, no grid, no martingale, no recovery.
            </p>

            {/* Timeframes */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Timeframes</p>
              <div className="space-y-2.5">
                <Field label="Higher TF (Structure)">
                  <SelectInput value={form.ms_htf_timeframe} onChange={set("ms_htf_timeframe")} options={HTF} />
                </Field>
                <Field label="Entry TF (BOS)">
                  <SelectInput value={form.ms_entry_timeframe} onChange={set("ms_entry_timeframe")} options={ETF} />
                </Field>
                <Field label="Confirm TF (optional)">
                  <SelectInput value={form.ms_confirm_timeframe} onChange={set("ms_confirm_timeframe")} options={CTF} />
                </Field>
                <Field label="Swing Lookback (bars)">
                  <NumberInput value={form.ms_swing_lookback} onChange={set("ms_swing_lookback")} min={3} />
                </Field>
              </div>
            </div>

            {/* Entry / retest */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Entry & Retest</p>
              <div className="space-y-2.5">
                <Field label="Require Confirmation">
                  <Toggle value={form.ms_require_confirmation} onChange={set("ms_require_confirmation")} />
                </Field>
                <Field label="Retest Buffer (points)">
                  <NumberInput value={form.ms_retest_buffer_points} onChange={set("ms_retest_buffer_points")} min={0} />
                </Field>
              </div>
            </div>

            {/* Risk management */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Risk Management</p>
              <div className="space-y-2.5">
                <Field label="Lot Size">
                  <NumberInput value={form.ms_lot_size} onChange={set("ms_lot_size")} min={0.01} step={0.01} />
                </Field>
                <Field label="Max Open Trades">
                  <NumberInput value={form.ms_max_open_trades} onChange={set("ms_max_open_trades")} min={1} />
                </Field>
                <Field label="Max Trades / Day">
                  <NumberInput value={form.ms_max_trades_per_day} onChange={set("ms_max_trades_per_day")} min={1} />
                </Field>
                <Field label="Risk Reward (fixed)">
                  <NumberInput value={form.ms_risk_reward} onChange={set("ms_risk_reward")} min={1} step={0.1} />
                </Field>
                <Field label="SL Buffer (points)">
                  <NumberInput value={form.ms_sl_buffer_points} onChange={set("ms_sl_buffer_points")} min={0} />
                </Field>
              </div>
            </div>

            {/* Trade management */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trade Management</p>
              <div className="space-y-2.5">
                <Field label="Break-Even at 1R">
                  <Toggle value={form.ms_use_break_even} onChange={set("ms_use_break_even")} />
                </Field>
                <Field label="Partial Close 50% @ 1R">
                  <Toggle value={form.ms_partial_close_50} onChange={set("ms_partial_close_50")} />
                </Field>
              </div>
            </div>

            {/* Risk & filters */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Risk & Filters</p>
              <div className="space-y-2.5">
                <Field label="Max Spread (points)">
                  <NumberInput value={form.ms_max_spread_points} onChange={set("ms_max_spread_points")} min={1} />
                </Field>
                <Field label="Max Daily Loss (%)">
                  <NumberInput value={form.ms_max_daily_loss_pct} onChange={set("ms_max_daily_loss_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Max Daily Drawdown (%)">
                  <NumberInput value={form.ms_max_daily_drawdown_pct} onChange={set("ms_max_daily_drawdown_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Max Consecutive Losses">
                  <NumberInput value={form.ms_max_consecutive_losses} onChange={set("ms_max_consecutive_losses")} min={1} />
                </Field>
                <Field label="Cooldown (hours)">
                  <NumberInput value={form.ms_cooldown_hours} onChange={set("ms_cooldown_hours")} min={1} />
                </Field>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}