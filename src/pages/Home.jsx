import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Wifi, WifiOff, Bell, Wallet, TrendingUp, Activity, ChevronDown } from "lucide-react";
import Logo from "@/components/Logo";
import GlassCard from "@/components/GlassCard";
import StatTile from "@/components/StatTile";
import RobotControls from "@/components/dashboard/RobotControls";
import RecentTrades from "@/components/dashboard/RecentTrades";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "US30", "NAS100"];

export default function Home() {
  const [settings, setSettings] = useState(null);
  const [trades, setTrades] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const { toast } = useToast();

  const load = async () => {
    const list = await base44.entities.BotSettings.list();
    let s = list[0];
    if (!s) s = await base44.entities.BotSettings.create({});
    setSettings(s);
    setTrades(await base44.entities.Trade.list("-created_date", 6));
    setAccounts(await base44.entities.MT5Account.list());
  };

  useEffect(() => { load(); }, []);

  const patch = async (data) => {
    const updated = await base44.entities.BotSettings.update(settings.id, data);
    setSettings({ ...settings, ...data });
    return updated;
  };

  if (!settings) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>;
  }

  const connected = settings.connection_status === "Connected";
  const statusColor = settings.robot_status === "Running" ? "text-green-400" : settings.robot_status === "Locked" ? "text-red-400" : "text-amber-400";

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={42} />
          <div>
            <h1 className="font-heading text-lg font-black text-white leading-none">FLOUBA <span className="text-red-500">ELITE</span></h1>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Control Center</p>
          </div>
        </div>
        <button className="relative glass w-10 h-10 rounded-xl flex items-center justify-center">
          <Bell className="w-5 h-5 text-red-400" />
          {trades.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full neon-red" />}
        </button>
      </div>

      <GlassCard glow={connected} className="flex items-center justify-between">
        <button
          onClick={() => patch({ connection_status: connected ? "Disconnected" : "Connected" })}
          className="flex items-center gap-3"
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${connected ? "bg-green-500/15" : "bg-red-500/15"}`}>
            {connected ? <Wifi className="w-5 h-5 text-green-400" /> : <WifiOff className="w-5 h-5 text-red-400" />}
          </div>
          <div className="text-left">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Connection</p>
            <p className={`font-heading font-bold ${connected ? "text-green-400" : "text-red-400"}`}>{settings.connection_status}</p>
          </div>
        </button>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Robot</p>
          <p className={`font-heading font-bold ${statusColor}`}>{settings.robot_status}</p>
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">MT5 Live Account</p>
        <Select
          value={settings.mt5_account || ""}
          onValueChange={(v) => patch({ mt5_account: v })}
        >
          <SelectTrigger className="bg-white/5 border-red-500/20 rounded-xl h-12">
            <SelectValue placeholder="Select MT5 account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.length === 0 && <SelectItem value="Demo-000000">Demo-000000</SelectItem>}
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.account_number}>{a.account_number} · {a.broker || a.type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </GlassCard>

      <RobotControls
        status={settings.robot_status}
        disabled={!connected}
        onStart={() => { patch({ robot_status: "Running" }); toast({ title: "Robot started", description: `Trading ${settings.active_pair}` }); }}
        onStop={() => { patch({ robot_status: "Paused" }); toast({ title: "Robot stopped" }); }}
      />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Balance" value={`$${settings.balance?.toLocaleString()}`} icon={Wallet} />
        <StatTile label="Equity" value={`$${settings.equity?.toLocaleString()}`} icon={Activity} />
        <StatTile
          label="Profit Today"
          value={`${settings.profit_today >= 0 ? "+" : ""}$${settings.profit_today}`}
          icon={TrendingUp}
          accent={settings.profit_today >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      <GlassCard>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Active Pair</p>
        <div className="flex flex-wrap gap-2">
          {PAIRS.map((p) => (
            <button
              key={p}
              onClick={() => patch({ active_pair: p })}
              className={`px-4 py-2 rounded-xl font-heading text-sm tracking-wider transition-all ${settings.active_pair === p ? "bg-red-600 text-white neon-red" : "bg-white/5 text-muted-foreground"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </GlassCard>

      <RecentTrades trades={trades} />
    </div>
  );
}