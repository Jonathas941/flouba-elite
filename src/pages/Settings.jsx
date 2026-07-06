import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import { Save, SlidersHorizontal, Shield, Clock, Target, Layers } from "lucide-react";
import {
  ToggleRow,
  SegmentRow,
  PairRow,
  NumberRow,
  SectionLabel,
  SettingsCard,
} from "@/components/settings/SettingRow";

const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30"];

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

  if (!s)
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="bg-black min-h-screen px-4 pt-8 pb-10 space-y-5 max-w-md mx-auto">

      {/* Header */}
      <header>
        <h1
          className="font-heading font-black text-white"
          style={{ fontSize: 28, letterSpacing: "0.06em", textShadow: "0 0 24px rgba(220,0,0,0.6)" }}
        >
          BOT SETTINGS
        </h1>
        <p className="text-sm text-white/40 mt-1">Tune your robot's behavior and risk.</p>
      </header>

      {/* TRADING MODE */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-red-500" />
          <SectionLabel>Trading Mode</SectionLabel>
        </div>
        <SettingsCard>
          <SegmentRow label="Strategy Mode" desc="Aggressive takes more trades at higher risk" options={["Conservative", "Normal", "Aggressive"]} value={s.trading_mode} onChange={(v) => set("trading_mode", v)} />
          <SegmentRow label="Lot Size Mode" options={["Fixed", "Auto Risk"]} value={s.lot_size_mode} onChange={(v) => set("lot_size_mode", v)} />
        </SettingsCard>
      </section>

      {/* ACTIVE PAIR */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-3.5 h-3.5 text-red-500" />
          <SectionLabel>Active Pair</SectionLabel>
        </div>
        <SettingsCard>
          <PairRow label="Instrument" options={PAIRS} value={s.active_pair} onChange={(v) => set("active_pair", v)} />
        </SettingsCard>
      </section>

      {/* RISK MANAGEMENT */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-3.5 h-3.5 text-red-500" />
          <SectionLabel>Risk Management</SectionLabel>
        </div>
        <SettingsCard>
          <NumberRow label="Risk per Trade" suffix="%" value={s.risk_percentage} onChange={(v) => set("risk_percentage", v)} />
          <NumberRow label="Max Daily Trades" value={s.max_daily_trades} onChange={(v) => set("max_daily_trades", v)} />
          <NumberRow label="Daily Profit Target" suffix="$" value={s.daily_profit_target} onChange={(v) => set("daily_profit_target", v)} />
          <NumberRow label="Daily Loss Limit" suffix="$" value={s.daily_loss_limit} onChange={(v) => set("daily_loss_limit", v)} />
          <NumberRow label="Risk : Reward" suffix="R" value={s.risk_reward_ratio} onChange={(v) => set("risk_reward_ratio", v)} />
        </SettingsCard>
      </section>

      {/* TRADE MANAGEMENT */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-3.5 h-3.5 text-red-500" />
          <SectionLabel>Trade Management</SectionLabel>
        </div>
        <SettingsCard>
          <ToggleRow label="Break Even" desc="Move SL to entry once in profit" checked={s.break_even} onChange={(v) => set("break_even", v)} />
          <ToggleRow label="Trailing Stop" desc="Lock profits as price moves" checked={s.trailing_stop} onChange={(v) => set("trailing_stop", v)} />
          <ToggleRow label="Partial Close" desc="Close 50% at first target" checked={s.partial_close} onChange={(v) => set("partial_close", v)} />
          <ToggleRow label="News Filter" desc="Pause around high-impact news" checked={s.news_filter} onChange={(v) => set("news_filter", v)} />
          <NumberRow label="Max Spread" suffix="pips" value={s.max_spread} onChange={(v) => set("max_spread", v)} />
          <NumberRow label="Slippage" suffix="pips" value={s.slippage} onChange={(v) => set("slippage", v)} />
          <NumberRow label="Max Positions" value={s.max_positions} onChange={(v) => set("max_positions", v)} />
          <NumberRow label="Max Hold Time" suffix="hrs" value={s.max_hold_hours} onChange={(v) => set("max_hold_hours", v)} />
        </SettingsCard>
      </section>

      {/* SESSIONS */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-3.5 h-3.5 text-red-500" />
          <SectionLabel>Trading Sessions</SectionLabel>
        </div>
        <SettingsCard>
          <ToggleRow label="Asian Session" checked={s.asian_session} onChange={(v) => set("asian_session", v)} />
          <ToggleRow label="London Session" checked={s.london_session} onChange={(v) => set("london_session", v)} />
          <ToggleRow label="New York Session" checked={s.new_york_session} onChange={(v) => set("new_york_session", v)} />
        </SettingsCard>
      </section>

      {/* SAVE */}
      <motion.button
        onClick={save}
        whileTap={{ scale: 0.97 }}
        className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-heading font-black tracking-[0.2em] text-sm text-white transition-all"
        style={{
          background: "rgba(239,68,68,0.95)",
          boxShadow: "0 0 22px rgba(239,68,68,0.45)",
        }}
      >
        <Save className="w-4 h-4" /> SAVE SETTINGS
      </motion.button>
    </div>
  );
}