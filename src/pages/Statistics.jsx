import React, { useEffect, useState, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Activity, BarChart3, Shield, RefreshCw, Stethoscope } from "lucide-react";
import LiveTradeCard from "@/components/trade/LiveTradeCard";
import PerformancePanel from "@/components/trade/PerformancePanel";
import PanicButton from "@/components/trade/PanicButton";
import TradingDiagnostics from "@/components/trade/TradingDiagnostics";

const TABS = [
  { id: "live",   label: "Live",        icon: Activity },
  { id: "perf",   label: "Performance", icon: BarChart3 },
  { id: "manage", label: "Protection",  icon: Shield },
  { id: "diag",   label: "Diagnostics", icon: Stethoscope },
];

function computeStats(trades) {
  const closed = trades.filter((t) => t.status === "Closed");
  const open   = trades.filter((t) => t.status === "Open");
  const today  = new Date(); today.setHours(0, 0, 0, 0);

  const todayTrades = closed.filter((t) => t.closed_at && new Date(t.closed_at) >= today);
  const wins  = closed.filter((t) => (t.profit ?? 0) > 0);
  const losses = closed.filter((t) => (t.profit ?? 0) < 0);
  const todayProfit = todayTrades.filter((t) => (t.profit ?? 0) > 0).reduce((s, t) => s + (t.profit ?? 0), 0);
  const todayLoss   = todayTrades.filter((t) => (t.profit ?? 0) < 0).reduce((s, t) => s + (t.profit ?? 0), 0);

  const grossWin  = wins.reduce((s, t)  => s + (t.profit ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.profit ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : wins.length > 0 ? 999 : 0;

  return {
    win_rate:     closed.length > 0 ? (wins.length / closed.length) * 100 : null,
    profit_factor: closed.length > 0 ? profitFactor : null,
    today_profit: todayProfit,
    today_loss:   todayLoss,
    open_trades:  open.length,
    closed_trades: closed.length,
    avg_win:      wins.length > 0 ? grossWin / wins.length : null,
    avg_loss:     losses.length > 0 ? grossLoss / losses.length : null,
    largest_win:  wins.length > 0 ? Math.max(...wins.map((t) => t.profit ?? 0)) : null,
    largest_loss: losses.length > 0 ? Math.max(...losses.map((t) => Math.abs(t.profit ?? 0))) : null,
  };
}

export default function Statistics() {
  const [tab, setTab] = useState("live");
  const [settings, setSettings] = useState(null);
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState({});
  const { toast } = useToast();
  const tickRef = useRef(null);

  const load = useCallback(async () => {
    const [list, allTrades] = await Promise.all([
      base44.entities.BotSettings.list(),
      base44.entities.Trade.list("-opened_at", 100),
    ]);
    const s = list[0] || {};
    setSettings(s);
    setTrades(allTrades);
    setStats(computeStats(allTrades));
  }, []);

  useEffect(() => {
    load();
    // Poll open trades every 5 seconds when connected
    tickRef.current = setInterval(load, 5000);
    return () => clearInterval(tickRef.current);
  }, [load]);

  // Auto-manage: Break Even + Trailing Stop + Auto Close
  useEffect(() => {
    if (!settings || settings.connection_status !== "Connected") return;
    const openTrades = trades.filter((t) => t.status === "Open");
    openTrades.forEach(async (trade) => {
      const profit = trade.profit ?? 0;
      const pips = trade.entry_price && trade.current_price
        ? Math.abs(trade.current_price - trade.entry_price) * (trade.pair?.includes("JPY") ? 100 : 10000)
        : 0;

      // Break Even
      if (settings.break_even && !trade.break_even_activated && pips >= (settings.stop_loss ?? 50)) {
        await base44.entities.Trade.update(trade.id, {
          stop_loss: trade.entry_price,
          break_even_activated: true,
        });
        toast({ title: "Break Even Activated", description: `${trade.pair} SL moved to entry` });
      }

      // Auto Close: TP / SL / Daily Target / Daily Loss
      const shouldClose =
        (settings.daily_profit_target && stats.today_profit >= settings.daily_profit_target) ||
        (settings.daily_loss_limit && Math.abs(stats.today_loss) >= settings.daily_loss_limit);

      if (shouldClose) {
        const reason = stats.today_profit >= (settings.daily_profit_target ?? Infinity)
          ? "Daily Target"
          : "Daily Loss Limit";
        await base44.entities.Trade.update(trade.id, {
          status: "Closed",
          closed_at: new Date().toISOString(),
          close_reason: reason,
        });
        toast({ title: `${reason} Reached`, description: `${trade.pair} closed automatically` });
        await base44.entities.BotSettings.update(settings.id, { robot_status: "Paused" });
        setSettings((p) => ({ ...p, robot_status: "Paused" }));
      }
    });
  }, [trades, settings]);

  const handlePanic = async () => {
    const openTrades = trades.filter((t) => t.status === "Open");
    await Promise.all(
      openTrades.map((t) =>
        base44.entities.Trade.update(t.id, {
          status: "Closed",
          closed_at: new Date().toISOString(),
          close_reason: "Panic",
        })
      )
    );
    if (settings?.id) {
      await base44.entities.BotSettings.update(settings.id, { robot_status: "Paused" });
    }
    toast({ title: "⚠ Emergency Stop", description: "All positions closed. Robot stopped." });
    await load();
  };

  const connected = settings?.connection_status === "Connected";
  const openTrades = trades.filter((t) => t.status === "Open");

  return (
    <div className="min-h-screen bg-black max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-black text-white" style={{ textShadow: "0 0 20px rgba(220,38,38,0.6)" }}>
            TRADE ENGINE
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-heading">Professional Management</p>
        </div>
        <button onClick={load} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <RefreshCw className="w-3.5 h-3.5 text-white/50" />
        </button>
      </div>

      {/* Connection badge */}
      <div className="px-4 mb-3">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-heading font-bold uppercase tracking-widest ${connected ? "bg-green-500/10 text-green-400 border border-green-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"}`}>
          <motion.div
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`}
            animate={connected ? { scale: [1, 1.5, 1], opacity: [1, 0.4, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          {connected ? `MT5 LIVE · ${openTrades.length} OPEN` : "NOT CONNECTED"}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-heading font-bold text-[10px] uppercase tracking-wider transition-all ${
                tab === id ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-white/30"
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 pb-6 space-y-3">
        <AnimatePresence mode="wait">
          {/* LIVE TRADES */}
          {tab === "live" && (
            <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {!connected ? (
                <div className="py-14 flex flex-col items-center gap-4 text-center rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <WifiOff className="w-9 h-9 text-white/15" />
                  <p className="font-heading text-xs uppercase tracking-widest text-white/30">Not Connected</p>
                  <p className="text-[11px] text-white/20 max-w-xs">Connect your MT5 account to monitor live trades here.</p>
                </div>
              ) : openTrades.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3 text-center rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Activity className="w-8 h-8 text-white/15" />
                  <p className="font-heading text-xs uppercase tracking-widest text-white/30">No Open Trades</p>
                  <p className="text-[11px] text-white/20">The robot is scanning the market…</p>
                </div>
              ) : (
                openTrades.map((trade) => <LiveTradeCard key={trade.id} trade={trade} />)
              )}

              {/* Recent closed */}
              {trades.filter((t) => t.status === "Closed").slice(0, 5).length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading mb-2">Recent Closed</p>
                  {trades.filter((t) => t.status === "Closed").slice(0, 5).map((trade) => (
                    <div key={trade.id} className="flex items-center justify-between py-2 px-3 rounded-xl mb-1.5"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-xs text-white/60">{trade.pair}</span>
                        <span className={`text-[9px] font-bold ${trade.direction === "Buy" ? "text-green-400/60" : "text-red-400/60"}`}>{trade.direction?.toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {trade.close_reason && <span className="text-[9px] text-white/25 font-heading">{trade.close_reason}</span>}
                        <span className={`font-heading font-bold text-xs ${(trade.profit ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {(trade.profit ?? 0) >= 0 ? "+" : ""}{(trade.profit ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* PERFORMANCE */}
          {tab === "perf" && (
            <motion.div key="perf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PerformancePanel stats={stats} />
            </motion.div>
          )}

          {/* DIAGNOSTICS */}
          {tab === "diag" && (
            <motion.div key="diag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TradingDiagnostics />
            </motion.div>
          )}

          {/* PROTECTION */}
          {tab === "manage" && (
            <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">

              {/* Active protections */}
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading">Active Protections</p>
                {[
                  { label: "Break Even",    enabled: settings?.break_even,     desc: `Activates at ${settings?.stop_loss ?? 50} pips profit` },
                  { label: "Trailing Stop", enabled: settings?.trailing_stop,   desc: "ATR-based trailing" },
                  { label: "News Filter",   enabled: settings?.news_filter,     desc: "Pause during high-impact news" },
                  { label: "Daily Target",  enabled: !!settings?.daily_profit_target, desc: `$${settings?.daily_profit_target ?? "--"} profit target` },
                  { label: "Daily Loss Limit", enabled: !!settings?.daily_loss_limit, desc: `$${settings?.daily_loss_limit ?? "--"} max loss` },
                ].map(({ label, enabled, desc }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div>
                      <p className="font-heading text-xs font-bold text-white/80">{label}</p>
                      <p className="text-[10px] text-white/30">{desc}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${enabled ? "bg-green-400" : "bg-white/15"}`} />
                  </div>
                ))}
                <p className="text-[9px] text-white/20 text-center pt-1">Configure these in Settings →</p>
              </div>

              {/* Panic Button */}
              <div>
                <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading mb-2">Emergency Control</p>
                <PanicButton onPanic={handlePanic} disabled={!connected || openTrades.length === 0} />
                {(!connected || openTrades.length === 0) && (
                  <p className="text-[10px] text-white/20 text-center mt-2 font-heading">
                    {!connected ? "Connect MT5 to enable emergency stop" : "No open positions to close"}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}