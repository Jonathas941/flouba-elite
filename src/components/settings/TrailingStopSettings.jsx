import React from "react";
import GlassCard from "@/components/GlassCard";
import { SegmentRow } from "@/components/settings/SettingRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

export default function TrailingStopSettings({ s, set }) {
  const num = (key, label) => (
    <div>
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={s[key] ?? ""}
        onChange={(e) => set(key, parseFloat(e.target.value) || 0)}
        className="bg-white/5 border-red-500/20 rounded-xl h-11 mt-1"
      />
    </div>
  );

  return (
    <GlassCard>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Trailing Stop</p>

      <SegmentRow
        label="Trail Mode"
        options={["off", "atr", "fixed"]}
        value={s.trail_mode || "atr"}
        onChange={(v) => set("trail_mode", v)}
      />

      <div className="mt-3">
        <SegmentRow
          label="Trail Start"
          options={["after_tp1", "immediately"]}
          value={s.trail_start || "after_tp1"}
          onChange={(v) => set("trail_start", v)}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {num("trail_atr_multiplier", "ATR Multiplier")}
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">ATR Timeframe</Label>
          <SegmentRow
            options={["M1", "M5", "M15", "M30", "H1"]}
            value={s.trail_atr_timeframe || "M5"}
            onChange={(v) => set("trail_atr_timeframe", v)}
          />
        </div>
        {num("trail_fixed_distance", "Fixed Distance")}
        {num("trail_min_step", "Min Step")}
        {num("breakeven_offset", "Breakeven Offset")}
      </div>

      <div className="mt-3 p-3 rounded-xl bg-white/3 border border-white/5">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          The initial stop loss protects the trade from the start. After TP1 (or immediately, if selected)
          the stop loss follows the price at ATR × multiplier and only moves when it improves by at least
          the minimum step. It never moves backwards. Trades 2 and 3 move to break-even when trade 1 hits TP1.
        </p>
      </div>

      <div className="mt-2 flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-300/90 leading-relaxed">
          These values must match the FloubaTradeManager EA inputs on your VPS.
        </p>
      </div>
    </GlassCard>
  );
}