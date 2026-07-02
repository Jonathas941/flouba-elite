import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import GlassCard from "@/components/GlassCard";
import { ToggleRow, SegmentRow } from "@/components/settings/SettingRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Save } from "lucide-react";
import MobileHeader from "@/components/MobileHeader";

export default function Settings() {
  const [s, setS] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const list = await base44.entities.BotSettings.list();
      setS(list[0] || (await base44.entities.BotSettings.create({})));
    })();
  }, []);

  const set = (k, v) => setS((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    await base44.entities.BotSettings.update(s.id, s);
    toast({ title: "Settings saved", description: "Your bot configuration has been updated." });
  };

  if (!s) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>;

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
    <div className="space-y-4 pb-6">
      <MobileHeader title="Bot Settings" subtitle="Tune your robot's behavior and risk." />
      <div className="px-4 space-y-4">

        {/* Trading Mode */}
        <GlassCard>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Trading Mode</p>
          <SegmentRow
            label="Mode"
            options={["Conservative", "Balanced", "Aggressive"]}
            value={s.trading_mode || "Balanced"}
            onChange={(v) => set("trading_mode", v)}
          />
          <div className="mt-3 p-3 rounded-xl bg-white/3 border border-white/5">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <span className="text-white font-bold">Conservative</span>: Signal ≥ 85 pts &nbsp;·&nbsp;
              <span className="text-white font-bold">Balanced</span>: Signal ≥ 70 pts &nbsp;·&nbsp;
              <span className="text-white font-bold">Aggressive</span>: Signal ≥ 60 pts
            </p>
          </div>
        </GlassCard>

        {/* Signal Score Breakdown */}
        <GlassCard>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Signal Score Weights</p>
          <div className="space-y-2">
            {[
              { label: "EMA Trend Confirmation", points: 30, color: "bg-green-500" },
              { label: "RSI Confirmation",        points: 25, color: "bg-blue-500" },
              { label: "ATR Volatility",          points: 20, color: "bg-amber-500" },
              { label: "Market Direction",        points: 25, color: "bg-red-500" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground flex-1">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.points}%` }} />
                  </div>
                  <span className="text-xs font-bold text-white w-8 text-right">{item.points}pt</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Lot Size Mode */}
        <GlassCard>
          <SegmentRow label="Lot Size Mode" options={["Fixed", "Auto Risk"]} value={s.lot_size_mode} onChange={(v) => set("lot_size_mode", v)} />
        </GlassCard>

        {/* Risk Controls */}
        <GlassCard className="grid grid-cols-2 gap-3">
          {num("lot_size", "Lot Size")}
          {num("risk_percentage", "Risk %")}
          {num("stop_loss", "Stop Loss (pts)")}
          {num("take_profit", "Take Profit (pts)")}
          {num("stop_after_losses", "Stop After N Losses")}
          {num("daily_profit_target", "Profit Target $")}
          {num("daily_loss_limit", "Loss Limit $")}
        </GlassCard>

        {/* Risk Management Toggles */}
        <GlassCard>
          <ToggleRow label="Break Even" desc="Move SL to entry once in profit" checked={s.break_even} onChange={(v) => set("break_even", v)} />
          <ToggleRow label="Trailing Stop" desc="Lock profits as price moves" checked={s.trailing_stop} onChange={(v) => set("trailing_stop", v)} />
          <ToggleRow label="News Filter" desc="Pause around high-impact news" checked={s.news_filter} onChange={(v) => set("news_filter", v)} />
          <ToggleRow label="London Session" checked={s.london_session} onChange={(v) => set("london_session", v)} />
          <ToggleRow label="New York Session" checked={s.new_york_session} onChange={(v) => set("new_york_session", v)} />
        </GlassCard>

        <Button onClick={save} className="w-full h-13 py-3 rounded-2xl bg-red-600 hover:bg-red-500 neon-red font-heading tracking-widest">
          <Save className="w-4 h-4 mr-2" /> SAVE SETTINGS
        </Button>
      </div>
    </div>
  );
}