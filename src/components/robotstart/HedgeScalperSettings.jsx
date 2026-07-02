import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function HedgeScalperSettings({ visible, form, set, Field, NumberInput, Toggle }) {
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
              ⚡ Hedge Scalper (Dual-Direction)
            </p>
            <p className="text-[9px] text-white/25 leading-relaxed">
              Opens Buy and Sell simultaneously on the same pair. When one leg hits SL, the
              winning leg is closed — netting the difference. Set TP &gt; SL so trending moves
              profit while reversals break even minus spread.
            </p>

            {/* Leg targets */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">
                Leg Targets
              </p>
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
              </div>
              <p className="text-[9px] text-white/25 leading-relaxed mt-2">
                Profitable when TP &gt; SL: trend hits TP (+{form.hedge_scalp_tp_pips}) while the
                loser is capped at SL (−{form.hedge_scalp_sl_pips}). Net = +{form.hedge_scalp_tp_pips - form.hedge_scalp_sl_pips} pips per trend cycle.
              </p>
            </div>

            {/* Sizing */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">
                Sizing &amp; Pairs
              </p>
              <div className="space-y-2.5">
                <Field label="Lot Size per Leg">
                  <NumberInput
                    value={form.hedge_scalp_lot_size}
                    onChange={set("hedge_scalp_lot_size")}
                    min={0.01}
                    step={0.01}
                  />
                </Field>
                <Field label="Max Hedge Pairs">
                  <NumberInput
                    value={form.hedge_scalp_max_pairs}
                    onChange={set("hedge_scalp_max_pairs")}
                    min={1}
                  />
                </Field>
              </div>
            </div>

            {/* Behavior */}
            <div>
              <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">
                Behavior
              </p>
              <div className="space-y-2.5">
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
                When enabled, the winning leg is closed the moment the losing leg hits SL. Disable
                to let the winner run toward its own TP for maximum trend capture.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}