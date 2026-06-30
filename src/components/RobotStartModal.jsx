import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STRATEGIES = [
  "Momentum Scalping",
  "Range Breakout",
  "Volatility Spike",
  "Hybrid Manual",
  "HFT Scalper",
  "Auto (AI Select)",
];
const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD"];
const MODES = ["Conservative", "Balanced", "Aggressive"];

const DEFAULT = {
  symbol: "XAUUSD",
  strategy: "Auto (AI Select)",
  trading_mode: "Balanced",
  // Lot & Risk
  lot_size: 0.01,
  risk_percentage: 1,
  lot_multiplier: 1,        // multiply lot on consecutive entries
  // SL / TP
  stop_loss: 50,
  take_profit: 100,
  // Daily limits
  max_daily_trades: 5,
  stop_after_losses: 2,
  daily_profit_target: 100,
  daily_loss_limit: 50,
  // HFT Scalper specific
  hft_max_trades: 10,
  hft_burst_points: 15,
  hft_basket_tp_pts: 150,
  hft_stop_loss_pts: 300,
  hft_use_break_even: true,
  hft_be_trigger: 50,
  hft_be_lock: 5,
  hft_trailing_dist: 50,
  hft_max_spread: 30,
  hft_ma_period: 50,
};

function Field({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-white/50 font-heading uppercase tracking-wider shrink-0 w-40">{label}</span>
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

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full flex items-center transition-colors shrink-0 ${value ? "bg-red-500" : "bg-white/10"}`}
    >
      <motion.div
        layout
        className="w-5 h-5 rounded-full bg-white shadow mx-0.5"
        animate={{ x: value ? 18 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    </button>
  );
}

function SectionLabel({ children }) {
  return <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading mb-3 mt-1">{children}</p>;
}

export default function RobotStartModal({ open, onClose, onStart }) {
  const [form, setForm] = useState({ ...DEFAULT });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load saved BotSettings on open
  useEffect(() => {
    if (!open) return;
    base44.entities.BotSettings.list().then((records) => {
      if (!records?.length) return;
      const s = records[0];
      setForm((prev) => ({
        ...prev,
        symbol: s.active_pair ?? prev.symbol,
        trading_mode: s.trading_mode ?? prev.trading_mode,
        lot_size: s.lot_size ?? prev.lot_size,
        risk_percentage: s.risk_percentage ?? prev.risk_percentage,
        stop_loss: s.stop_loss ?? prev.stop_loss,
        take_profit: s.take_profit ?? prev.take_profit,
        max_daily_trades: s.max_daily_trades ?? prev.max_daily_trades,
        stop_after_losses: s.stop_after_losses ?? prev.stop_after_losses,
        daily_profit_target: s.daily_profit_target ?? prev.daily_profit_target,
        daily_loss_limit: s.daily_loss_limit ?? prev.daily_loss_limit,
      }));
    }).catch(() => {});
  }, [open]);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const isHFT = form.strategy === "HFT Scalper";

  const handleStart = async () => {
    setLoading(true);
    setSaving(true);
    setError(null);
    try {
      // Persist common settings back to BotSettings
      const records = await base44.entities.BotSettings.list();
      const patch = {
        active_pair: form.symbol,
        trading_mode: form.trading_mode,
        lot_size: form.lot_size,
        risk_percentage: form.risk_percentage,
        stop_loss: form.stop_loss,
        take_profit: form.take_profit,
        max_daily_trades: form.max_daily_trades,
        stop_after_losses: form.stop_after_losses,
        daily_profit_target: form.daily_profit_target,
        daily_loss_limit: form.daily_loss_limit,
      };
      if (records?.length) {
        await base44.entities.BotSettings.update(records[0].id, patch);
      } else {
        await base44.entities.BotSettings.create(patch);
      }
      setSaving(false);
      await onStart(form);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
    setSaving(false);
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

              {/* Pair & Strategy */}
              <div>
                <SectionLabel>Pair &amp; Strategy</SectionLabel>
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

              {/* Lot & Risk */}
              <div>
                <SectionLabel>Lot &amp; Risk</SectionLabel>
                <div className="space-y-2.5">
                  <Field label="Lot Size">
                    <NumberInput value={form.lot_size} onChange={set("lot_size")} min={0.01} step={0.01} />
                  </Field>
                  <Field label="Risk %">
                    <NumberInput value={form.risk_percentage} onChange={set("risk_percentage")} min={0.1} step={0.1} />
                  </Field>
                  <Field label="Lot Multiplier">
                    <NumberInput value={form.lot_multiplier} onChange={set("lot_multiplier")} min={1} step={0.1} />
                  </Field>
                </div>
              </div>

              {/* SL / TP */}
              <div>
                <SectionLabel>Stop Loss &amp; Take Profit (pips)</SectionLabel>
                <div className="space-y-2.5">
                  <Field label="Stop Loss">
                    <NumberInput value={form.stop_loss} onChange={set("stop_loss")} min={1} />
                  </Field>
                  <Field label="Take Profit">
                    <NumberInput value={form.take_profit} onChange={set("take_profit")} min={1} />
                  </Field>
                </div>
              </div>

              {/* Daily Limits */}
              <div>
                <SectionLabel>Daily Limits</SectionLabel>
                <div className="space-y-2.5">
                  <Field label="Max Daily Trades">
                    <NumberInput value={form.max_daily_trades} onChange={set("max_daily_trades")} min={1} />
                  </Field>
                  <Field label="Stop After Losses">
                    <NumberInput value={form.stop_after_losses} onChange={set("stop_after_losses")} min={1} />
                  </Field>
                  <Field label="Profit Target ($)">
                    <NumberInput value={form.daily_profit_target} onChange={set("daily_profit_target")} min={0} />
                  </Field>
                  <Field label="Loss Limit ($)">
                    <NumberInput value={form.daily_loss_limit} onChange={set("daily_loss_limit")} min={0} />
                  </Field>
                </div>
              </div>

              {/* HFT Scalper Settings — only shown when that strategy is selected */}
              <AnimatePresence>
                {isHFT && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-4 space-y-4">
                      <p className="text-[9px] uppercase tracking-[0.25em] text-amber-400 font-heading font-bold">⚡ HFT Scalper Settings</p>

                      {/* Multi-trade stacking */}
                      <div>
                        <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trade Stacking</p>
                        <div className="space-y-2.5">
                          <Field label="Max Stacked Trades">
                            <NumberInput value={form.hft_max_trades} onChange={set("hft_max_trades")} min={1} />
                          </Field>
                          <Field label="Burst Trigger (pts)">
                            <NumberInput value={form.hft_burst_points} onChange={set("hft_burst_points")} min={1} />
                          </Field>
                          <Field label="Basket TP (pts)">
                            <NumberInput value={form.hft_basket_tp_pts} onChange={set("hft_basket_tp_pts")} min={1} />
                          </Field>
                        </div>
                      </div>

                      {/* Protection */}
                      <div>
                        <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Protection</p>
                        <div className="space-y-2.5">
                          <Field label="Hard SL (pts)">
                            <NumberInput value={form.hft_stop_loss_pts} onChange={set("hft_stop_loss_pts")} min={1} />
                          </Field>
                          <Field label="Max Spread (pts)">
                            <NumberInput value={form.hft_max_spread} onChange={set("hft_max_spread")} min={1} />
                          </Field>
                          <Field label="Trailing Dist (pts)">
                            <NumberInput value={form.hft_trailing_dist} onChange={set("hft_trailing_dist")} min={1} />
                          </Field>
                        </div>
                      </div>

                      {/* Break Even */}
                      <div>
                        <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Auto Break Even</p>
                        <div className="space-y-2.5">
                          <Field label="Enable Break Even">
                            <Toggle value={form.hft_use_break_even} onChange={set("hft_use_break_even")} />
                          </Field>
                          {form.hft_use_break_even && (
                            <>
                              <Field label="BE Trigger (pts)">
                                <NumberInput value={form.hft_be_trigger} onChange={set("hft_be_trigger")} min={1} />
                              </Field>
                              <Field label="BE Lock (pts)">
                                <NumberInput value={form.hft_be_lock} onChange={set("hft_be_lock")} min={0} />
                              </Field>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Trend filter */}
                      <div>
                        <p className="text-[8px] uppercase tracking-widest text-white/25 font-heading mb-2">Trend Filter</p>
                        <div className="space-y-2.5">
                          <Field label="EMA Period">
                            <NumberInput value={form.hft_ma_period} onChange={set("hft_ma_period")} min={5} />
                          </Field>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                  ? <>
                      <div className="w-4 h-4 border-2 border-green-600/40 border-t-green-600 rounded-full animate-spin" />
                      <span>{saving ? "SAVING..." : "LAUNCHING..."}</span>
                    </>
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