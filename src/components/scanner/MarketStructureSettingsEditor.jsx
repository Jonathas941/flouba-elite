import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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

function NumberField({ label, value, onChange, step = 1, min = 0 }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-white/5">
      <span className="text-white/35 uppercase tracking-wider text-[10px] font-mono">{label}</span>
      <input
        type="number"
        value={value ?? 0}
        step={step}
        min={min}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-20 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[10px] font-mono text-white text-right focus:outline-none focus:border-[#00FF41]/50"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-white/5">
      <span className="text-white/35 uppercase tracking-wider text-[10px] font-mono">{label}</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[10px] font-mono text-white focus:outline-none focus:border-[#00FF41]/50"
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

function ToggleField({ label, value, onChange }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-white/5">
      <span className="text-white/35 uppercase tracking-wider text-[10px] font-mono">{label}</span>
      <button
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
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = async (key, value) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("marketStructureScanner", {
        action: "settings",
        update: { [key]: value },
      });
      if (res?.data?.settings) onUpdated(res.data.settings);
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const cfg = settings || {};

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-1 text-[10px] font-mono text-white/50 uppercase tracking-wider"
      >
        <span>{saving ? "Saving…" : "Tap to edit settings"}</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="space-y-0.5">
          {/* Symbols */}
          <div className="flex justify-between items-center py-1 border-b border-white/5">
            <span className="text-white/35 uppercase tracking-wider text-[10px] font-mono">Symbols</span>
            <input
              type="text"
              value={cfg.symbols || "XAUUSD"}
              onChange={(e) => update("symbols", e.target.value)}
              className="w-28 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[10px] font-mono text-white text-right focus:outline-none focus:border-[#00FF41]/50"
            />
          </div>

          {/* Timeframes */}
          <SelectField label="Trend TF" value={cfg.trend_timeframe} options={TIMEFRAME_OPTIONS.trend.map(t => ({ value: t, label: t }))} onChange={(v) => update("trend_timeframe", v)} />
          <SelectField label="Structure TF" value={cfg.structure_timeframe} options={TIMEFRAME_OPTIONS.structure.map(t => ({ value: t, label: t }))} onChange={(v) => update("structure_timeframe", v)} />
          <SelectField label="Entry TF" value={cfg.entry_timeframe} options={TIMEFRAME_OPTIONS.entry.map(t => ({ value: t, label: t }))} onChange={(v) => update("entry_timeframe", v)} />

          {/* Risk */}
          <NumberField label="Risk %" value={cfg.risk_percentage} step={0.1} min={0} onChange={(v) => update("risk_percentage", v)} />
          <NumberField label="Min Score" value={cfg.min_signal_score} min={0} onChange={(v) => update("min_signal_score", v)} />
          <NumberField label="Min RR" value={cfg.min_rr} step={0.1} min={0} onChange={(v) => update("min_rr", v)} />
          <NumberField label="Default RR" value={cfg.default_rr} step={0.1} min={0} onChange={(v) => update("default_rr", v)} />

          {/* Entry */}
          <SelectField label="Entry Method" value={cfg.entry_method} options={ENTRY_METHODS} onChange={(v) => update("entry_method", v)} />
          <NumberField label="Breakout Buffer" value={cfg.breakout_buffer_points} min={0} onChange={(v) => update("breakout_buffer_points", v)} />
          <NumberField label="SL Buffer" value={cfg.sl_buffer_points} min={0} onChange={(v) => update("sl_buffer_points", v)} />
          <NumberField label="Max SL Dist" value={cfg.max_sl_distance} min={0} onChange={(v) => update("max_sl_distance", v)} />

          {/* Take Profit */}
          <SelectField label="TP Method" value={cfg.tp_method} options={TP_METHODS} onChange={(v) => update("tp_method", v)} />
          <NumberField label="TP1 at R" value={cfg.tp1_at_r} step={0.1} min={0} onChange={(v) => update("tp1_at_r", v)} />
          <NumberField label="TP2 at R" value={cfg.tp2_at_r} step={0.1} min={0} onChange={(v) => update("tp2_at_r", v)} />
          <NumberField label="Partial Close %" value={cfg.partial_close_pct} min={0} onChange={(v) => update("partial_close_pct", v)} />

          {/* Limits */}
          <NumberField label="Max Pending" value={cfg.max_pending_orders} min={0} onChange={(v) => update("max_pending_orders", v)} />
          <NumberField label="Max Open Pos" value={cfg.max_open_positions} min={0} onChange={(v) => update("max_open_positions", v)} />
          <NumberField label="Max Per Symbol" value={cfg.max_trades_per_symbol} min={0} onChange={(v) => update("max_trades_per_symbol", v)} />
          <NumberField label="Max Lot" value={cfg.max_lot_size} step={0.01} min={0.01} onChange={(v) => update("max_lot_size", v)} />
          <NumberField label="Daily Loss $" value={cfg.max_daily_loss} min={0} onChange={(v) => update("max_daily_loss", v)} />
          <NumberField label="Daily Profit $" value={cfg.max_daily_profit} min={0} onChange={(v) => update("max_daily_profit", v)} />
          <NumberField label="Max Spread" value={cfg.max_spread} min={0} onChange={(v) => update("max_spread", v)} />
          <NumberField label="Stop After Loss" value={cfg.stop_after_consecutive_losses} min={0} onChange={(v) => update("stop_after_consecutive_losses", v)} />
          <NumberField label="Cooldown Min" value={cfg.cooldown_minutes} min={0} onChange={(v) => update("cooldown_minutes", v)} />

          {/* Expiration */}
          <SelectField label="Expiration" value={cfg.expiration_mode} options={EXPIRATION_MODES} onChange={(v) => update("expiration_mode", v)} />
          <NumberField label="Exp Candles" value={cfg.expiration_candles} min={0} onChange={(v) => update("expiration_candles", v)} />
          <NumberField label="Exp Minutes" value={cfg.expiration_minutes} min={0} onChange={(v) => update("expiration_minutes", v)} />

          {/* Lot */}
          <SelectField label="Lot Mode" value={cfg.lot_size_mode} options={[{ value: "Fixed", label: "Fixed" }, { value: "Auto Risk", label: "Auto Risk" }]} onChange={(v) => update("lot_size_mode", v)} />
          <NumberField label="Fixed Lot" value={cfg.fixed_lot_size} step={0.01} min={0.01} onChange={(v) => update("fixed_lot_size", v)} />

          {/* Management */}
          <ToggleField label="Break Even" value={cfg.break_even_enabled} onChange={(v) => update("break_even_enabled", v)} />
          <ToggleField label="Trailing Stop" value={cfg.trailing_stop} onChange={(v) => update("trailing_stop", v)} />
          <ToggleField label="Partial Profit" value={cfg.partial_profit} onChange={(v) => update("partial_profit", v)} />
          <ToggleField label="Close Opp. Structure" value={cfg.close_at_opposite_structure} onChange={(v) => update("close_at_opposite_structure", v)} />
          <ToggleField label="Cancel After Activation" value={cfg.cancel_remaining_after_activation} onChange={(v) => update("cancel_remaining_after_activation", v)} />

          {/* Filters */}
          <ToggleField label="Spread Filter" value={cfg.spread_filter} onChange={(v) => update("spread_filter", v)} />
          <ToggleField label="Volatility Filter" value={cfg.volatility_filter} onChange={(v) => update("volatility_filter", v)} />
          <ToggleField label="ATR Filter" value={cfg.atr_filter} onChange={(v) => update("atr_filter", v)} />
          <ToggleField label="News Filter" value={cfg.news_filter} onChange={(v) => update("news_filter", v)} />

          {/* Sessions */}
          <ToggleField label="London Session" value={cfg.london_session} onChange={(v) => update("london_session", v)} />
          <ToggleField label="NY Session" value={cfg.new_york_session} onChange={(v) => update("new_york_session", v)} />
          <ToggleField label="Asian Session" value={cfg.asian_session} onChange={(v) => update("asian_session", v)} />
        </div>
      )}

      {!expanded && (
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