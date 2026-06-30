import React, { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Play, Square, Bell } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PAIR_META = {
  XAUUSD: { label: "Gold / US Dollar",    icon: "🥇" },
  EURUSD: { label: "Euro / US Dollar",    icon: "💶" },
  GBPUSD: { label: "Pound / US Dollar",   icon: "💷" },
  USDJPY: { label: "US Dollar / Yen",     icon: "💴" },
  NAS100: { label: "Nasdaq 100 Index",    icon: "📈" },
  US30:   { label: "Dow Jones Index",     icon: "🏦" },
};

export default function Home() {
  const [settings, setSettings] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef(0);

  const load = async () => {
    const list = await base44.entities.BotSettings.list();
    let s = list[0];
    if (!s) s = await base44.entities.BotSettings.create({});
    setSettings(s);
  };

  useEffect(() => { load(); }, []);

  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e) => {
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0 && window.scrollY === 0) setPullY(Math.min(dy * 0.4, 60));
  };
  const handleTouchEnd = async () => {
    if (pullY > 45) {
      setRefreshing(true);
      await load();
      setRefreshing(false);
    }
    setPullY(0);
  };

  const patch = async (data) => {
    await base44.entities.BotSettings.update(settings.id, data);
    setSettings((p) => ({ ...p, ...data }));
  };

  const handleStart = async () => {
    if (!connected) { navigate("/connect-mt5"); return; }
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
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const connected = settings.connection_status === "Connected";
  const status = settings.robot_status || "Paused";
  const running = status === "Running";
  const active = connected && ["Running", "Scanning Market", "Entering Trade", "Managing Position"].includes(status);

  const fmt = (val, decimals = 2) =>
    connected && val != null ? `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}` : "--";

  const fmtProfit = (val) => {
    if (!connected || val == null) return "--";
    const n = Number(val);
    return (n >= 0 ? "+" : "") + `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const pair = settings.active_pair || "XAUUSD";
  const pairMeta = PAIR_META[pair] || { label: pair, icon: "📊" };

  const statusLabel = active
    ? status === "Running" ? "ROBOT IS RUNNING" : status.toUpperCase()
    : connected ? "ROBOT IS PAUSED" : "NOT CONNECTED";

  const statusDesc = active
    ? "AI system is analyzing the market..."
    : connected ? "Press START to activate the robot." : "Connect your MT5 account to begin.";

  const statusColor = active ? "text-green-400" : connected ? "text-amber-400" : "text-red-400";
  const statusDot   = active ? "bg-green-400"  : connected ? "bg-amber-400"  : "bg-red-400";

  return (
    <div
      className="min-h-screen bg-black flex flex-col max-w-md mx-auto relative overflow-hidden"
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {pullY > 0 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex justify-center" style={{ opacity: pullY / 60 }}>
          <div className={`w-6 h-6 border-2 border-red-500/40 border-t-red-500 rounded-full ${refreshing ? "animate-spin" : ""}`} />
        </div>
      )}

      {/* ── HERO SECTION ── */}
      <div className="relative w-full" style={{ minHeight: 380 }}>
        {/* Robot bg image */}
        <img
          src="https://media.base44.com/images/public/6a437ad84dc8721fedd64296/586a57cc0_generated_image.png"
          alt="Flouba AI Robot"
          className="absolute inset-0 w-full h-full object-cover object-top"
          style={{ opacity: 0.88 }}
        />
        {/* Dark gradient overlay bottom */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.85) 80%, #000 100%)"
        }} />
        {/* Red ambient top */}
        <div className="absolute top-0 left-0 right-0 h-40 pointer-events-none" style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(180,0,0,0.35), transparent 70%)"
        }} />

        {/* Status bar row */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-4">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-heading font-bold uppercase tracking-widest ${connected ? "bg-black/60 text-green-400 border border-green-500/40" : "bg-black/60 text-red-400 border border-red-500/40"}`}>
            <motion.div
              className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`}
              animate={connected ? { scale: [1, 1.6, 1], opacity: [1, 0.4, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            {connected ? "CONNECTED" : "NOT CONNECTED"}
          </div>

          <div className="flex items-center gap-2">
            {connected && (
              <span className="text-[11px] font-heading font-bold text-white/80 bg-black/50 px-2 py-1 rounded-lg border border-white/10">
                MT5 LIVE ▾
              </span>
            )}
            <button
              onClick={() => !connected && navigate("/connect-mt5")}
              className="w-8 h-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center"
            >
              <Bell className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>

        {/* Brand name over robot */}
        <div className="relative z-10 flex flex-col items-center justify-end pb-5" style={{ marginTop: 240 }}>
          <h1
            className="font-heading font-black text-white text-center leading-none"
            style={{
              fontSize: 38,
              letterSpacing: "0.08em",
              textShadow: "0 0 30px rgba(220,0,0,0.9), 0 2px 20px rgba(0,0,0,0.8)",
            }}
          >
            FLOUBA ELITE
          </h1>
          <p
            className="font-heading font-bold tracking-[0.35em] text-white/90 mt-1"
            style={{ fontSize: 11, textShadow: "0 0 10px rgba(220,0,0,0.6)" }}
          >
            AI TRADING ROBOT
          </p>
        </div>
      </div>

      {/* ── CONTROLS ── */}
      <div className="relative z-10 px-4 -mt-2 space-y-3 bg-black pt-4">

        {/* START ROBOT */}
        <motion.button
          onClick={handleStart}
          disabled={connected && running}
          whileTap={{ scale: 0.97 }}
          className="w-full h-14 rounded-2xl flex items-center justify-between px-5 font-heading font-black tracking-[0.2em] text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{
            background: running ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.95)",
            color: running ? "#4ade80" : "#16a34a",
            border: running ? "1px solid rgba(74,222,128,0.3)" : "none",
            boxShadow: running ? "none" : "0 4px 30px rgba(255,255,255,0.15)",
          }}
        >
          <span>START ROBOT</span>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${running ? "bg-green-500/20 border border-green-500/40" : "bg-green-600"}`}>
            <Play className={`w-4 h-4 fill-current ${running ? "text-green-400" : "text-white"}`} />
          </div>
        </motion.button>

        {/* STOP ROBOT */}
        <motion.button
          onClick={handleStop}
          disabled={!connected || !running}
          whileTap={{ scale: 0.97 }}
          className="w-full h-14 rounded-2xl flex items-center justify-between px-5 font-heading font-black tracking-[0.2em] text-sm text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{
            background: "transparent",
            border: "1.5px solid rgba(239,68,68,0.6)",
            boxShadow: running ? "0 0 20px rgba(239,68,68,0.15)" : "none",
          }}
        >
          <span>STOP ROBOT</span>
          <div className="w-9 h-9 rounded-full flex items-center justify-center border border-red-500/40 bg-red-500/10">
            <Square className="w-4 h-4 fill-current text-red-500" />
          </div>
        </motion.button>

        {/* Connect button if not connected */}
        {!connected && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => navigate("/connect-mt5")}
            className="w-full h-11 rounded-2xl border border-red-500/30 font-heading text-xs tracking-widest text-red-400 hover:bg-red-500/10 transition-colors"
          >
            CONNECT MT5 ACCOUNT
          </motion.button>
        )}

        {/* ── ACCOUNT OVERVIEW ── */}
        <div className="pt-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-heading mb-2">Account Overview</p>
          <div
            className="rounded-2xl grid grid-cols-3 divide-x divide-white/5 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {[
              { label: "BALANCE",       value: fmt(settings.balance) },
              { label: "EQUITY",        value: fmt(settings.equity) },
              { label: "PROFIT TODAY",  value: fmtProfit(settings.profit_today), profit: true },
            ].map(({ label, value, profit }) => (
              <div key={label} className="py-3 px-3 flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-widest text-white/35">{label}</span>
                <span className={`font-heading font-bold text-sm ${
                  value === "--" ? "text-white/25" :
                  profit ? (value.startsWith("+") ? "text-green-400" : "text-red-400") : "text-white"
                }`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── ACTIVE PAIR ── */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-heading mb-2">Active Pair</p>
          <div
            className="rounded-2xl flex items-center justify-between px-4 py-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg">
                {pairMeta.icon}
              </div>
              <div>
                <p className="font-heading font-bold text-white text-sm">{pair}</p>
                <p className="text-[10px] text-white/40">{pairMeta.label}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-white/30">CHANGE</p>
              <p className={`font-heading font-bold text-sm ${connected ? "text-green-400" : "text-white/25"}`}>
                {connected ? "+0.45%" : "--"}
              </p>
            </div>
          </div>
        </div>

        {/* ── ROBOT STATUS ── */}
        <div className="pb-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-heading mb-2">Robot Status</p>
          <div
            className="rounded-2xl flex items-center gap-3 px-4 py-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${active ? "bg-green-500/15 border border-green-500/30" : "bg-white/5 border border-white/10"}`}>
              <motion.div
                className={`w-2.5 h-2.5 rounded-full ${statusDot}`}
                animate={active ? { scale: [1, 1.5, 1], opacity: [1, 0.3, 1] } : {}}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            </div>
            <div>
              <p className={`font-heading font-bold text-sm tracking-wider ${statusColor}`}>{statusLabel}</p>
              <p className="text-[10px] text-white/35 mt-0.5">{statusDesc}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}