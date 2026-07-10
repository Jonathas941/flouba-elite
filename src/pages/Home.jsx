import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Play, Square, Bell, ChevronDown, Radar, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import { logNotification } from "@/lib/notifications";
import RobotStartModal from "@/components/RobotStartModal";
import StrategyControlCard from "@/components/dashboard/StrategyControlCard";
import StrategyTimeframePanel from "@/components/dashboard/StrategyTimeframePanel";
import AdaptiveStrategyPanel from "@/components/dashboard/AdaptiveStrategyPanel";
import CooldownBanner from "@/components/dashboard/CooldownBanner";
import AutoStartButton from "@/components/dashboard/AutoStartButton";
import HftModeButton from "@/components/dashboard/HftModeButton";
import HolographicHero from "@/components/dashboard/hud/HolographicHero";
import HudPanel from "@/components/dashboard/hud/HudPanel";
import DynamicDailyTargetPanel from "@/components/dashboard/DynamicDailyTargetPanel";
import EmaIndicatorPanel from "@/components/dashboard/EmaIndicatorPanel";
import AccountSwitcher from "@/components/dashboard/AccountSwitcher";
import { getStrategyTimeframes } from "@/lib/strategyTimeframes";

const PAIR_META = {
  XAUUSD:   { label: "Gold / US Dollar",       icon: "🥇" },
  XAUUSDm:  { label: "Gold / USD (Micro)",     icon: "🥇" },
  XAUUSDs:  { label: "Gold / USD (Standard)",  icon: "🥇" },
  EURUSD:   { label: "Euro / US Dollar",       icon: "💶" },
  EURUSDm:  { label: "Euro / USD (Micro)",     icon: "💶" },
  GBPUSD:   { label: "Pound / US Dollar",      icon: "💷" },
  GBPUSDm:  { label: "Pound / USD (Micro)",    icon: "💷" },
  USDJPY:   { label: "US Dollar / Yen",        icon: "💴" },
  USDJPYm:  { label: "USD / Yen (Micro)",      icon: "💴" },
  NAS100:   { label: "Nasdaq 100 Index",       icon: "📈" },
  NAS100m:  { label: "Nasdaq 100 (Micro)",     icon: "📈" },
  US30:     { label: "Dow Jones Index",        icon: "🏦" },
  US30m:    { label: "Dow Jones (Micro)",      icon: "🏦" },
  BTCUSD:   { label: "Bitcoin / US Dollar",    icon: "₿" },
  BTCUSDm:  { label: "Bitcoin / USD (Micro)",  icon: "₿" },
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
  const [botSettings, setBotSettings] = useState(null);

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
      if (acctRes?.ok && acctRes.data?.account) {
        const a = acctRes.data.account;
        setConnected(a.balance != null);
        setAccount(a);
      } else {
        setConnected(false);
        setAccount(null);
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
      if (settingsRes?.length > 0) {
        settingsRef.current = settingsRes[0];
        setBotSettings(settingsRes[0]);
      } else {
        settingsRef.current = null;
        setBotSettings(null);
      }
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

  const handleStart = async () => {
    if (!connected) { navigate("/connect-mt5"); return; }
    // Evaluate the decision engine before opening the start modal — professional intelligence
    try {
      const res = await base44.functions.invoke("tradeDecisionEngine", {});
      const d = res?.data;
      if (d?.ok && d.connected) {
        if (d.decision === "NO_TRADE") {
          toast({
            title: "Market Not Optimal",
            description: `${d.reason} Robot will start in scanning mode and wait for a high-quality setup.`,
            duration: 5000,
          });
        } else if (d.decision === "TRADE") {
          toast({
            title: "Conditions Aligned",
            description: `${d.direction} signal ready — confluence ${d.score}/100. All 8 pillars confirmed.`,
            duration: 4000,
          });
        }
      }
    } catch {}
    setShowStartModal(true);
  };

  const handleLaunchRobot = async (form) => {
    // ── Dynamic Daily Target: check lock + risk reduction before launching ──
    try {
      const ddtRes = await base44.functions.invoke("dynamicDailyTargetEngine", {});
      const ddt = ddtRes?.data;
      if (ddt?.ok && ddt?.enabled) {
        if (!ddt.trading_allowed) {
          toast({ title: "DDT Lock Active", description: ddt.lock_message || "Trading locked by Dynamic Daily Target.", variant: "destructive", duration: 5000 });
          setShowStartModal(false);
          return;
        }
        if (ddt.risk_multiplier < 1) {
          form = { ...form, lot_size: Number((form.lot_size * ddt.risk_multiplier).toFixed(2)) };
          toast({ title: "DDT Risk Reduction", description: `Lot reduced to ${form.lot_size} (${(ddt.risk_multiplier * 100).toFixed(0)}% — tier ${ddt.tier}).`, duration: 4000 });
        }
      }
    } catch {}

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
    const launchForm = { ...form, lot_multiplier: form.lot_multiplier ?? 1 };
    const tf = getStrategyTimeframes(strategy);
    let launchFormWithTF = {
      ...launchForm, strategy,
      strategy_timeframe: tf.main,
      strategy_htf_timeframe: tf.htf || null,
      strategy_confirm_timeframe: tf.confirm || null,
      strategy_entry_timeframe: tf.entry || null,
    };

    // ── Multi-Pair Auto-Select: AI scans all pairs and picks the best N ──
    if (form.multi_pair_enabled) {
      try {
        toast({ title: "AI Selecting Pairs…", description: `Scanning market for top ${form.multi_pair_count} pairs.`, duration: 4000 });
        const mpRes = await base44.functions.invoke("multiPairSelector", {});
        const mp = mpRes?.data;
        if (mp?.ok && mp.pairs?.length > 0) {
          launchFormWithTF = { ...launchFormWithTF, symbols: mp.pairs, symbol: mp.pairs[0] };
          toast({ title: "Multi-Pair Selected", description: `${mp.pairs.join(", ")}${mp.reasoning ? ` — ${mp.reasoning.slice(0, 80)}` : ""}`, duration: 5000 });
        } else {
          toast({ title: "Multi-Pair Unavailable", description: "Could not auto-select pairs. Using default symbol.", variant: "destructive", duration: 4000 });
        }
      } catch {
        toast({ title: "Multi-Pair Selection Failed", description: "Using default symbol.", variant: "destructive", duration: 3000 });
      }
    }

    const res = await mt5Api.robotStart(launchFormWithTF.symbol, launchFormWithTF);
    if (res?.ok && res?.data?.success === true) {
      const activeSymbol = launchFormWithTF.symbol || form.symbol;
      const pairsLabel = launchFormWithTF.symbols?.length ? launchFormWithTF.symbols.join(", ") : activeSymbol;
      setActivePair(activeSymbol); setRobotStatus("Scanning Market"); setShowStartModal(false);
      toast({ title: "Robot Started", description: `${strategy} active on ${pairsLabel}`, duration: 3000 });
      logNotification({ type: "bot_action", title: "Robot Started", message: `${strategy} engine launched on ${pairsLabel}.`, category: "success", meta: { strategy, symbol: activeSymbol, symbols: launchFormWithTF.symbols || undefined } });
      setUnreadCount((c) => c + 1);
    } else {
      const msg = res?.error || res?.data?.message || res?.data?.detail || "Start failed";
      toast({ title: "Start Failed", description: msg, variant: "destructive", duration: 4000 });
    }
  };

  const handleDangerAutoStart = async () => {
    if (!connected) return;
    try {
      const pair = activePair || "XAUUSD";
      const res = await mt5Api.robotStart(pair, {
        symbol: pair,
        strategy: "HFT Scalper",
        lot_size: botSettings?.hft_base_lot ?? 0.01,
        hft_mode_enabled: true,
      });
      if (res?.ok && res?.data?.success === true) {
        setRobotStatus("Running");
        toast({ title: "⚠ Robot Auto-Started", description: "Danger Mode is now trading live — no waiting.", duration: 4000 });
        logNotification({ type: "bot_action", title: "Danger Mode Auto-Start", message: `Robot launched automatically on ${pair} in HFT Danger Mode.`, category: "danger", meta: { strategy: "HFT Scalper", symbol: pair } });
        setUnreadCount((c) => c + 1);
      } else {
        toast({ title: "Auto-Start Failed", description: res?.error || res?.data?.message || "Could not start robot.", variant: "destructive", duration: 4000 });
      }
    } catch (e) {
      toast({ title: "Auto-Start Failed", description: e.message, variant: "destructive", duration: 4000 });
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
  const dangerMode = botSettings?.hft_mode_enabled === true;

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
      className="min-h-screen bg-black flex flex-col w-full max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto relative overflow-x-hidden transition-all"
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      style={dangerMode ? { boxShadow: "inset 0 0 0 2px rgba(255,49,49,0.45), inset 0 0 80px rgba(255,49,49,0.12)" } : undefined}
    >
      {pullY > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50" style={{ opacity: pullY / 60 }}>
          <div className={`w-6 h-6 border-2 border-red-500/40 border-t-red-500 rounded-full ${refreshing ? "animate-spin" : ""}`} />
        </div>
      )}

      {dangerMode && (
        <motion.div
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-[60] px-4 pt-2"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="rounded-xl flex items-center justify-center gap-2 py-2"
            style={{ background: "rgba(255,49,49,0.18)", border: "1px solid rgba(255,49,49,0.50)", backdropFilter: "blur(12px)" }}>
            <motion.span className="w-2 h-2 rounded-full bg-[#FF3131]"
              animate={{ opacity: [1, 0.2, 1], scale: [1, 1.4, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
              style={{ boxShadow: "0 0 10px rgba(255,49,49,0.8)" }}
            />
            <span className="font-heading font-black text-[11px] tracking-[0.25em] text-[#FF3131]"
              style={{ textShadow: "0 0 12px rgba(255,49,49,0.6)" }}>
              DANGER MODE ACTIVE
            </span>
            <motion.span className="w-2 h-2 rounded-full bg-[#FF3131]"
              animate={{ opacity: [1, 0.2, 1], scale: [1, 1.4, 1] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: 0.45 }}
              style={{ boxShadow: "0 0 10px rgba(255,49,49,0.8)" }}
            />
          </div>
        </motion.div>
      )}

      <HolographicHero
        connected={connected}
        account={account}
        openPnl={openPnl}
        active={active}
        robotStatus={robotStatus}
        unreadCount={unreadCount}
        onNotifications={() => navigate("/notifications")}
        onConnectMT5={() => navigate("/connect-mt5")}
      />

      {/* ── CONTROLS ── */}
      <div className="relative z-10 px-4 sm:px-5 md:px-6 -mt-4 space-y-2.5 pt-2 pb-6 grid-lines"
        style={{ background: "#050505" }}>

        {/* START ROBOT */}
        <motion.button
          onClick={handleStart}
          disabled={connected && active}
          whileTap={{ scale: 0.97 }}
          className="w-full h-14 hud-hex flex items-center justify-center gap-3 font-mono font-black tracking-[0.25em] text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{
            background: "rgba(0,255,65,0.07)",
            color: "#00FF41",
            border: "1.5px solid rgba(0,255,65,0.5)",
            boxShadow: active ? "0 0 12px rgba(0,255,65,0.12)" : "0 0 22px rgba(0,255,65,0.18), inset 0 0 12px rgba(0,255,65,0.04)",
            textShadow: "0 0 10px rgba(0,255,65,0.5)",
          }}
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{active ? "ROBOT ACTIVE" : "INITIATE ROBOT"}</span>
        </motion.button>

        {/* STOP ROBOT */}
        <motion.button
          onClick={handleStop}
          disabled={!connected || !active}
          whileTap={{ scale: 0.97 }}
          className="w-full h-14 hud-hex flex items-center justify-center gap-3 font-mono font-black tracking-[0.25em] text-sm text-[#FF3131] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{
            background: "rgba(255,49,49,0.04)",
            border: "1.5px solid rgba(255,49,49,0.5)",
            boxShadow: active ? "0 0 18px rgba(255,49,49,0.15)" : "none",
            textShadow: "0 0 10px rgba(255,49,49,0.4)",
          }}
        >
          <Square className="w-4 h-4 fill-current" />
          <span>TERMINATE</span>
        </motion.button>

        {/* AUTO-START — scheduled daily robot launch */}
        <AutoStartButton settings={botSettings} onUpdate={(s) => setBotSettings(s)} />

        {/* HFT MODE — bypasses all rules, scalps any profit, compounds lots on wins */}
        <HftModeButton settings={botSettings} onUpdate={(s) => setBotSettings(s)} onAutoStart={handleDangerAutoStart} />

        {/* DYNAMIC DAILY TARGET — tiered profit targets with progressive risk reduction */}
        <DynamicDailyTargetPanel />

        {/* ACCOUNT SWITCHER — toggle between linked MT5 accounts */}
        <AccountSwitcher botSettings={botSettings} onSwitched={loadAll} />

        {/* ACCOUNT OVERVIEW */}
        <HudPanel label="Account Overview">
          <div className="grid grid-cols-3 divide-x divide-[#00FF41]/10">
            {[
              { label: "BALANCE", value: fmt(account?.balance) },
              { label: "EQUITY",  value: fmt(account?.equity) },
              { label: "PROFIT",  value: fmtProfit(connected ? (openPnl || account?.profit_today) : null), profit: true },
            ].map(({ label, value, profit }) => (
              <div key={label} className="py-1 px-2 flex flex-col gap-0.5 items-center text-center">
                <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-[#00FF41]/40">{label}</span>
                <span className={`font-mono font-bold text-sm ${
                  value === "--" ? "text-white/25" :
                  profit ? (value.startsWith("+") ? "text-[#00FF41]" : "text-[#FF3131]") : "text-white"
                }`} style={profit && value !== "--" && value.startsWith("+") ? { textShadow: "0 0 6px rgba(0,255,65,0.4)" } : {}}>{value}</span>
              </div>
            ))}
          </div>
        </HudPanel>

        {/* ACTIVE PAIR */}
        <HudPanel label="Active Pair" accent="#FFCC42">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 hud-clip-sm flex items-center justify-center text-lg"
                style={{ background: "rgba(255,204,66,0.1)", border: "1px solid rgba(255,204,66,0.25)" }}>
                {pairMeta.icon}
              </div>
              <div>
                <p className="font-mono font-bold text-white text-sm tracking-[0.1em]">{pair}</p>
                <p className="text-[9px] font-mono text-white/35">{pairMeta.label}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-mono uppercase tracking-[0.15em] text-[#00FF41]/35">CHANGE</p>
              <p className={`font-mono font-bold text-sm ${connected ? "text-[#00FF41]" : "text-white/25"}`}
                style={connected ? { textShadow: "0 0 6px rgba(0,255,65,0.3)" } : {}}>
                {connected ? "+0.45%" : "--"}
              </p>
            </div>
          </div>
        </HudPanel>

        {/* ROBOT STATUS */}
        <HudPanel label="Robot Status" accent={active ? "#00FF41" : "#FF3131"}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 hud-clip-sm flex items-center justify-center shrink-0 ${active ? "bg-[#00FF41]/12" : "bg-white/5"}`}
              style={{ border: `1px solid ${active ? "rgba(0,255,65,0.3)" : "rgba(255,255,255,0.1)"}`, boxShadow: active ? "0 0 14px rgba(0,255,65,0.3)" : undefined }}>
              <motion.div className={`w-2.5 h-2.5 rounded-full ${statusDot}`}
                animate={active ? { scale: [1, 1.5, 1], opacity: [1, 0.3, 1] } : {}}
                transition={{ duration: 1.2, repeat: Infinity }} />
            </div>
            <div>
              <p className={`font-mono font-bold text-sm tracking-[0.15em] ${statusColor}`}>{statusLabel}</p>
              <p className="text-[9px] font-mono text-white/35 mt-0.5">{statusDesc}</p>
            </div>
          </div>
        </HudPanel>

        {/* EMA 20 & 200 — live trend engine */}
        <EmaIndicatorPanel />

        {/* Cooldown countdown */}
        <CooldownBanner settings={botSettings} />

        {/* Strategy Control */}
        <StrategyControlCard />

        {/* Strategy Timeframe Engine */}
        <StrategyTimeframePanel />

        {/* Adaptive Strategy Manager */}
        <AdaptiveStrategyPanel connected={connected} />

        {/* LSR-3R Scanner Module */}
        <button onClick={() => navigate("/lsr3r")}
          className="w-full hud-clip flex items-center gap-3 px-4 py-3.5 mt-1 transition-all active:scale-[0.98]"
          style={{ background: "rgba(255,204,66,0.05)", border: "1px solid rgba(255,204,66,0.2)", backdropFilter: "blur(12px)" }}>
          <div className="w-10 h-10 hud-clip-sm flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,204,66,0.1)", border: "1px solid rgba(255,204,66,0.3)" }}>
            <Radar className="w-5 h-5" style={{ color: "#FFCC42" }} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-mono font-bold text-sm text-white tracking-[0.1em]">LSR-3R SCANNER</p>
            <p className="text-[9px] font-mono text-white/35">Liquidity Sweep · CHOCH · FVG — 1:3 RR</p>
          </div>
          <ChevronDown className="w-4 h-4 text-[#FFCC42]/40 rotate-[-90deg]" />
        </button>

        {/* Trade Journal — summary sheet of every closed trade */}
        <button onClick={() => navigate("/trade-journal")}
          className="w-full hud-clip flex items-center gap-3 px-4 py-3.5 transition-all active:scale-[0.98]"
          style={{ background: "rgba(255,49,49,0.04)", border: "1px solid rgba(255,49,49,0.18)", backdropFilter: "blur(12px)" }}>
          <div className="w-10 h-10 hud-clip-sm flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,49,49,0.08)", border: "1px solid rgba(255,49,49,0.25)" }}>
            <FileText className="w-5 h-5" style={{ color: "#FF3131" }} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-mono font-bold text-sm text-white tracking-[0.1em]">TRADE JOURNAL</p>
            <p className="text-[9px] font-mono text-white/35">Summary sheet — every win &amp; loss with date &amp; time</p>
          </div>
          <ChevronDown className="w-4 h-4 text-[#FF3131]/40 rotate-[-90deg]" />
        </button>
      </div>

      <RobotStartModal open={showStartModal} onClose={() => setShowStartModal(false)} onStart={handleLaunchRobot} />
    </div>
  );
}