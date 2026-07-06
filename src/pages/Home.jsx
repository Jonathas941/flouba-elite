import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Play, Square, Bell, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import { logNotification } from "@/lib/notifications";
import RobotStartModal from "@/components/RobotStartModal";
import { getStrategyTimeframes } from "@/lib/strategyTimeframes";

const PAIR_META = {
  XAUUSD: { label: "Gold / US Dollar",  icon: "🥇" },
  EURUSD: { label: "Euro / US Dollar",   icon: "💶" },
  GBPUSD: { label: "Pound / US Dollar",  icon: "💷" },
  USDJPY: { label: "US Dollar / Yen",    icon: "💴" },
  NAS100: { label: "Nasdaq 100 Index",   icon: "📈" },
  US30:   { label: "Dow Jones Index",    icon: "🏦" },
  BTCUSD: { label: "Bitcoin / US Dollar", icon: "₿" },
};

const ROBOT_IMG = "https://media.base44.com/images/public/6a437ad84dc8721fedd64296/586a57cc0_generated_image.png";

export default function Home() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [robotStatus, setRobotStatus] = useState("Paused");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePair, setActivePair] = useState("XAUUSD");
  const [showStartModal, setShowStartModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const pollRef = useRef(null);
  const slowPollRef = useRef(null);
  const settingsRef = useRef(null);
  const touchStartY = useRef(0);
  const [pullY, setPullY] = useState(0);

  const loadFast = useCallback(async () => {
    try {
      const [acctRes, posRes, robotRes] = await Promise.all([
        mt5Api.account(),
        mt5Api.positions(),
        mt5Api.robotStatus(),
      ]);
      const hasCreds = settingsRef.current?.mt5_account;
      if (acctRes?.ok && acctRes.data?.account) {
        const a = acctRes.data.account;
        setConnected(a.connected === true);
        setAccount(a);
        if (!a.connected && hasCreds) mt5Api.connect().catch(() => {});
      } else {
        setConnected(false);
        setAccount(null);
        if (hasCreds) mt5Api.connect().catch(() => {});
      }
      if (posRes?.ok && posRes.data?.positions) {
        setPositions(posRes.data.positions);
        if (posRes.data.positions.length > 0) setActivePair(posRes.data.positions[0].symbol || "XAUUSD");
      } else setPositions([]);
      if (robotRes?.ok && robotRes.data?.robot) {
        const r = robotRes.data.robot;
        setRobotStatus(r.running ? "Scanning Market" : "Paused");
        if (r.config?.symbol) setActivePair(r.config.symbol);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSlow = useCallback(async () => {
    try {
      const [settingsRes] = await Promise.all([
        base44.entities.BotSettings.list('-created_date', 1).catch(() => []),
      ]);
      base44.entities.Notification.filter({ read: false }).then((u) => setUnreadCount(u?.length || 0)).catch(() => {});
      if (settingsRes?.length > 0) settingsRef.current = settingsRes[0];
      else settingsRef.current = null;
    } catch {}
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadFast(), loadSlow()]);
  }, [loadFast, loadSlow]);

  useEffect(() => {
    loadAll();
    pollRef.current = setInterval(loadFast, 8000);
    slowPollRef.current = setInterval(loadSlow, 60000);
    const onVisibility = () => { if (document.visibilityState === "visible") loadAll(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(pollRef.current);
      clearInterval(slowPollRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadAll, loadFast, loadSlow]);

  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e) => {
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0 && window.scrollY === 0) setPullY(Math.min(dy * 0.4, 60));
  };
  const handleTouchEnd = async () => {
    if (pullY > 45) { setRefreshing(true); await loadAll(); setRefreshing(false); }
    setPullY(0);
  };

  const handleStart = () => {
    if (!connected) { navigate("/connect-mt5"); return; }
    setShowStartModal(true);
  };

  const handleLaunchRobot = async (form) => {
    let strategy = form.strategy;
    if (form.strategy === "Auto (AI Select)") {
      try {
        toast({ title: "AI Analyzing Market…", description: "Selecting optimal strategy from live data.", duration: 4000 });
        const res = await base44.functions.invoke("aiStrategySelector", {});
        if (res?.data?.ok && res.data.strategy) {
          strategy = res.data.strategy;
          toast({ title: `AI Selected: ${strategy}`, description: res.data.reason, duration: 5000 });
        } else { strategy = "Momentum Scalping"; toast({ title: "AI Unavailable", description: "Defaulting to Momentum Scalping.", duration: 3000 }); }
      } catch { strategy = "Momentum Scalping"; toast({ title: "AI Unavailable", description: "Defaulting to Momentum Scalping.", duration: 3000 }); }
    }
    const minRatio = form.multiplier_min_equity_ratio ?? 2;
    const multiplierActive = connected && account?.balance > 0 && account?.equity >= minRatio * account.balance;
    const launchForm = { ...form, lot_multiplier: multiplierActive ? form.lot_multiplier : 1 };
    if (!multiplierActive && form.lot_multiplier > 1) {
      toast({ title: "Multiplier Disabled", description: `Equity must reach ${minRatio}x balance to activate lot multiplier.`, duration: 3000 });
    }
    const tf = getStrategyTimeframes(strategy);
    const launchFormWithTF = {
      ...launchForm, strategy,
      strategy_timeframe: tf.main,
      strategy_htf_timeframe: tf.htf || null,
      strategy_confirm_timeframe: tf.confirm || null,
      strategy_entry_timeframe: tf.entry || null,
    };
    const res = await mt5Api.robotStart(launchFormWithTF.symbol, launchFormWithTF);
    if (res?.ok && res?.data?.success === true) {
      setActivePair(form.symbol); setRobotStatus("Scanning Market"); setShowStartModal(false);
      toast({ title: "Robot Started", description: `${strategy} active on ${form.symbol}`, duration: 3000 });
      logNotification({ type: "bot_action", title: "Robot Started", message: `${strategy} engine launched on ${form.symbol}.`, category: "success", meta: { strategy, symbol: form.symbol } });
      setUnreadCount((c) => c + 1);
    } else {
      const msg = res?.error || res?.data?.message || res?.data?.detail || "Start failed";
      toast({ title: "Start Failed", description: msg, variant: "destructive", duration: 4000 });
    }
  };

  const handleStop = async () => {
    try { await mt5Api.robotStop(); } catch {}
    setRobotStatus("Paused");
    toast({ title: "Robot Paused", duration: 3000 });
    logNotification({ type: "bot_action", title: "Robot Paused", message: "Trading robot was paused by user.", category: "info" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" style={{ boxShadow: "0 0 18px rgba(255,0,0,0.4)" }} />
          <p className="font-heading text-[10px] tracking-[0.3em] text-red-500/70">FLOUBA ELITE</p>
        </div>
      </div>
    );
  }

  const active = connected && ["Running", "Scanning Market", "Entering Trade", "Managing Position", "Signal Found", "Sending Order", "Trade Opened"].includes(robotStatus);

  const fmt = (val) =>
    connected && val != null ? `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--";
  const fmtProfit = (val) => {
    if (!connected || val == null) return "--";
    const n = Number(val);
    return (n >= 0 ? "+" : "-") + `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const pair = activePair || "XAUUSD";
  const pairMeta = PAIR_META[pair] || { label: pair, icon: "📊" };
  const openPnl = positions.reduce((s, p) => s + (p.profit ?? p.unrealized_pnl ?? 0), 0);

  const statusLabel = active
    ? (robotStatus === "Running" ? "ROBOT IS RUNNING" : robotStatus.toUpperCase())
    : connected ? "ROBOT IS PAUSED" : "NOT CONNECTED";
  const statusDesc = active
    ? "AI system is analyzing the market..."
    : connected ? "Press START to activate the robot." : "Connect your MT5 account to begin.";
  const statusColor = active ? "text-[#00FF41]" : connected ? "text-amber-400" : "text-[#FF3131]";
  const statusDot = active ? "bg-[#00FF41]" : connected ? "bg-amber-400" : "bg-[#FF3131]";

  return (
    <div
      className="min-h-screen bg-black flex flex-col max-w-md mx-auto relative overflow-hidden"
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
      {pullY > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50" style={{ opacity: pullY / 60 }}>
          <div className={`w-6 h-6 border-2 border-red-500/40 border-t-red-500 rounded-full ${refreshing ? "animate-spin" : ""}`} />
        </div>
      )}

      {/* ── HERO SECTION ── */}
      <div className="relative w-full" style={{ minHeight: 360 }}>
        <img
          src={ROBOT_IMG}
          alt="Flouba Elite AI Robot"
          className="absolute inset-0 w-full h-full object-cover object-top"
          style={{ opacity: 0.9 }}
        />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 35%, rgba(0,0,0,0.85) 78%, #000 100%)"
        }} />
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(180,0,0,0.3), transparent 70%)"
        }} />

        {/* Status bar */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-4">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-heading font-bold uppercase tracking-widest ${connected ? "text-[#00FF41]" : "text-[#FF3131]"}`}
            style={{ background: "rgba(0,0,0,0.6)", border: `1px solid ${connected ? "rgba(0,255,65,0.4)" : "rgba(255,49,49,0.4)"}` }}>
            <motion.span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00FF41]" : "bg-[#FF3131]"}`}
              animate={connected ? { scale: [1, 1.6, 1], opacity: [1, 0.4, 1] } : {}} transition={{ duration: 1.5, repeat: Infinity }} />
            {connected ? "CONNECTED" : "OFFLINE"}
          </div>

          <div className="flex items-center gap-2">
            {connected && (
              <button onClick={() => navigate("/connect-mt5")}
                className="flex items-center gap-1 text-[11px] font-heading font-bold text-white/85 px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                MT5 LIVE <ChevronDown className="w-3 h-3" />
              </button>
            )}
            <button onClick={() => navigate("/notifications")}
              className="relative w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Bell className="w-4 h-4 text-white/70" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#FF3131] text-[8px] font-bold text-white flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Brand */}
        <div className="relative z-10 flex flex-col items-center justify-end pb-5" style={{ marginTop: 230 }}>
          <h1 className="font-heading font-black text-white text-center leading-none"
            style={{ fontSize: 36, letterSpacing: "0.08em", textShadow: "0 0 28px rgba(220,0,0,0.85), 0 2px 18px rgba(0,0,0,0.8)" }}>
            FLOUBA ELITE
          </h1>
          <p className="font-heading font-bold tracking-[0.35em] text-white/90 mt-1.5"
            style={{ fontSize: 11, textShadow: "0 0 10px rgba(220,0,0,0.6)" }}>
            AI TRADING ROBOT
          </p>
        </div>
      </div>

      {/* ── CONTROLS ── */}
      <div className="relative z-10 px-4 -mt-1 space-y-3 bg-black pt-3 pb-6">

        {/* START ROBOT */}
        <motion.button
          onClick={handleStart}
          disabled={connected && active}
          whileTap={{ scale: 0.97 }}
          className="w-full h-14 rounded-2xl flex items-center justify-between px-5 font-heading font-black tracking-[0.2em] text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{
            background: active ? "rgba(0,255,65,0.08)" : "rgba(255,255,255,0.04)",
            color: "#00FF41",
            border: `1px solid ${active ? "rgba(0,255,65,0.35)" : "rgba(0,255,65,0.5)"}`,
            boxShadow: active ? "none" : "0 0 18px rgba(0,255,65,0.12)",
          }}
        >
          <span>{active ? "ROBOT ACTIVE" : "START ROBOT"}</span>
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,255,65,0.15)", border: "1px solid rgba(0,255,65,0.4)" }}>
            <Play className="w-4 h-4 fill-current text-[#00FF41]" />
          </div>
        </motion.button>

        {/* STOP ROBOT */}
        <motion.button
          onClick={handleStop}
          disabled={!connected || !active}
          whileTap={{ scale: 0.97 }}
          className="w-full h-14 rounded-2xl flex items-center justify-between px-5 font-heading font-black tracking-[0.2em] text-sm text-[#FF3131] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{
            background: "transparent",
            border: "1.5px solid rgba(255,49,49,0.6)",
            boxShadow: active ? "0 0 18px rgba(255,49,49,0.12)" : "none",
          }}
        >
          <span>STOP ROBOT</span>
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,49,49,0.1)", border: "1px solid rgba(255,49,49,0.4)" }}>
            <Square className="w-4 h-4 fill-current text-[#FF3131]" />
          </div>
        </motion.button>

        {/* ACCOUNT OVERVIEW */}
        <div className="pt-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-heading mb-2">Account Overview</p>
          <div className="rounded-2xl grid grid-cols-3 divide-x divide-white/5 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {[
              { label: "BALANCE",      value: fmt(account?.balance) },
              { label: "EQUITY",       value: fmt(account?.equity) },
              { label: "PROFIT TODAY", value: fmtProfit(connected ? (openPnl || account?.profit_today) : null), profit: true },
            ].map(({ label, value, profit }) => (
              <div key={label} className="py-3 px-3 flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-widest text-white/35">{label}</span>
                <span className={`font-heading font-bold text-sm ${
                  value === "--" ? "text-white/25" :
                  profit ? (value.startsWith("+") ? "text-[#00FF41]" : "text-[#FF3131]") : "text-white"
                }`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ACTIVE PAIR */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-heading mb-2">Active Pair</p>
          <div className="rounded-2xl flex items-center justify-between px-4 py-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
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
              <p className={`font-heading font-bold text-sm ${connected ? "text-[#00FF41]" : "text-white/25"}`}>
                {connected ? "+0.45%" : "--"}
              </p>
            </div>
          </div>
        </div>

        {/* ROBOT STATUS */}
        <div className="pb-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-heading mb-2">Robot Status</p>
          <div className="rounded-2xl flex items-center gap-3 px-4 py-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${active ? "bg-[#00FF41]/15 border border-[#00FF41]/30" : "bg-white/5 border border-white/10"}`}
              style={active ? { boxShadow: "0 0 14px rgba(0,255,65,0.4)" } : undefined}>
              <motion.div className={`w-2.5 h-2.5 rounded-full ${statusDot}`}
                animate={active ? { scale: [1, 1.5, 1], opacity: [1, 0.3, 1] } : {}}
                transition={{ duration: 1.2, repeat: Infinity }} />
            </div>
            <div>
              <p className={`font-heading font-bold text-sm tracking-wider ${statusColor}`}>{statusLabel}</p>
              <p className="text-[10px] text-white/35 mt-0.5">{statusDesc}</p>
            </div>
          </div>
        </div>
      </div>

      <RobotStartModal open={showStartModal} onClose={() => setShowStartModal(false)} onStart={handleLaunchRobot} />
    </div>
  );
}