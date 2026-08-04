import React, { useState, useEffect, useCallback } from "react";
import { Save, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

const TIMEFRAME_OPTIONS = {
  trend: ["M15", "M30", "H1", "H4", "D1"],
  structure: ["M5", "M15", "M30", "H1"],
  entry: ["M1", "M5", "M15"],
};

const ENTRY_METHODS = [
  { value: "order_block_mid", label: "Order Block" },
  { value: "fvg_mid", label: "FVG" },
  { value: "supply_demand_mid", label: "Supply/Demand" },
  { value: "fib", label: "Fibonacci" },
  { value: "breakout_buffer", label: "Breakout Buffer" },
];

const TP_METHODS = [
  { value: "fixed_rr", label: "Fixed RR" },
  { value: "prev_swing", label: "Prev Swing" },
  { value: "next_liq", label: "Next Liquidity" },
  { value: "next_sr", label: "Next S/R" },
  { value: "partial", label: "Partial" },
];

const EXPIRATION_MODES = [
  { value: "candles", label: "Candles" },
  { value: "minutes", label: "Minutes" },
  { value: "session_end", label: "Session End" },
  { value: "structure_invalid", label: "Structure Invalid" },
];

const DEFAULTS = {
  symbols: "XAUUSD",
  trend_timeframe: "H1",
  structure_timeframe: "M15",
  entry_timeframe: "M5",
  risk_percentage: 1,
  min_signal_score: 70,
  min_rr: 2,
  default_rr: 2,
  entry_method: "order_block_mid",
  breakout_buffer_points: 5,
  sl_buffer_points: 5,
  max_sl_distance: 100,
  tp_method: "fixed_rr",
  tp1_at_r: 1,
  tp2_at_r: 2,
  partial_close_pct: 50,
  max_pending_orders: 3,
  max_open_positions: 2,
  max_trades_per_symbol: 1,
  max_lot_size: 0.5,
  max_daily_loss: 50,
  max_daily_profit: 200,
  max_spread: 30,
  stop_after_consecutive_losses: 2,
  cooldown_minutes: 30,
  expiration_mode: "candles",
  expiration_candles: 12,
  expiration_minutes: 720,
  lot_size_mode: "Auto Risk",
  fixed_lot_size: 0.01,
  break_even_enabled: true,
  trailing_stop: false,
  partial_profit: true,
  close_at_opposite_structure: true,
  cancel_remaining_after_activation: true,
  spread_filter: true,
  volatility_filter: true,
  atr_filter: true,
  news_filter: true,
  london_session: true,
  new_york_session: true,
  asian_session: false,
};

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/70">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
      </button>
      {open && <div className="px-3 pb-2 space-y-0.5">{children}</div>}
    </div>
  );
}

function NumberRow({ label, value, onChange, step = 1, min = 0, suffix }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/5">
      <span className="text-[10px] font-mono text-white/50 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        {suffix && <span className="text-[9px] font-mono text-white/30">{suffix}</span>}
        <input
          type="number"
          value={value ?? 0}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-20 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[10px] font-mono text-white text-right focus:outline-none focus:border-[#00FF41]/50"
        />
      </div>
    </div>
  );
}

