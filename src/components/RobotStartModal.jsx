import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play } from "lucide-react";

const STRATEGIES = ["Momentum Scalping", "Range Breakout", "Volatility Spike", "Hybrid Manual", "Auto (AI Select)"];
const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD"];
const MODES = ["Conservative", "Balanced", "Aggressive"];

const DEFAULT = {
  symbol: "XAUUSD",
  strategy: "Auto (AI Select)",
  trading_mode: "Balanced",
  lot_size: 0.01,
  risk_percentage: 1,
  stop_loss: 50,
  take_profit: 100,
  max_daily_trades: 5,
  stop_after_losses: 2,
  daily_profit_target: 100,
  daily_loss_limit: 50,
};

function Field({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-white/50 font-heading uppercase tracking-wider shrink-0 w-36">{label}</span>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, min, step = 1 }) {
  return (
    <input
      type="number"
      value={value}
      min={min ?? 0}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-24 text-right px-2 py-1.5 rounded-lg font-heading font-bold text-xs text-white bg-white/5 border border-white/10 focus:border-red-500/40 focus:outline-none"
    />
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1.5 rounded-lg font-heading font-bold text-xs text-white bg-white/5 border border-white/10 focus:border-red-500/40 focus:outline-none appearance-none text-right"
      style={{ background: "rgba(255,255,255,0.06)", minWidth: 96 }}
    >
      {options.map((o) => <option key={o} value={o} style={{ background: "#111" }}>{o}</option>)}
    </select>
  );
}

export default function RobotStartModal({ open, onClose, onStart }) {
  const [form, setForm] = useState({ ...DEFAULT });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await onStart(form);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="w-full max-w-md rounded-t-3xl overflow-hidden"
            style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none", maxHeight: "90vh", overflowY: "auto" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
              <div>
                <h2 className="font-heading font-black text-white text-sm uppercase tracking-widest">Start Robot</h2>
                <p className="text-[10px] text-white/30">Configure strategy &amp; risk before launch</p>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Section: Pair & Strategy */}
              <div>
                <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading mb-3">Pair &amp; Strategy</p>
                <div className="space-y-2.5">
                  <Field label="Symbol">
                    <SelectInput value={form.symbol} onChange={set("symbol")} options={PAIRS} />
                  </Field>
                  <Field label="Strategy">
                    <SelectInput value={form.strategy} onChange={set("strategy")} options={STRATEGIES} />
                  </Field>
                  <Field label="Trading Mode">
                    <SelectInput value={form.trading_mode} onChange={set("trading_mode")} options={MODES} />
                  </Field>
                </div>
              </div>

              {/* Section: Lot & Risk */}
              <div>
                <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading mb-3">Lot &amp; Risk</p>
                <div className="space-y-2.5">
                  <Field label="Lot Size">
                    <NumberInput value={form.lot_size} onChange={set("lot_size")} min={0.01} step={0.01} />
                  </Field>
                  <Field label="Risk %">
                    <NumberInput value={form.risk_percentage} onChange={set("risk_percentage")} min={0.1} step={0.1} />
                  </Field>
                </div>
              </div>

              {/* Section: SL / TP */}
              <div>
                <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading mb-3">Stop Loss &amp; Take Profit</p>
                <div className="space-y-2.5">
                  <Field label="Stop Loss (pips)">
                    <NumberInput value={form.stop_loss} onChange={set("stop_loss")} min={1} />
                  </Field>
                  <Field label="Take Profit (pips)">
                    <NumberInput value={form.take_profit} onChange={set("take_profit")} min={1} />
                  </Field>
                </div>
              </div>

              {/* Section: Daily Limits */}
              <div>
                <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading mb-3">Daily Limits</p>
                <div className="space-y-2.5">
                  <Field label="Max Daily Trades">
                    <NumberInput value={form.max_daily_trades} onChange={set("max_daily_trades")} min={1} />
                  </Field>
                  <Field label="Stop After Losses">
                    <NumberInput value={form.stop_after_losses} onChange={set("stop_after_losses")} min={1} />
                  </Field>
                  <Field label="Daily Profit Target ($)">
                    <NumberInput value={form.daily_profit_target} onChange={set("daily_profit_target")} min={0} />
                  </Field>
                  <Field label="Daily Loss Limit ($)">
                    <NumberInput value={form.daily_loss_limit} onChange={set("daily_loss_limit")} min={0} />
                  </Field>
                </div>
              </div>

              {error && (
                <div className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10">
                  <p className="text-[10px] text-red-400 font-heading">{error}</p>
                </div>
              )}

              {/* Launch */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleStart}
                disabled={loading}
                className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-heading font-black text-sm tracking-widest disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.95)", color: "#16a34a" }}
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-green-600/40 border-t-green-600 rounded-full animate-spin" />
                  : <><Play className="w-4 h-4 fill-current" /><span>LAUNCH ROBOT</span></>}
              </motion.button>

              <div style={{ height: "env(safe-area-inset-bottom, 16px)" }} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}