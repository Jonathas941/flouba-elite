import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import RiskDisclaimer from "@/components/RiskDisclaimer";

const STRATEGIES = [
  "Momentum Scalping",
  "Range Breakout",
  "Volatility Spike",
  "Hybrid Manual",
  "HFT Scalper",
  "Grid Trading",
  "Auto (AI Select)",
];
const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD"];
const MODES = ["Conservative", "Balanced", "Aggressive"];

// Aggressive = more concurrent trades + bigger lots. Conservative = fewer trades + smaller lots.
const MODE_PRESETS = {
  Conservative: { max_concurrent_trades: 1, lot_size: 0.01 },
  Balanced:     { max_concurrent_trades: 2, lot_size: 0.02 },
  Aggressive:   { max_concurrent_trades: 5, lot_size: 0.05 },
};

const DEFAULT = {
  symbol: "XAUUSD",
  strategy: "Auto (AI Select)",
  trading_mode: "Balanced",
  // Lot & Risk
  lot_size: 0.02,
  max_concurrent_trades: 2,
  risk_percentage: 1,
  lot_multiplier: 1,        // multiply lot on consecutive entries
  // SL / TP
  stop_loss: 50,
  take_profit: 100,
  dynamic_stop_loss: false, // scale stop loss with live ATR instead of a fixed value
  atr_sl_multiplier: 2,
  // Daily limits
  max_daily_trades: 999999, // unlimited — daily trade cap removed
  stop_after_losses: 2,
  daily_profit_target: 100,
  daily_loss_limit: 50,
  // HFT Scalper specific — tuned for frequent small in/out positions, not trend-riding
  hft_max_trades: 15,
  hft_burst_points: 8,
  hft_basket_tp_pts: 60,
  hft_stop_loss_pts: 150,
  hft_use_break_even: true,
  hft_be_trigger: 20,
  hft_be_lock: 3,
  hft_trailing_dist: 15,
  hft_max_spread: 20,
  hft_ma_period: 20,
  // Grid Trading specific — buy/sell levels stacked at fixed distance from price
  grid_distance_pips: 10,
  grid_max_levels: 5,
  // Equity Guard — hard-stop that force-closes all trades if equity falls too low
  equity_guard_enabled: true,
  equity_guard_min_equity_pct: 50,
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
  const [atrPreview, setAtrPreview] = useState(null);

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
        max_concurrent_trades: s.max_concurrent_trades ?? prev.max_concurrent_trades,
        risk_percentage: s.risk_percentage ?? prev.risk_percentage,
        stop_loss: s.stop_loss ?? prev.stop_loss,
        take_profit: s.take_profit ?? prev.take_profit,
        stop_after_losses: s.stop_after_losses ?? prev.stop_after_losses,
        daily_profit_target: s.daily_profit_target ?? prev.daily_profit_target,
        daily_loss_limit: s.daily_loss_limit ?? prev.daily_loss_limit,
        grid_distance_pips: s.grid_distance_pips ?? prev.grid_distance_pips,
        grid_max_levels: s.grid_max_levels ?? prev.grid_max_levels,
        equity_guard_enabled: s.equity_guard_enabled ?? prev.equity_guard_enabled,
        equity_guard_min_equity_pct: s.equity_guard_min_equity_pct ?? prev.equity_guard_min_equity_pct,
      }));
    }).catch(() => {});
  }, [open]);

  // Fetch live ATR to preview the volatility-adjusted stop loss
  useEffect(() => {
    if (!open || !form.dynamic_stop_loss) { setAtrPreview(null); return; }
    mt5Api.scannerStatus().then((res) => {
      const atr = res?.ok && res?.data?.scanner?.indicators?.atr_14;
      setAtrPreview(atr || null);
    }).catch(() => setAtrPreview(null));
  }, [open, form.dynamic_stop_loss, form.symbol]);

  const dynamicSlPoints = atrPreview ? Math.round(atrPreview * form.atr_sl_multiplier * 10) : null;

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  // Aggressive/Conservative mode auto-scales lot size and max concurrent trades
  const setTradingMode = (mode) => setForm((f) => ({ ...f, trading_mode: mode, ...MODE_PRESETS[mode] }));

  const isHFT = form.strategy === "HFT Scalper";
  const isGrid = form.strategy === "Grid Trading";

  const handleStart = async () => {
    setLoading(true);
    setSaving(true);
    setError(null);
    try {
      // If dynamic (ATR-based) SL is on, resolve the fixed pip value to send to the robot now
      // Apply the lot multiplier to the base lot size so bigger lots (and faster balance growth) actually get sent
      const multipliedLotSize = Math.round(form.lot_size * (form.lot_multiplier || 1) * 100) / 100;
      const finalForm = {
        ...form,
        ...(form.dynamic_stop_loss && dynamicSlPoints ? { stop_loss: dynamicSlPoints } : {}),
        lot_size: multipliedLotSize,
      };

      // Persist common settings back to BotSettings
      const records = await base44.entities.BotSettings.list();
      const patch = {
        active_pair: finalForm.symbol,
        trading_mode: finalForm.trading_mode,
        lot_size: finalForm.lot_size,
        max_concurrent_trades: finalForm.max_concurrent_trades,
        risk_percentage: finalForm.risk_percentage,
        stop_loss: finalForm.stop_loss,
        take_profit: finalForm.take_profit,
        max_daily_trades: form.max_daily_trades,
        stop_after_losses: form.stop_after_losses, // max_daily_trades kept unlimited, no UI control
        daily_profit_target: form.daily_profit_target,
        daily_loss_limit: form.daily_loss_limit,
        grid_distance_pips: form.grid_distance_pips,
        grid_max_levels: form.grid_max_levels,
        equity_guard_enabled: form.equity_guard_enabled,
        equity_guard_min_equity_pct: form.equity_guard_min_equity_pct,
      };
      if (records?.length) {
        await base44.entities.BotSettings.update(records[0].id, patch);
      } else {
        await base44.entities.BotSettings.create(patch);
      }
      setSaving(false);
      await onStart(finalForm);
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
                    <SelectInput value={form.trading_mode} onChange={setTradingMode} options={MODES} />
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
                  <Field label="Max Concurrent Trades">
                    <NumberInput value={form.max_concurrent_trades} onChange={set("max_concurrent_trades")} min={1} />
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
                  <Field label="Dynamic SL (ATR-based)">
                    <Toggle value={form.dynamic_stop_loss} onChange={set("dynamic_stop_loss")} />
                  </Field>
                  {form.dynamic_stop_loss ? (
                    <Field label="ATR Multiplier">
                      <NumberInput value={form.atr_sl_multiplier} onChange={set("atr_sl_multiplier")} min={0.5} step={0.5} />
                    </Field>
                  ) : (
                    <Field label="Stop Loss">
                      <NumberInput value={form.stop_loss} onChange={set("stop_loss")} min={1} />
                    </Field>
                  )}
                  <Field label="Take Profit">
                    <NumberInput value={form.take_profit} onChange={set("take_profit")} min={1} />
                  </Field>
                </div>
                {form.dynamic_stop_loss && (
                  <p className="text-[9px] text-white/25 leading-relaxed mt-2">
                    {dynamicSlPoints
                      ? `Live ATR${atrPreview ? ` (${atrPreview.toFixed(3)})` : ""} → Stop Loss ≈ ${dynamicSlPoints} pips. Recalculated at launch.`
                      : "Fetching live volatility (ATR)…"}
                  </p>
                )}
              </div>

              {/* Daily Limits */}
              <div>
                <SectionLabel>Daily Limits</SectionLabel>
                <div className="space-y-2.5">
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

              {/* Equity Guard — hard-stop protection, always visible */}
              <div className="rounded-2xl border border-red-500/25 bg-red-500/5 px-4 py-4 space-y-2.5">
                <p className="text-[9px] uppercase tracking-[0.25em] text-red-400 font-heading font-bold">🛑 Equity Guard (Hard-Stop)</p>
                <Field label="Enable Equity Guard">
                  <Toggle value={form.equity_guard_enabled} onChange={set("equity_guard_enabled")} />
                </Field>
                {form.equity_guard_enabled && (
                  <Field label="Min Equity (% of Balance)">
                    <NumberInput value={form.equity_guard_min_equity_pct} onChange={set("equity_guard_min_equity_pct")} min={1} max={99} />
                  </Field>
                )}
                <p className="text-[9px] text-white/25 leading-relaxed">Force-closes all trades and pauses the robot if equity drops below this % of balance.</p>
              </div>

              {/* Grid Trading Settings — only shown when that strategy is selected */}
              <AnimatePresence>
                {isGrid && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-sky-500/25 bg-sky-500/5 px-4 py-4 space-y-2.5">
                      <p className="text-[9px] uppercase tracking-[0.25em] text-sky-400 font-heading font-bold">▦ Grid Trading Settings</p>
                      <Field label="Grid Distance (pips)">
                        <NumberInput value={form.grid_distance_pips} onChange={set("grid_distance_pips")} min={1} />
                      </Field>
                      <Field label="Max Grid Levels">
                        <NumberInput value={form.grid_max_levels} onChange={set("grid_max_levels")} min={1} />
                      </Field>
                      <p className="text-[9px] text-white/25 leading-relaxed">Opens Buy/Sell orders at fixed distances from price and stacks further positions as each level is hit. Equity Guard is strongly recommended with this strategy.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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

              <RiskDisclaimer />

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