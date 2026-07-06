import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function GoldDailyBreakoutSettings({ visible, form, set, Field, NumberInput, Toggle }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/5 px-4 py-4 space-y-4">
            <p className="text-[9px] uppercase tracking-[0.25em] text-yellow-300 font-heading font-bold">
              ◆ Gold Daily Breakout
            </p>
            <p className="text-[9px] text-white/25 leading-relaxed -mt-2">
              XAUUSD previous-day high/low breakout with OCO pending stops. Buy Stop above prev-day high, Sell Stop below prev-day low. Max one trade per day, fixed 1:2 RR, break-even at 1R, trailing after 1R. No martingale, no grid, no recovery.
            </p>

            {/* Core */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Core</p>
              <div className="space-y-2.5">
                <Field label="Lot Size">
                  <NumberInput value={form.gdb_lot_size} onChange={set("gdb_lot_size")} min={0.01} step={0.01} />
                </Field>
                <Field label="Max Open Trades">
                  <NumberInput value={form.gdb_max_open_trades} onChange={set("gdb_max_open_trades")} min={1} />
                </Field>
                <Field label="Max Trades / Day">
                  <NumberInput value={form.gdb_max_trades_per_day} onChange={set("gdb_max_trades_per_day")} min={1} />
                </Field>
                <Field label="Risk Reward (fixed)">
                  <NumberInput value={form.gdb_risk_reward} onChange={set("gdb_risk_reward")} min={1} step={0.1} />
                </Field>
              </div>
            </div>

            {/* Breakout levels */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Breakout Levels</p>
              <div className="space-y-2.5">
                <Field label="Breakout Buffer (pts)">
                  <NumberInput value={form.gdb_breakout_buffer_points} onChange={set("gdb_breakout_buffer_points")} min={0} />
                </Field>
                <Field label="SL Buffer (pts)">
                  <NumberInput value={form.gdb_sl_buffer_points} onChange={set("gdb_sl_buffer_points")} min={0} />
                </Field>
                <Field label="Min Prev-Day Range (pts)">
                  <NumberInput value={form.gdb_min_range_points} onChange={set("gdb_min_range_points")} min={0} />
                </Field>
                <Field label="Max Prev-Day Range (pts)">
                  <NumberInput value={form.gdb_max_range_points} onChange={set("gdb_max_range_points")} min={0} />
                </Field>
              </div>
            </div>

            {/* Volatility filter */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Volatility Filter</p>
              <div className="space-y-2.5">
                <Field label="Use ATR Filter">
                  <Toggle value={form.gdb_use_atr_filter} onChange={set("gdb_use_atr_filter")} />
                </Field>
                <Field label="ATR Period">
                  <NumberInput value={form.gdb_atr_period} onChange={set("gdb_atr_period")} min={1} />
                </Field>
                <Field label="Min ATR">
                  <NumberInput value={form.gdb_min_atr} onChange={set("gdb_min_atr")} min={0} step={0.01} />
                </Field>
              </div>
            </div>

            {/* Trade management */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trade Management</p>
              <div className="space-y-2.5">
                <Field label="Break-Even at 1R">
                  <Toggle value={form.gdb_use_break_even} onChange={set("gdb_use_break_even")} />
                </Field>
                <Field label="BE Trigger (R)">
                  <NumberInput value={form.gdb_break_even_at_r} onChange={set("gdb_break_even_at_r")} min={0.1} step={0.1} />
                </Field>
                <Field label="Trailing Stop">
                  <Toggle value={form.gdb_use_trailing} onChange={set("gdb_use_trailing")} />
                </Field>
                <Field label="Trailing Start (R)">
                  <NumberInput value={form.gdb_trailing_start_r} onChange={set("gdb_trailing_start_r")} min={0.1} step={0.1} />
                </Field>
                <Field label="Trailing ATR Mult">
                  <NumberInput value={form.gdb_trailing_atr_mult} onChange={set("gdb_trailing_atr_mult")} min={0.1} step={0.1} />
                </Field>
                <Field label="Cancel Pending @ Session End">
                  <Toggle value={form.gdb_cancel_at_session_end} onChange={set("gdb_cancel_at_session_end")} />
                </Field>
              </div>
            </div>

            {/* Risk & filters */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Risk & Filters</p>
              <div className="space-y-2.5">
                <Field label="Max Spread (points)">
                  <NumberInput value={form.gdb_max_spread_points} onChange={set("gdb_max_spread_points")} min={1} />
                </Field>
                <Field label="Max Daily Loss (%)">
                  <NumberInput value={form.gdb_max_daily_loss_pct} onChange={set("gdb_max_daily_loss_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Equity Stop (%)">
                  <NumberInput value={form.gdb_equity_stop_pct} onChange={set("gdb_equity_stop_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Max Consecutive Losses">
                  <NumberInput value={form.gdb_max_consecutive_losses} onChange={set("gdb_max_consecutive_losses")} min={1} />
                </Field>
                <Field label="Cooldown (hours)">
                  <NumberInput value={form.gdb_cooldown_hours} onChange={set("gdb_cooldown_hours")} min={1} />
                </Field>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}