function SelectRow({ label, value, options, onChange }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/5">
      <span className="text-[10px] font-mono text-white/50 uppercase tracking-wider">{label}</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[10px] font-mono text-white focus:outline-none focus:border-[#00FF41]/50 max-w-[140px]"
      >
        {options.map((opt) => (
          <option key={opt.value ?? opt} value={opt.value ?? opt} className="bg-black text-white">
            {opt.label ?? opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/5">
      <span className="text-[10px] font-mono text-white/50 uppercase tracking-wider">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-9 h-5 rounded-full transition-all relative ${value ? "bg-[#00FF41]/40" : "bg-white/10"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${value ? "left-4 bg-[#00FF41]" : "left-0.5 bg-white/40"}`} />
      </button>
    </div>
  );
}

export default function MarketStructureSettingsEditor({ settings, onUpdated }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (settings) setDraft({ ...settings });
  }, [settings]);

  const setField = useCallback((key, value) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const hasChanges = draft && settings && JSON.stringify(draft) !== JSON.stringify(settings);

  const handleSave = async () => {
    if (!draft || !hasChanges) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke("marketStructureScanner", {
        action: "settings",
        update: draft,
      });
      if (res?.data?.settings) {
        onUpdated(res.data.settings);
        toast({ title: "Settings Saved", description: "Scanner presets updated.", duration: 2000 });
      }
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft({ ...DEFAULTS });
    toast({ title: "Reset to Defaults", description: "Review and save to apply.", duration: 2000 });
  };

  if (!draft) return <div className="py-4 text-center text-[10px] font-mono text-white/25">Loading settings…</div>;

  const cfg = draft;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-1 text-[10px] font-mono text-white/50 uppercase tracking-wider"
      >
        <span>{saving ? "Saving…" : hasChanges ? "Unsaved changes — tap to edit" : "Tap to edit settings"}</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded ? (
        <>
          <Section title="Symbols & Timeframes" defaultOpen>
            <div className="flex justify-between items-center py-1.5 border-b border-white/5">
              <span className="text-[10px] font-mono text-white/50 uppercase tracking-wider">Symbols</span>
              <input
                type="text"
                value={cfg.symbols || "XAUUSD"}
                onChange={(e) => setField("symbols", e.target.value)}
                className="w-28 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[10px] font-mono text-white text-right focus:outline-none focus:border-[#00FF41]/50"
              />
            </div>
            <SelectRow label="Trend TF" value={cfg.trend_timeframe} options={TIMEFRAME_OPTIONS.trend.map(t => ({ value: t, label: t }))} onChange={(v) => setField("trend_timeframe", v)} />
            <SelectRow label="Structure TF" value={cfg.structure_timeframe} options={TIMEFRAME_OPTIONS.structure.map(t => ({ value: t, label: t }))} onChange={(v) => setField("structure_timeframe", v)} />
            <SelectRow label="Entry TF" value={cfg.entry_timeframe} options={TIMEFRAME_OPTIONS.entry.map(t => ({ value: t, label: t }))} onChange={(v) => setField("entry_timeframe", v)} />
          </Section>

          <Section title="Risk & Capital Protection" defaultOpen>
            <NumberRow label="Risk per Trade" value={cfg.risk_percentage} step={0.1} min={0} suffix="%" onChange={(v) => setField("risk_percentage", v)} />
            <NumberRow label="Min Signal Score" value={cfg.min_signal_score} min={0} suffix="/100" onChange={(v) => setField("min_signal_score", v)} />
            <NumberRow label="Min RR Ratio" value={cfg.min_rr} step={0.1} min={0} onChange={(v) => setField("min_rr", v)} />
            <NumberRow label="Max Daily Loss" value={cfg.max_daily_loss} min={0} suffix="$" onChange={(v) => setField("max_daily_loss", v)} />
            <NumberRow label="Max Daily Profit" value={cfg.max_daily_profit} min={0} suffix="$" onChange={(v) => setField("max_daily_profit", v)} />
            <NumberRow label="Max Spread" value={cfg.max_spread} min={0} suffix="pts" onChange={(v) => setField("max_spread", v)} />
            <NumberRow label="Stop After Losses" value={cfg.stop_after_consecutive_losses} min={0} onChange={(v) => setField("stop_after_consecutive_losses", v)} />
            <NumberRow label="Cooldown" value={cfg.cooldown_minutes} min={0} suffix="min" onChange={(v) => setField("cooldown_minutes", v)} />
          </Section>

          <Section title="Entry Strategy">
            <SelectRow label="Entry Method" value={cfg.entry_method} options={ENTRY_METHODS} onChange={(v) => setField("entry_method", v)} />
            <NumberRow label="Breakout Buffer" value={cfg.breakout_buffer_points} min={0} suffix="pts" onChange={(v) => setField("breakout_buffer_points", v)} />
            <NumberRow label="SL Buffer" value={cfg.sl_buffer_points} min={0} suffix="pts" onChange={(v) => setField("sl_buffer_points", v)} />
            <NumberRow label="Max SL Distance" value={cfg.max_sl_distance} min={0} suffix="pts" onChange={(v) => setField("max_sl_distance", v)} />
            <SelectRow label="Lot Size Mode" value={cfg.lot_size_mode} options={[{ value: "Fixed", label: "Fixed" }, { value: "Auto Risk", label: "Auto Risk" }]} onChange={(v) => setField("lot_size_mode", v)} />
            <NumberRow label="Fixed Lot Size" value={cfg.fixed_lot_size} step={0.01} min={0.01} onChange={(v) => setField("fixed_lot_size", v)} />
          </Section>

          <Section title="Take Profit">
            <SelectRow label="TP Method" value={cfg.tp_method} options={TP_METHODS} onChange={(v) => setField("tp_method", v)} />
            <NumberRow label="Default RR" value={cfg.default_rr} step={0.1} min={0} onChange={(v) => setField("default_rr", v)} />
            <NumberRow label="TP1 at R" value={cfg.tp1_at_r} step={0.1} min={0} onChange={(v) => setField("tp1_at_r", v)} />
            <NumberRow label="TP2 at R" value={cfg.tp2_at_r} step={0.1} min={0} onChange={(v) => setField("tp2_at_r", v)} />
            <NumberRow label="Partial Close" value={cfg.partial_close_pct} min={0} suffix="%" onChange={(v) => setField("partial_close_pct", v)} />
          </Section>

          <Section title="Position Management">
            <NumberRow label="Max Pending Orders" value={cfg.max_pending_orders} min={0} onChange={(v) => setField("max_pending_orders", v)} />
            <NumberRow label="Max Open Positions" value={cfg.max_open_positions} min={0} onChange={(v) => setField("max_open_positions", v)} />
            <NumberRow label="Max Per Symbol" value={cfg.max_trades_per_symbol} min={0} onChange={(v) => setField("max_trades_per_symbol", v)} />
            <NumberRow label="Max Lot Size" value={cfg.max_lot_size} step={0.01} min={0.01} onChange={(v) => setField("max_lot_size", v)} />
            <ToggleRow label="Break Even" value={cfg.break_even_enabled} onChange={(v) => setField("break_even_enabled", v)} />
            <ToggleRow label="Trailing Stop" value={cfg.trailing_stop} onChange={(v) => setField("trailing_stop", v)} />
            <ToggleRow label="Partial Profit" value={cfg.partial_profit} onChange={(v) => setField("partial_profit", v)} />
            <ToggleRow label="Close at Opp. Structure" value={cfg.close_at_opposite_structure} onChange={(v) => setField("close_at_opposite_structure", v)} />
            <ToggleRow label="Cancel After Activation" value={cfg.cancel_remaining_after_activation} onChange={(v) => setField("cancel_remaining_after_activation", v)} />
          </Section>

          <Section title="Order Expiration">
            <SelectRow label="Expiration Mode" value={cfg.expiration_mode} options={EXPIRATION_MODES} onChange={(v) => setField("expiration_mode", v)} />
            <NumberRow label="Exp Candles" value={cfg.expiration_candles} min={0} onChange={(v) => setField("expiration_candles", v)} />
            <NumberRow label="Exp Minutes" value={cfg.expiration_minutes} min={0} onChange={(v) => setField("expiration_minutes", v)} />
          </Section>

          <Section title="Filters & Sessions">
            <ToggleRow label="Spread Filter" value={cfg.spread_filter} onChange={(v) => setField("spread_filter", v)} />
            <ToggleRow label="Volatility Filter" value={cfg.volatility_filter} onChange={(v) => setField("volatility_filter", v)} />
            <ToggleRow label="ATR Filter" value={cfg.atr_filter} onChange={(v) => setField("atr_filter", v)} />
            <ToggleRow label="News Filter" value={cfg.news_filter} onChange={(v) => setField("news_filter", v)} />
            <div className="h-px bg-white/5 my-1" />
            <ToggleRow label="London Session" value={cfg.london_session} onChange={(v) => setField("london_session", v)} />
            <ToggleRow label="New York Session" value={cfg.new_york_session} onChange={(v) => setField("new_york_session", v)} />
            <ToggleRow label="Asian Session" value={cfg.asian_session} onChange={(v) => setField("asian_session", v)} />
          </Section>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex-1 h-10 rounded-xl flex items-center justify-center gap-2 font-mono font-bold tracking-wider text-xs disabled:opacity-30 transition-all"
              style={{
                background: "rgba(0,255,65,0.10)",
                color: "#00FF41",
                border: "1.5px solid rgba(0,255,65,0.4)",
                boxShadow: hasChanges ? "0 0 14px rgba(0,255,65,0.15)" : "none",
              }}
            >
              {saving ? <div className="w-3.5 h-3.5 border-2 border-[#00FF41]/30 border-t-[#00FF41] rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              SAVE PRESETS
            </button>
            <button
              onClick={handleReset}
              className="h-10 px-4 rounded-xl flex items-center justify-center gap-2 font-mono font-bold tracking-wider text-xs transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.6)",
                border: "1.5px solid rgba(255,255,255,0.12)",
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              RESET
            </button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="flex justify-between items-center py-0.5 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">Symbols</span>
            <span className="text-white font-bold">{cfg.symbols || "XAUUSD"}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">TFs</span>
            <span className="text-white font-bold">{cfg.trend_timeframe}/{cfg.structure_timeframe}/{cfg.entry_timeframe}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">Risk %</span>
            <span className="text-white font-bold">{cfg.risk_percentage}%</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">Min Score</span>
            <span className="text-white font-bold">{cfg.min_signal_score}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">Entry</span>
            <span className="text-white font-bold">{(cfg.entry_method || "order_block_mid").replace(/_/g, " ")}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">RR</span>
            <span className="text-white font-bold">1:{cfg.default_rr}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">Max Pending</span>
            <span className="text-white font-bold">{cfg.max_pending_orders}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider">Max Lot</span>
            <span className="text-white font-bold">{cfg.max_lot_size}</span>
          </div>
        </div>
      )}
    </div>
  );
}