import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import RiskDisclaimer from "@/components/RiskDisclaimer";
import LiquiditySweepSettings from "@/components/robotstart/LiquiditySweepSettings";
import AutoScheduleSettings from "@/components/robotstart/AutoScheduleSettings";
import HedgeScalperSettings from "@/components/robotstart/HedgeScalperSettings";
import TrendFilterSettings from "@/components/robotstart/TrendFilterSettings";
import SwingPullbackSettings from "@/components/robotstart/SwingPullbackSettings";
import EmaTrendRecoverySettings from "@/components/robotstart/EmaTrendRecoverySettings";
import HybridConfluenceSettings from "@/components/robotstart/HybridConfluenceSettings";
import NqKillZoneSettings from "@/components/robotstart/NqKillZoneSettings";
import MsBosRetestSettings from "@/components/robotstart/MsBosRetestSettings";
import OrderflowOpeningRangeSettings from "@/components/robotstart/OrderflowOpeningRangeSettings";
import GoldMorningRangeSettings from "@/components/robotstart/GoldMorningRangeSettings";
import GoldDailyBreakoutSettings from "@/components/robotstart/GoldDailyBreakoutSettings";
import PyramidingSettings from "@/components/robotstart/PyramidingSettings";
import CollapsibleSection from "@/components/robotstart/CollapsibleSection";
import { Field, NumberInput, SelectInput, Toggle } from "@/components/robotstart/FormControls";
import {
  STRATEGIES, PAIRS, MODES, MENTALITIES, MODE_PRESETS, DEFAULT,
  FORM_ONLY_KEYS, LOCKED_ON,
} from "@/components/robotstart/constants";

const strategyFlags = (s) => ({
  isHFT: s === "HFT Scalper",
  isGrid: s === "Grid Trading",
  isLiquiditySweep: s === "Liquidity Sweep Scalping",
  isHedgeScalper: s === "Hedge Scalper",
  isSwingPullback: s === "Swing Trend Pullback Continuation 2026",
  isTpr: s === "EMA Trend Progressive Recovery",
  isHybrid: s === "Hybrid Confluence Mode",
  isNqKz: s === "NQ London Kill Zone Breakout",
  isMsBos: s === "Market Structure BOS Retest Scalper",
  isOfOr: s === "Orderflow Opening Range Breakout",
  isGmr: s === "Gold Morning Range Breakout",
  isGdb: s === "Gold Daily Breakout",
});

// Merge saved BotSettings record into the form default — generic loop over DEFAULT keys.
function mergeSavedSettings(prev, s) {
  const merged = { ...prev };
  for (const key of Object.keys(DEFAULT)) {
    if (FORM_ONLY_KEYS.has(key)) continue;
    if (s[key] != null) merged[key] = s[key];
  }
  // BotSettings stores the pair as active_pair; form uses symbol.
  if (s.active_pair != null) merged.symbol = s.active_pair;
  return merged;
}

