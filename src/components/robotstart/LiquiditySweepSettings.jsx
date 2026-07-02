import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const HTF_OPTIONS = ["M15", "H1"];
const ENTRY_OPTIONS = ["M1", "M5"];

export default function LiquiditySweepSettings({ visible, form, set, Field, NumberInput, SelectInput, Toggle }) {
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
            <p className="text-[9px] uppercase tracking-[0.25em] text-emerald-400 font-heading font-bold">🎯 Liquidity Sweep Scalping Settings</p>

            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trend Filter (Higher Timeframe)</p>
              <div className="space-y-2.5">
                <Field label="HTF Chart">
                  <SelectInput value={form.liq_htf_timeframe} onChange={set("liq_htf_timeframe")} options={HTF_OPTIONS} />
                </Field>
                <Field label="Trend EMA Period">
                  <NumberInput value={form.liq_htf_ema_period} onChange={set("liq_htf_ema_period")} min={50} step={10} />
                </Field>
              </div>
              <p className="text-[9px] text-white/25 leading-relaxed mt-2">Only takes Buy above the EMA and Sell below it on the HTF chart.</p>
            </div>

            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Entry Trigger (Lower Timeframe)</p>
              <div className="space-y-2.5">
                <Field label="Entry Chart">
                  <SelectInput value={form.liq_entry_timeframe} onChange={set("liq_entry_timeframe")} options={ENTRY_OPTIONS} />
                </Field>
                <Field label="Use VWAP Confirmation">
                  <Toggle value={form.liq_use_vwap} onChange={set("liq_use_vwap")} />
                </Field>
              </div>
              <p className="text-[9px] text-white/25 leading-relaxed mt-2">Waits for a liquidity sweep (trick move) beyond a prior high/low, then a rejection back inside range before entering.</p>
            </div>

            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Momentum Exhaustion</p>
              <div className="space-y-2.5">
                <Field label="RSI Overbought">
                  <NumberInput value={form.liq_rsi_overbought} onChange={set("liq_rsi_overbought")} min={60} max={95} />
                </Field>
                <Field label="RSI Oversold">
                  <NumberInput value={form.liq_rsi_oversold} onChange={set("liq_rsi_oversold")} min={5} max={40} />
                </Field>
              </div>
            </div>

            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Timing &amp; News</p>
              <div className="space-y-2.5">
                <Field label="London–NY Overlap Only">
                  <Toggle value={form.liq_session_only} onChange={set("liq_session_only")} />
                </Field>
                <Field label="News Buffer (min)">
                  <NumberInput value={form.liq_news_buffer_minutes} onChange={set("liq_news_buffer_minutes")} min={0} />
                </Field>
              </div>
              <p className="text-[9px] text-white/25 leading-relaxed mt-2">Avoids opening new trades within this many minutes of high-impact news (CPI, NFP, FOMC). Dynamic SL (ATR-based) above is recommended for this strategy.</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}