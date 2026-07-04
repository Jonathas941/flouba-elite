import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function GoldMorningRangeSettings({ visible, form, set, Field, NumberInput, Toggle }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 px-4 py-4 space-y-4">
            <p className="text-[9px] uppercase tracking-[0.25em] text-amber-300 font-heading font-bold">
              ⌁ Gold Morning Range Breakout
            </p>
            <p className="text-[9px] text-white/25 leading-relaxed -mt-2">
              XAUUSD morning range breakout. Builds the 08:00–09:30 ET Gold Morning Range, then trades only closed M5 breakouts (09:30–11:00 ET) confirmed by tick volume + ATR. Retest preferred, fixed 1:2 RR, max 1 open, 2 trades/day. No grid, no martingale, no recovery.
            </p>

            {/* Core */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Core</p>
              <div className="space-y-2.5">
                <Field label="Lot Size">
                  <NumberInput value={form.gmr_lot_size} onChange={set("gmr_lot_size")} min={0.01} step={0.01} />
                </Field>
                <Field label="Max Open Trades">
                  <NumberInput value={form.gmr_max_open_trades} onChange={set("gmr_max_open_trades")} min={1} />
                </Field>
                <Field label="Max Trades / Day">
                  <NumberInput value={form.gmr_max_trades_per_day} onChange={set("gmr_max_trades_per_day")} min={1} />
                </Field>
                <Field label="Risk Reward (fixed)">
                  <NumberInput value={form.gmr_risk_reward} onChange={set("gmr_risk_reward")} min={1} step={0.1} />
                </Field>
              </div>
            </div>

            {/* Breakout protection */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Breakout Protection</p>
              <div className="space-y-2.5">
                <Field label="SL Buffer (points)">
                  <NumberInput value={form.gmr_sl_buffer_points} onChange={set("gmr_sl_buffer_points")} min={0} />
                </Field>
                <Field label="Min Body (points)">
                  <NumberInput value={form.gmr_min_body_points} onChange={set("gmr_min_body_points")} min={0} />
                </Field>
                <Field label="Min Range (points)">
                  <NumberInput value={form.gmr_min_range_points} onChange={set("gmr_min_range_points")} min={0} />
                </Field>
                <Field label="Max Range (points)">
                  <NumberInput value={form.gmr_max_range_points} onChange={set("gmr_max_range_points")} min={0} />
                </Field>
              </div>
            </div>

            {/* Volume & retest */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Tick Volume & Retest</p>
              <div className="space-y-2.5">
                <Field label="Volume Filter">
                  <Toggle value={form.gmr_use_volume_filter} onChange={set("gmr_use_volume_filter")} />
                </Field>
                <Field label="Volume Threshold (× avg)">
                  <NumberInput value={form.gmr_volume_threshold_mult} onChange={set("gmr_volume_threshold_mult")} min={0.1} step={0.1} />
                </Field>
                <Field label="Require Retest">
                  <Toggle value={form.gmr_require_retest} onChange={set("gmr_require_retest")} />
                </Field>
                <Field label="Retest Buffer (points)">
                  <NumberInput value={form.gmr_retest_buffer_points} onChange={set("gmr_retest_buffer_points")} min={0} />
                </Field>
              </div>
            </div>

            {/* Volatility & news */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Volatility & News</p>
              <div className="space-y-2.5">
                <Field label="ATR Filter">
                  <Toggle value={form.gmr_use_atr_filter} onChange={set("gmr_use_atr_filter")} />
                </Field>
                <Field label="ATR Period">
                  <NumberInput value={form.gmr_atr_period} onChange={set("gmr_atr_period")} min={1} />
                </Field>
                <Field label="Min ATR">
                  <NumberInput value={form.gmr_min_atr} onChange={set("gmr_min_atr")} min={0} step={0.01} />
                </Field>
                <Field label="News Filter">
                  <Toggle value={form.gmr_use_news_filter} onChange={set("gmr_use_news_filter")} />
                </Field>
              </div>
            </div>

            {/* Trade management */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trade Management</p>
              <div className="space-y-2.5">
                <Field label="Break-Even at 1R">
                  <Toggle value={form.gmr_use_break_even} onChange={set("gmr_use_break_even")} />
                </Field>
                <Field label="Partial Close 50% @ 1R">
                  <Toggle value={form.gmr_partial_close_50} onChange={set("gmr_partial_close_50")} />
                </Field>
              </div>
            </div>

            {/* Risk & filters */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Risk & Filters</p>
              <div className="space-y-2.5">
                <Field label="Max Spread (points)">
                  <NumberInput value={form.gmr_max_spread_points} onChange={set("gmr_max_spread_points")} min={1} />
                </Field>
                <Field label="Max Daily Loss (%)">
                  <NumberInput value={form.gmr_max_daily_loss_pct} onChange={set("gmr_max_daily_loss_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Equity Stop (%)">
                  <NumberInput value={form.gmr_equity_stop_pct} onChange={set("gmr_equity_stop_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Max Consecutive Losses">
                  <NumberInput value={form.gmr_max_consecutive_losses} onChange={set("gmr_max_consecutive_losses")} min={1} />
                </Field>
                <Field label="Cooldown (hours)">
                  <NumberInput value={form.gmr_cooldown_hours} onChange={set("gmr_cooldown_hours")} min={1} />
                </Field>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}