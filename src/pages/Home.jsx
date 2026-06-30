import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Bell, User } from "lucide-react";
import Logo from "@/components/Logo";
import ConnectionCard from "@/components/dashboard/ConnectionCard";
import RobotCard from "@/components/dashboard/RobotCard";
import AccountOverview from "@/components/dashboard/AccountOverview";
import MarketWatch from "@/components/dashboard/MarketWatch";
import AIStrategyScore from "@/components/dashboard/AIStrategyScore";
import TradesTable from "@/components/dashboard/TradesTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function Home() {
  const [settings, setSettings] = useState(null);
  const [trades, setTrades] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const { toast } = useToast();

  const load = async () => {
    const [list, tradeList, acctList] = await Promise.all([
      base44.entities.BotSettings.list(),
      base44.entities.Trade.list("-created_date", 10),
      base44.entities.MT5Account.list(),
    ]);
    let s = list[0];
    if (!s) s = await base44.entities.BotSettings.create({});
    setSettings(s);
    setTrades(tradeList);
    setAccounts(acctList);
  };

  useEffect(() => { load(); }, []);

  const patch = async (data) => {
    await base44.entities.BotSettings.update(settings.id, data);
    setSettings((p) => ({ ...p, ...data }));
  };

  const handleStart = async () => {
    await patch({ robot_status: "Scanning Market" });
    toast({ title: "Robot started", description: "Scanning market…" });
    setTimeout(() => patch({ robot_status: "Running" }), 2000);
  };

  const handleStop = async () => {
    await patch({ robot_status: "Paused" });
    toast({ title: "Robot paused" });
  };

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto" />
          <p className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  const connected = settings.connection_status === "Connected";

  return (
    <div className="px-4 pt-5 space-y-4">

      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={36} />
          <div>
            <h1 className="font-heading text-base font-black text-white leading-none">
              FLOUBA <span className="text-red-500">ELITE</span>
            </h1>
            <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Trading Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative glass w-9 h-9 rounded-xl flex items-center justify-center">
            <Bell className="w-4 h-4 text-red-400" />
          </button>
          <div className="w-9 h-9 glass rounded-xl flex items-center justify-center border border-red-500/20">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </header>

      {/* MT5 Account Selector */}
      <Select value={settings.mt5_account || ""} onValueChange={(v) => patch({ mt5_account: v })}>
        <SelectTrigger className="bg-white/5 border-red-500/20 rounded-xl h-11 font-heading text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} />
            <SelectValue placeholder="Select MT5 Live Account" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {accounts.length === 0 && (
            <SelectItem value="none" disabled>No accounts added</SelectItem>
          )}
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.account_number}>
              {a.type} · {a.account_number} — {a.broker}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Connection Card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <ConnectionCard
          settings={settings}
          onToggle={() => patch({ connection_status: connected ? "Disconnected" : "Connected" })}
        />
      </motion.div>

      {/* Robot Card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <RobotCard
          status={settings.robot_status}
          connected={connected}
          onStart={handleStart}
          onStop={handleStop}
        />
      </motion.div>

      {/* Account Overview */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <AccountOverview settings={settings} connected={connected} />
      </motion.div>

      {/* Market Watch */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <MarketWatch connected={connected} />
      </motion.div>

      {/* AI Strategy Score */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <AIStrategyScore connected={connected} />
      </motion.div>

      {/* Recent Trades */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <TradesTable trades={trades} connected={connected} />
      </motion.div>

    </div>
  );
}