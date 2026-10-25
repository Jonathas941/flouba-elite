import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function GoldMeanReversionSettings({ visible, form, set, Field, NumberInput, Toggle }) {
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
            <p className="text-[9px] uppercase tracking-[0.25em] text-amber-300 font-heading font-bold">
              ◆ Gold Mean Reversion
            </p>
            <p className="text-[9px] text-white/25 leading-relaxed -mt-2">
              XAUUSD H1 RSI(2) mean-reversion scalper. Entries on RSI(2) &lt; threshold and/or price touching the lower Bollinger Band (20, 2.5σ), filtered by H4 EMA200 trend. ATR-based TP/SL with time stop. Bi-directional (BUY oversold, SELL overbought). No grid, no martingale, no recovery.
            </p>

            {/* Core */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Core</p>
              <div className="space-y-2.5">
                <Field label="Lot Size">
                  <NumberInput value={form.gmrv_lot_size} onChange={set("gmrv_lot_size")} min={0.01} step={0.01} />
                </Field>
                <Field label="Max Open Trades">
                  <NumberInput value={form.gmrv_max_open_trades} onChange={set("gmrv_max_open_trades")} min={1} />
                </Field>
                <Field label="Max Trades / Day">
                  <NumberInput value={form.gmrv_max_trades_per_day} onChange={set("gmrv_max_trades_per_day")} min={1} />
                </Field>
              </div>
            </div>

            {/* Entry Signals */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Entry Signals</p>
              <div className="space-y-2.5">
                <Field label="RSI Period">
                  <NumberInput value={form.gmrv_rsi_period} onChange={set("gmrv_rsi_period")} min={1} />
                </Field>
                <Field label="RSI Threshold (BUY)">
                  <NumberInput value={form.gmrv_rsi_threshold} onChange={set("gmrv_rsi_threshold")} min={1} max={50} />
                </Field>
                <Field label="BB Period">
                  <NumberInput value={form.gmrv_bb_period} onChange={set("gmrv_bb_period")} min={5} />
                </Field>
                <Field label="BB Std Dev">
                  <NumberInput value={form.gmrv_bb_std} onChange={set("gmrv_bb_std")} min={0.5} step={0.1} />
                </Field>
                <Field label="Entry Mode">
                  <Toggle value={form.gmrv_entry_mode === "both"} onChange={(v) => set("gmrv_entry_mode")(v ? "both" : "rsi")} />
                </Field>
                <p className="text-[9px] text-white/25 leading-relaxed">
                  {form.gmrv_entry_mode === "both"
                    ? "Both RSI + BB touch required for entry."
                    : "RSI threshold only for entry."}
                </p>
              </div>
            </div>

            {/* Exit (ATR-based) */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Exit (ATR-based)</p>
              <div className="space-y-2.5">
                <Field label="ATR Period">
                  <NumberInput value={form.gmrv_atr_period} onChange={set("gmrv_atr_period")} min={1} />
                </Field>
                <Field label="TP (×ATR)">
                  <NumberInput value={form.gmrv_tp_atr_mult} onChange={set("gmrv_tp_atr_mult")} min={0.1} step={0.1} />
                </Field>
                <Field label="SL (×ATR)">
                  <NumberInput value={form.gmrv_sl_atr_mult} onChange={set("gmrv_sl_atr_mult")} min={0.1} step={0.1} />
                </Field>
                <Field label="Time Stop (bars)">
                  <NumberInput value={form.gmrv_max_bars} onChange={set("gmrv_max_bars")} min={1} />
                </Field>
                <p className="text-[9px] text-white/25 leading-relaxed">
                  Exit at market close after {form.gmrv_max_bars} bars if neither TP nor SL is hit.
                </p>
              </div>
            </div>

            {/* Trend Filter */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trend Filter (H4)</p>
              <div className="space-y-2.5">
                <Field label="Use H4 EMA200 Trend Filter">
                  <Toggle value={form.gmrv_trend_filter} onChange={set("gmrv_trend_filter")} />
                </Field>
                <Field label="EMA Period (H4)">
                  <NumberInput value={form.gmrv_ema200_h4_period} onChange={set("gmrv_ema200_h4_period")} min={10} />
                </Field>
                <p className="text-[9px] text-white/25 leading-relaxed">
                  BUY only when close &gt; EMA200(H4); SELL only when close &lt; EMA200(H4).
                </p>
              </div>
            </div>

            {/* Session & Cost */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Session & Cost</p>
              <div className="space-y-2.5">
                <Field label="Session Start (UTC hour)">
                  <NumberInput value={form.gmrv_session_start_hour} onChange={set("gmrv_session_start_hour")} min={0} max={23} />
                </Field>
                <Field label="Session End (UTC hour)">
                  <NumberInput value={form.gmrv_session_end_hour} onChange={set("gmrv_session_end_hour")} min={1} max={24} />
                </Field>
                <Field label="Round-Trip Cost ($/oz)">
                  <NumberInput value={form.gmrv_round_trip_cost} onChange={set("gmrv_round_trip_cost")} min={0} step={0.05} />
                </Field>
                <p className="text-[9px] text-white/25 leading-relaxed">
                  Spread + slippage cost subtracted from each trade's P&L.
                </p>
              </div>
            </div>

            {/* Trade Management */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trade Management</p>
              <div className="space-y-2.5">
                <Field label="Break-Even at 1R">
                  <Toggle value={form.gmrv_use_break_even} onChange={set("gmrv_use_break_even")} />
                </Field>
                <Field label="Partial Close 50% at 1R">
                  <Toggle value={form.gmrv_partial_close_50} onChange={set("gmrv_partial_close_50")} />
                </Field>
              </div>
            </div>

            {/* Risk & Filters */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Risk & Filters</p>
              <div className="space-y-2.5">
                <Field label="Max Spread (points)">
                  <NumberInput value={form.gmrv_max_spread_points} onChange={set("gmrv_max_spread_points")} min={1} />
                </Field>
                <Field label="Max Daily Loss (%)">
                  <NumberInput value={form.gmrv_max_daily_loss_pct} onChange={set("gmrv_max_daily_loss_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Equity Stop (%)">
                  <NumberInput value={form.gmrv_equity_stop_pct} onChange={set("gmrv_equity_stop_pct")} min={0.1} step={0.1} />
                </Field>
                <Field label="Max Consecutive Losses">
                  <NumberInput value={form.gmrv_max_consecutive_losses} onChange={set("gmrv_max_consecutive_losses")} min={1} />
                </Field>
                <Field label="Cooldown (hours)">
                  <NumberInput value={form.gmrv_cooldown_hours} onChange={set("gmrv_cooldown_hours")} min={1} />
                </Field>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}