// Build the BotSettings patch from the current form — generic loop with locked-field overrides.
function buildPatch(form) {
  const patch = {};
  for (const key of Object.keys(DEFAULT)) {
    if (FORM_ONLY_KEYS.has(key)) continue;
    if (key in LOCKED_ON) { patch[key] = LOCKED_ON[key]; continue; }
    // form.symbol → BotSettings.active_pair
    patch[key === "symbol" ? "active_pair" : key] = form[key];
  }
  return patch;
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
      setForm((prev) => mergeSavedSettings(prev, records[0]));
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

  const flags = strategyFlags(form.strategy);

  const handleStart = async () => {
    setLoading(true);
    setSaving(true);
    setError(null);
    try {
      // If dynamic (ATR-based) SL is on, resolve the fixed pip value to send to the robot now
      const finalForm = {
        ...form,
        ...(form.dynamic_stop_loss && dynamicSlPoints ? { stop_loss: dynamicSlPoints } : {}),
      };

      // Persist common settings back to BotSettings
      const records = await base44.entities.BotSettings.list();
      const patch = buildPatch(form);
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
          className="fixed inset-0 z-50 overflow-y-auto"
          style={{ background: "#050505" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="w-full max-w-md mx-auto min-h-full flex flex-col"
            style={{ background: "#050505" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
              <div>
                <h2 className="font-heading font-black text-white text-sm uppercase tracking-widest">Start Robot</h2>
                <p className="text-[10px] text-white/30">Strategy &amp; risk</p>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">

              <CollapsibleSection title="Pair & Strategy" defaultOpen={true}>
                <div className="space-y-2.5">
                  <Field label="Multi-Pair Auto-Select">
                    <Toggle value={form.multi_pair_enabled} onChange={set("multi_pair_enabled")} />
                  </Field>
                  {form.multi_pair_enabled ? (
                    <>
                      <Field label="Number of Pairs">
                        <NumberInput value={form.multi_pair_count} onChange={set("multi_pair_count")} min={2} max={8} />
                      </Field>
                      <p className="text-[9px] text-white/25 leading-relaxed">
                        AI scans all available pairs and auto-selects the best {form.multi_pair_count} for concurrent multi-pair trading.
                      </p>
                    </>
                  ) : (
                    <Field label="Symbol">
                      <SelectInput value={form.symbol} onChange={set("symbol")} options={PAIRS} />
                    </Field>
                  )}
                  <Field label="Strategy">
                    <SelectInput value={form.strategy} onChange={set("strategy")} options={STRATEGIES} />
                  </Field>
                  <Field label="Trading Mode">
                    <SelectInput value={form.trading_mode} onChange={setTradingMode} options={MODES} />
                  </Field>
                  <Field label="Bot Mentality">
                    <SelectInput value={form.bot_mentality} onChange={set("bot_mentality")} options={MENTALITIES} />
                  </Field>
                  <p className="text-[9px] text-white/25 leading-relaxed">
                    {form.bot_mentality === "Basic"
                      ? "Basic: patient, selective, defensive. Capital protection first."
                      : "Premium: aggressive execution with controlled risk."}
                  </p>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Lot & Risk" defaultOpen={false}>
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
                  <Field label="Multiplier Equity Ratio">
                    <NumberInput value={form.multiplier_min_equity_ratio} onChange={set("multiplier_min_equity_ratio")} min={1} step={0.5} />
                  </Field>
                  <Field label="Auto Multiplier">
                    <Toggle value={form.auto_multiplier_enabled} onChange={set("auto_multiplier_enabled")} />
                  </Field>
                  <p className="text-[9px] text-white/25 leading-relaxed">
                    {form.auto_multiplier_enabled
                      ? "Auto: compounding activates only after proven profitability."
                      : "Multiplier activates when equity reaches this ratio × balance."}
                  </p>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Stop Loss & Take Profit" defaultOpen={false}>
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
                    {dynamicSlPoints ? `SL ≈ ${dynamicSlPoints} pips (live ATR).` : "Fetching live ATR…"}
                  </p>
                )}
              </CollapsibleSection>

              <CollapsibleSection title="📈 Pyramiding & Trailing TP" defaultOpen={false}>
                <PyramidingSettings
                  form={form}
                  set={set}
                  Field={Field}
                  NumberInput={NumberInput}
                  SelectInput={SelectInput}
                  Toggle={Toggle}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Daily Limits" defaultOpen={false}>
                <div className="space-y-2.5">
                  <Field label="Stop After Losses">
                    <NumberInput value={form.stop_after_losses} onChange={set("stop_after_losses")} min={1} />
                  </Field>
                  <Field label="Daily Profit Target">
                    <Toggle value={form.daily_profit_target_enabled} onChange={set("daily_profit_target_enabled")} />
                  </Field>
                  {form.daily_profit_target_enabled && (
                    <>
                      <Field label="Target Mode">
                        <SelectInput value={form.daily_profit_target_mode} onChange={set("daily_profit_target_mode")} options={["Fixed", "Auto"]} />
                      </Field>
                      {form.daily_profit_target_mode === "Fixed" ? (
                        <>
                          <Field label="Target Amount ($)">
                            <NumberInput value={form.daily_profit_target_amount} onChange={set("daily_profit_target_amount")} min={0} step={10} />
                          </Field>
                          <Field label="Target % (Balance)">
                            <NumberInput value={form.daily_profit_target_percent} onChange={set("daily_profit_target_percent")} min={0} max={100} step={0.5} />
                          </Field>
                        </>
                      ) : (
                        <p className="text-[9px] text-white/25 leading-relaxed">
                          Bot sets the target from market conditions (regime + volatility + balance).
                        </p>
                      )}
                      <Field label="Stop at Target">
                        <Toggle value={form.stop_trading_at_daily_target} onChange={set("stop_trading_at_daily_target")} />
                      </Field>
                      <p className="text-[9px] text-white/25 leading-relaxed">
                        {form.daily_profit_target_mode === "Auto"
                          ? "Pauses at the auto-computed session profit."
                          : `Pauses at ${form.daily_profit_target_percent > 0 ? `${form.daily_profit_target_percent}%` : `$${form.daily_profit_target_amount}`} session profit.`}
                      </p>
                      <Field label="Cooldown (min)">
                        <NumberInput value={form.session_cooldown_minutes} onChange={set("session_cooldown_minutes")} min={0} step={5} />
                      </Field>
                      <p className="text-[9px] text-white/25 leading-relaxed">
                        Waits this long after hitting target before resuming.
                      </p>
                    </>
                  )}
                  <Field label="Loss Limit ($)">
                    <NumberInput value={form.daily_loss_limit} onChange={set("daily_loss_limit")} min={0} />
                  </Field>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="🛑 Equity Guard (Hard-Stop)" defaultOpen={false} accent="red">
                <div className="space-y-2.5">
                  <Field label="Enable Equity Guard">
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-green-400" />
                      <div className="w-11 h-6 rounded-full bg-green-500 flex items-center pointer-events-none">
                        <div className="w-5 h-5 rounded-full bg-white shadow ml-[22px]" />
                      </div>
                    </div>
                  </Field>
                  {form.equity_guard_enabled && (
                    <Field label="Min Equity (% of Balance)">
                      <NumberInput value={form.equity_guard_min_equity_pct} onChange={set("equity_guard_min_equity_pct")} min={1} max={99} />
                    </Field>
                  )}
                  <p className="text-[9px] text-white/25 leading-relaxed">Closes all trades if equity drops below this %.</p>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Trend Filter" defaultOpen={false} accent="blue">
                <TrendFilterSettings
                  form={form}
                  set={set}
                  Field={Field}
                  NumberInput={NumberInput}
                  SelectInput={SelectInput}
                  Toggle={Toggle}
                />
              </CollapsibleSection>

              {/* Grid Trading Settings — only shown when that strategy is selected */}
              <AnimatePresence>
                {flags.isGrid && (
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
                      <p className="text-[9px] text-white/25 leading-relaxed">Stacks Buy/Sell orders at fixed price intervals.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <LiquiditySweepSettings
                visible={flags.isLiquiditySweep}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              <HedgeScalperSettings
                visible={flags.isHedgeScalper}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              <SwingPullbackSettings
                visible={flags.isSwingPullback}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              <EmaTrendRecoverySettings
                visible={flags.isTpr}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              <HybridConfluenceSettings
                visible={flags.isHybrid}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              <NqKillZoneSettings
                visible={flags.isNqKz}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                Toggle={Toggle}
              />

              <MsBosRetestSettings
                visible={flags.isMsBos}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                SelectInput={SelectInput}
                Toggle={Toggle}
              />

              <OrderflowOpeningRangeSettings
                visible={flags.isOfOr}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                Toggle={Toggle}
              />

              <GoldMorningRangeSettings
                visible={flags.isGmr}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                Toggle={Toggle}
              />

              <GoldDailyBreakoutSettings
                visible={flags.isGdb}
                form={form}
                set={set}
                Field={Field}
                NumberInput={NumberInput}
                Toggle={Toggle}
              />

              {/* HFT Scalper Settings — only shown when that strategy is selected */}
              <AnimatePresence>
                {flags.isHFT && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-4 space-y-4">
                      <p className="text-[9px] uppercase tracking-[0.25em] text-amber-400 font-heading font-bold">⚡ HFT Scalper Settings</p>

                      {/* Multi-trade stacking */}
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

                      {/* Break Even */}
                      <div className="space-y-2.5">
                        <Field label="Break Even">
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

                      {/* Trend filter */}
                      <div className="space-y-2.5">
                        <Field label="EMA Period">
                          <NumberInput value={form.hft_ma_period} onChange={set("hft_ma_period")} min={5} />
                        </Field>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <CollapsibleSection title="Auto Schedule" defaultOpen={false} accent="purple">
                <AutoScheduleSettings
                  form={form}
                  set={set}
                  Field={Field}
                  Toggle={Toggle}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Risk Disclaimer" defaultOpen={false}>
                <RiskDisclaimer />
              </CollapsibleSection>

              {error && (
                <div className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10">
                  <p className="text-[10px] text-red-400 font-heading">{error}</p>
                </div>
              )}
            </div>

            {/* Launch */}
            <div className="px-5 pt-3 pb-8 border-t border-white/5 shrink-0 sticky bottom-0"
              style={{ background: "#050505" }}
            >
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}