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

  const num = (k) => (
    <div>
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{k.label}</Label>
      <Input
        type="number"
        value={s[k.key] ?? ""}
        onChange={(e) => set(k.key, parseFloat(e.target.value) || 0)}
        className="bg-white/5 border-red-500/20 rounded-xl h-11 mt-1"
      />
    </div>
  );

  return (
    <div className="space-y-4 pb-6">
      <MobileHeader title="Bot Settings" subtitle="Tune your robot's behavior and risk." />
      <div className="px-4 space-y-4">

      <GlassCard>
        <SegmentRow label="Trading Mode" options={["Conservative", "Normal", "Aggressive"]} value={s.trading_mode} onChange={(v) => set("trading_mode", v)} />
        <SegmentRow label="Lot Size Mode" options={["Fixed", "Auto Risk"]} value={s.lot_size_mode} onChange={(v) => set("lot_size_mode", v)} />
      </GlassCard>

      <GlassCard className="grid grid-cols-2 gap-3">
        {num({ key: "risk_percentage", label: "Risk %" })}
        {num({ key: "max_daily_trades", label: "Max Daily Trades" })}
        {num({ key: "daily_profit_target", label: "Profit Target $" })}
        {num({ key: "daily_loss_limit", label: "Loss Limit $" })}
      </GlassCard>

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