import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const HEDGE_MODES = ["Same Pair", "Cross Pair", "Both"];
const TIMEFRAMES = ["M15", "H1"];

function PhaseLabel({ icon, children }) {
  return (
    <p className="text-[8px] uppercase tracking-[0.25em] text-white/25 font-heading mb-2">
      {icon} {children}
    </p>
  );
}

export default function HedgeScalperSettings({
  visible,
  form,
  set,
  Field,
  NumberInput,
  SelectInput,
  Toggle,
}) {
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
            <p className="text-[9px] uppercase tracking-[0.25em] text-indigo-400 font-heading font-bold">
              ⚡ Hedge Scalper (Multi-Phase)
            </p>
            <p className="text-[9px] text-white/25 leading-relaxed">
              Six-phase cycle: open with trend → close winners → hedge losers → scalp over hedge
              → reduce drawdown → prioritize best pairs. Repeats automatically.
            </p>

            {/* Phase 1: Entry — Trend Following */}
            <div>
              <PhaseLabel icon="📈">Phase 1 — Trend Entry</PhaseLabel>
              <div className="space-y-2.5">
                <Field label="Follow Trend First">
                  <Toggle
                    value={form.hedge_scalp_trend_entry}
                    onChange={set("hedge_scalp_trend_entry")}
                  />
                </Field>
                {form.hedge_scalp_trend_entry && (
                  <>
                    <Field label="Trend Timeframe">
                      <SelectInput
                        value={form.hedge_scalp_trend_timeframe}
                        onChange={set("hedge_scalp_trend_timeframe")}
                        options={TIMEFRAMES}
                      />
                    </Field>
                    <Field label="Trend EMA Period">
                      <NumberInput
                        value={form.hedge_scalp_trend_ema_period}
                        onChange={set("hedge_scalp_trend_ema_period")}
                        min={5}
                      />
                    </Field>
                  </>
                )}
              </div>
              <p className="text-[9px] text-white/25 leading-relaxed mt-2">
                Opens positions in the direction of the HTF trend. When the market moves against
                the entry, the EA transitions to hedging (Phase 3).
              </p>
            </div>

            {/* Phase 2: Close Winners */}
            <div>
              <PhaseLabel icon="🛑">Phase 2 — Close &amp; Protect</PhaseLabel>
              <div className="space-y-2.5">
                <Field label="TP per Leg (pips)">
                  <NumberInput
                    value={form.hedge_scalp_tp_pips}
                    onChange={set("hedge_scalp_tp_pips")}
                    min={1}
                  />
                </Field>
                <Field label="SL per Leg (pips)">
                  <NumberInput
                    value={form.hedge_scalp_sl_pips}
                    onChange={set("hedge_scalp_sl_pips")}
                    min={1}
                  />
                </Field>
                <Field label="Close Winner on Loser SL">
                  <Toggle
                    value={form.hedge_scalp_close_winner_on_sl}
                    onChange={set("hedge_scalp_close_winner_on_sl")}
                  />
                </Field>
                <Field label="Reopen Delay (sec)">
                  <NumberInput
                    value={form.hedge_scalp_reopen_delay_sec}
                    onChange={set("hedge_scalp_reopen_delay_sec")}
                    min={0}
                  />
                </Field>
              </div>
              <p className="text-[9px] text-white/25 leading-relaxed mt-2">
                If the prediction was right and the trade is profitable, the EA closes it at TP.
                When enabled, the winning leg is also closed the moment the losing leg hits SL.
              </p>
            </div>

            {/* Phase 3: Hedge Trades */}
            <div>
              <PhaseLabel icon="🔄">Phase 3 — Hedging</PhaseLabel>
              <div className="space-y-2.5">
                <Field label="Hedge Mode">
                  <SelectInput
                    value={form.hedge_scalp_hedge_mode}
                    onChange={set("hedge_scalp_hedge_mode")}
                    options={HEDGE_MODES}
                  />
                </Field>
                <Field label="Hedge Trigger (pips)">
                  <NumberInput
                    value={form.hedge_scalp_hedge_trigger_pips}
                    onChange={set("hedge_scalp_hedge_trigger_pips")}
                    min={1}
                  />
                </Field>
              </div>
              <p className="text-[9px] text-white/25 leading-relaxed mt-2">
                When price moves against the entry by this many pips, the EA starts hedging. Same
                Pair opens an opposite position on the same symbol; Cross Pair hedges with a
                correlated pair; Both uses either depending on correlation strength.
              </p>
            </div>

            {/* Phase 4: Scalping Over Hedge */}
            <div>
              <PhaseLabel icon="⚡">Phase 4 — Scalp Over Hedge</PhaseLabel>
              <div className="space-y-2.5">
                <Field label="Scalp During Hedge">
                  <Toggle
                    value={form.hedge_scalp_scalp_over_hedge}
                    onChange={set("hedge_scalp_scalp_over_hedge")}
                  />
                </Field>
                {form.hedge_scalp_scalp_over_hedge && (
                  <Field label="Scalp TP (pips)">
                    <NumberInput
                      value={form.hedge_scalp_scalp_tp_pips}
                      onChange={set("hedge_scalp_scalp_tp_pips")}
                      min={1}
                    />
                  </Field>
                )}
              </div>
              <p className="text-[9px] text-white/25 leading-relaxed mt-2">
                While hedging is active, the EA takes advantage of small market movements by
                scalping for quick pip gains alongside the hedge positions.
              </p>
            </div>

            {/* Phase 5: Drawdown Reduction */}
            <div>
              <PhaseLabel icon="📉">Phase 5 — Drawdown Reduction</PhaseLabel>
              <div className="space-y-2.5">
                <Field label="Auto-Reduce Drawdown">
                  <Toggle
                    value={form.hedge_scalp_drawdown_reduction}
                    onChange={set("hedge_scalp_drawdown_reduction")}
                  />
                </Field>
                {form.hedge_scalp_drawdown_reduction && (
                  <Field label="Close Ratio (pips profit / loser)">
                    <NumberInput
                      value={form.hedge_scalp_dd_close_ratio}
                      onChange={set("hedge_scalp_dd_close_ratio")}
                      min={1}
                    />
                  </Field>
                )}
              </div>
              <p className="text-[9px] text-white/25 leading-relaxed mt-2">
                When the EA makes profit, it starts clearing drawdown by closing losing orders one
                by one. Ratio = pips of profit needed to close one losing order.
              </p>
            </div>

            {/* Phase 6: Pair Prioritization */}
            <div>
              <PhaseLabel icon="🎯">Phase 6 — Pair Priority</PhaseLabel>
              <div className="space-y-2.5">
                <Field label="Auto-Prioritize Pairs">
                  <Toggle
                    value={form.hedge_scalp_pair_priority}
                    onChange={set("hedge_scalp_pair_priority")}
                  />
                </Field>
                {form.hedge_scalp_pair_priority && (
                  <>
                    <Field label="Max Hedge Pairs">
                      <NumberInput
                        value={form.hedge_scalp_max_pairs}
                        onChange={set("hedge_scalp_max_pairs")}
                        min={1}
                      />
                    </Field>
                    <Field label="Lookback Trades">
                      <NumberInput
                        value={form.hedge_scalp_priority_lookback_trades}
                        onChange={set("hedge_scalp_priority_lookback_trades")}
                        min={5}
                      />
                    </Field>
                  </>
                )}
              </div>
              <p className="text-[9px] text-white/25 leading-relaxed mt-2">
                Automatically trades more on profitable pairs and less on losing pairs based on
                recent performance over the lookback window.
              </p>
            </div>

            {/* Sizing */}
            <div>
              <PhaseLabel icon="⚖️">Sizing</PhaseLabel>
              <div className="space-y-2.5">
                <Field label="Lot Size per Leg">
                  <NumberInput
                    value={form.hedge_scalp_lot_size}
                    onChange={set("hedge_scalp_lot_size")}
                    min={0.01}
                    step={0.01}
                  />
                </Field>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}