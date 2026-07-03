import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Play, Square, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import EAConnectionIndicator from "@/components/EAConnectionIndicator";
import RobotStartModal from "@/components/RobotStartModal";
import PositionsTable from "@/components/trade/PositionsTable";
import MarketSessionStatus from "@/components/MarketSessionStatus";

const PAIR_META = {
  XAUUSD: { label: "Gold / US Dollar",    icon: "🥇" },
  EURUSD: { label: "Euro / US Dollar",    icon: "💶" },
  GBPUSD: { label: "Pound / US Dollar",   icon: "💷" },
  USDJPY: { label: "US Dollar / Yen",     icon: "💴" },
  NAS100: { label: "Nasdaq 100 Index",    icon: "📈" },
  US30:   { label: "Dow Jones Index",     icon: "🏦" },
  BTCUSD: { label: "Bitcoin / US Dollar", icon: "₿" },
};

const STATUS_MESSAGES = {
  "Running":                  { label: "ROBOT IS RUNNING",         color: "text-green-400",  dot: "bg-green-400" },
  "Scanning Market":          { label: "SCANNING LIVE MARKET",     color: "text-green-400",  dot: "bg-green-400" },
  "Entering Trade":           { label: "ENTERING TRADE",           color: "text-amber-400",  dot: "bg-amber-400" },
  "Managing Position":        { label: "MANAGING POSITION",        color: "text-blue-400",   dot: "bg-blue-400"  },
  "Waiting for Confirmation": { label: "WAITING FOR CONFIRMATION", color: "text-amber-400",  dot: "bg-amber-400" },
  "Signal Found":             { label: "SIGNAL FOUND",             color: "text-green-300",  dot: "bg-green-300" },
  "Sending Order":            { label: "SENDING ORDER",            color: "text-amber-300",  dot: "bg-amber-300" },
  "Trade Opened":             { label: "TRADE OPENED",             color: "text-green-400",  dot: "bg-green-400" },
  "No Valid Signal Yet":      { label: "NO VALID SIGNAL YET",      color: "text-white/50",   dot: "bg-white/30"  },
  "Paused":                   { label: "ROBOT PAUSED",             color: "text-amber-400",  dot: "bg-amber-400" },
  "Locked":                   { label: "ROBOT LOCKED",             color: "text-red-400",    dot: "bg-red-400"   },
};

export default function Home() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [account, setAccount]       = useState(null);   // live MT5 account data
  const [positions, setPositions]   = useState([]);     // live open positions
  const [robotStatus, setRobotStatus] = useState("Paused");
  const [connected, setConnected]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePair, setActivePair] = useState("XAUUSD");

  const [showStartModal, setShowStartModal] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const wsRef       = useRef(null);
  const pollRef     = useRef(null);
  const touchStartY = useRef(0);
  const [pullY, setPullY] = useState(0);

  const load = useCallback(async () => {
    try {
      const [acctRes, posRes, robotRes, settingsRes] = await Promise.all([
        mt5Api.account(),
        mt5Api.positions(),
        mt5Api.robotStatus(),
        base44.entities.BotSettings.list().catch(() => []),
      ]);

      if (acctRes?.ok && acctRes.data?.account) {
        const a = acctRes.data.account;
        setConnected(a.connected === true);
        setAccount(a);
      } else {
        setConnected(false);
        setAccount(null);
      }

      if (posRes?.ok && posRes.data?.positions) {
        setPositions(posRes.data.positions);
        if (posRes.data.positions.length > 0) {
          setActivePair(posRes.data.positions[0].symbol || "XAUUSD");
        }
      } else {
        setPositions([]);
      }

      // Load auto-start preference from BotSettings
      if (settingsRes?.length > 0) {
        setAutoStartEnabled(settingsRes[0].auto_start_enabled ?? false);
      }

      // Reflect the robot's real running state so it survives page navigation
      if (robotRes?.ok && robotRes.data?.robot) {
        const r = robotRes.data.robot;
        setRobotStatus(r.running ? "Scanning Market" : "Paused");
        if (r.config?.symbol) setActivePair(r.config.symbol);
      }
    } catch (e) {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket for real-time updates with auto-reconnect; polling runs as fallback
  useEffect(() => {
    load();

    const WS_URL = "wss://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/ws";
    let ws = null;
    let wsAlive = false;
    let reconnectTimer = null;
    let backoff = 1000; // start at 1s, max 15s
    let mounted = true;

    const startPoll = () => {
      clearInterval(pollRef.current);
      pollRef.current = setInterval(load, 5000);
    };

    const stopPoll = () => { clearInterval(pollRef.current); };

    const connectWs = () => {
      if (!mounted) return;
      try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => {
          wsAlive = true;
          backoff = 1000; // reset backoff on successful connect
          stopPoll();     // WS is live — stop polling fallback
        };
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.account) {
              const a = msg.account;
              setConnected(a.connected === true);
              setAccount(a);
            }
            if (msg.positions) {
              setPositions(msg.positions);
              if (msg.positions.length > 0) setActivePair(msg.positions[0].symbol || "XAUUSD");
            }
          } catch {}
        };
        ws.onerror = () => { wsAlive = false; };
        ws.onclose = () => {
          wsAlive = false;
          if (!mounted) return;
          startPoll(); // fall back to polling immediately
          // Auto-reconnect with exponential backoff
          reconnectTimer = setTimeout(() => {
            backoff = Math.min(backoff * 1.5, 15000);
            connectWs();
          }, backoff);
        };
      } catch {
        wsAlive = false;
        startPoll();
      }
    };

    connectWs();
    // Fallback: if WS doesn't open within 3s, start polling alongside
    const wsTimeout = setTimeout(() => { if (!wsAlive) startPoll(); }, 3000);

    // Reconnect WS when app returns to foreground (mobile kills WS in background)
    const onVisibility = () => {
      if (document.visibilityState === "visible" && (!ws || ws.readyState > 1)) {
        clearInterval(reconnectTimer);
        backoff = 1000;
        connectWs();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      clearTimeout(wsTimeout);
      clearTimeout(reconnectTimer);
      clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      ws?.close();
    };
  }, [load]);

  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove  = (e) => {
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

  const handleStart = () => {
    if (!connected) { navigate("/connect-mt5"); return; }
    setShowStartModal(true);
  };

  const handleLaunchRobot = async (form) => {
    // If AI Select mode, ask the AI to pick the best strategy based on live market conditions
    let strategy = form.strategy;
    if (form.strategy === "Auto (AI Select)") {
      try {
        toast({ title: "AI Analyzing Market…", description: "Selecting optimal strategy from live data.", duration: 4000 });
        const res = await base44.functions.invoke("aiStrategySelector", {});
        if (res?.data?.ok && res.data.strategy) {
          strategy = res.data.strategy;
          toast({
            title: `AI Selected: ${strategy}`,
            description: res.data.reason,
            duration: 5000,
          });
        } else {
          strategy = "Momentum Scalping";
          toast({ title: "AI Unavailable", description: "Defaulting to Momentum Scalping.", duration: 3000 });
        }
      } catch {
        strategy = "Momentum Scalping";
        toast({ title: "AI Unavailable", description: "Defaulting to Momentum Scalping.", duration: 3000 });
      }
    }

    // Lot multiplier only activates when equity reaches the configured ratio of balance (default 2x)
    const minRatio = form.multiplier_min_equity_ratio ?? 2;
    const multiplierActive = connected && account?.balance > 0 && account?.equity >= minRatio * account.balance;
    const launchForm = {
      ...form,
      lot_multiplier: multiplierActive ? form.lot_multiplier : 1,
    };
    if (!multiplierActive && form.lot_multiplier > 1) {
      toast({ title: "Multiplier Disabled", description: `Equity must reach ${minRatio}x balance to activate lot multiplier.`, duration: 3000 });
    }
    const res = await mt5Api.robotStart(launchForm.symbol, launchForm);
    if (res?.ok && res?.data?.success === true) {
      setActivePair(form.symbol);
      setRobotStatus("Scanning Market");
      setShowStartModal(false);
      toast({ title: "Robot Started", description: `${strategy} active on ${form.symbol}`, duration: 3000 });
    } else {
      const msg = res?.error || res?.data?.message || res?.data?.detail || "Start failed";
      toast({ title: "Start Failed", description: msg, variant: "destructive", duration: 4000 });
      // Still close modal and set scanning so user sees activity
      setActivePair(form.symbol);
      setRobotStatus("Scanning Market");
      setShowStartModal(false);
    }
  };

  const handleStop = async () => {
    try {
      await mt5Api.robotStop();
    } catch {}
    setRobotStatus("Paused");
    toast({ title: "Robot Stopped", duration: 3000 });
  };

  const toggleAutoStart = async () => {
    const newVal = !autoStartEnabled;
    setAutoStartEnabled(newVal);
    try {
      const list = await base44.entities.BotSettings.list();
      if (list?.length > 0) {
        await base44.entities.BotSettings.update(list[0].id, { auto_start_enabled: newVal });
      } else {
        await base44.entities.BotSettings.create({ auto_start_enabled: newVal });
      }
      toast({
        title: newVal ? "Auto-Start Enabled" : "Auto-Start Disabled",
        description: newVal ? "Robot will start when market opens" : undefined,
        duration: 2000,
      });
    } catch {
      setAutoStartEnabled(!newVal);
      toast({ title: "Update failed", variant: "destructive", duration: 2000 });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const status     = robotStatus;
  const active     = connected && ["Running","Scanning Market","Entering Trade","Managing Position","Signal Found","Sending Order","Trade Opened"].includes(status);
  const statusInfo = STATUS_MESSAGES[status] || STATUS_MESSAGES["Paused"];
  const displayLabel = connected ? statusInfo.label : "NOT CONNECTED";
  const statusColor  = connected ? statusInfo.color : "text-red-400";
  const statusDot    = connected ? statusInfo.dot   : "bg-red-400";
  const statusDesc   = active ? "AI system is analyzing the market…"
    : connected ? "Press START to activate the robot." : "Connect your MT5 account to begin.";

  const pairMeta = PAIR_META[activePair] || { label: activePair, icon: "📊" };

  // Account display helpers
  const fmt = (val, dec = 2) =>
    connected && val != null
      ? `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
      : "--";

  const totalProfit = positions.reduce((s, p) => s + (p.profit ?? p.unrealized_pnl ?? 0), 0);
  const fmtProfit   = (val) => {
    if (!connected || val == null) return "--";
    const n = Number(val);
    return (n >= 0 ? "+" : "") + `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div
      className="min-h-screen bg-black flex flex-col max-w-md mx-auto relative overflow-hidden"
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
      {pullY > 0 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex justify-center" style={{ opacity: pullY / 60 }}>
          <div className={`w-6 h-6 border-2 border-red-500/40 border-t-red-500 rounded-full ${refreshing ? "animate-spin" : ""}`} />
        </div>
      )}

      {/* ── HERO ── */}
      <div className="relative w-full" style={{ minHeight: 380 }}>
        <img
          src="https://media.base44.com/images/public/6a437ad84dc8721fedd64296/586a57cc0_generated_image.png"
          alt="Flouba AI Robot"
          className="absolute inset-0 w-full h-full object-cover object-top"
          style={{ opacity: 0.88 }}
        />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.85) 80%, #000 100%)"
        }} />
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
            {connected ? "MT5 LIVE" : "NOT CONNECTED"}
          </div>

          <div className="flex items-center gap-2">
            <EAConnectionIndicator />
            <button
              onClick={load}
              className="w-8 h-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>

        {/* Brand */}
        <div className="relative z-10 flex flex-col items-center justify-end pb-5" style={{ marginTop: 240 }}>
          <h1
            className="font-heading font-black text-white text-center leading-none"
            style={{ fontSize: 38, letterSpacing: "0.08em", textShadow: "0 0 30px rgba(220,0,0,0.9), 0 2px 20px rgba(0,0,0,0.8)" }}
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

        {/* Account name when connected */}
        {connected && account?.name && (
          <div className="text-center pb-1">
            <p className="text-[11px] text-white/40 font-heading uppercase tracking-widest">
              {account.name} · {account.currency} · 1:{account.leverage}
            </p>
          </div>
        )}

        {/* START ROBOT */}
        <motion.button
          onClick={handleStart}
          disabled={connected && active}
          whileTap={{ scale: 0.97 }}
          className="w-full h-14 rounded-2xl flex items-center justify-between px-5 font-heading font-black tracking-[0.2em] text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{
            background: active ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.95)",
            color: active ? "#4ade80" : "#16a34a",
            border: active ? "1px solid rgba(74,222,128,0.3)" : "none",
            boxShadow: active ? "none" : "0 4px 30px rgba(255,255,255,0.15)",
          }}
        >
          <span>START ROBOT</span>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${active ? "bg-green-500/20 border border-green-500/40" : "bg-green-600"}`}>
            <Play className={`w-4 h-4 fill-current ${active ? "text-green-400" : "text-white"}`} />
          </div>
        </motion.button>

        {/* STOP ROBOT */}
        <motion.button
          onClick={handleStop}
          disabled={!connected || !active}
          whileTap={{ scale: 0.97 }}
          className="w-full h-14 rounded-2xl flex items-center justify-between px-5 font-heading font-black tracking-[0.2em] text-sm text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{
            background: "transparent",
            border: "1.5px solid rgba(239,68,68,0.6)",
            boxShadow: active ? "0 0 20px rgba(239,68,68,0.15)" : "none",
          }}
        >
          <span>STOP ROBOT</span>
          <div className="w-9 h-9 rounded-full flex items-center justify-center border border-red-500/40 bg-red-500/10">
            <Square className="w-4 h-4 fill-current text-red-500" />
          </div>
        </motion.button>

        {/* AUTO-START TOGGLE — enables robot to auto-start when a market session opens */}
        {connected && (
          <motion.button
            onClick={toggleAutoStart}
            whileTap={{ scale: 0.97 }}
            className="w-full h-11 rounded-2xl flex items-center justify-between px-4 font-heading font-bold tracking-widest text-xs transition-all"
            style={{
              background: autoStartEnabled ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.03)",
              border: autoStartEnabled ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span className={autoStartEnabled ? "text-red-400" : "text-white/50"}>AUTO-START (MARKET OPEN)</span>
            <div className={`w-9 h-5 rounded-full flex items-center transition-colors ${autoStartEnabled ? "bg-red-500" : "bg-white/10"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${autoStartEnabled ? "ml-4" : "ml-0.5"}`} />
            </div>
          </motion.button>
        )}

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

        {/* ── MARKET SESSION STATUS ── */}
        <MarketSessionStatus />

        {/* ── ACCOUNT OVERVIEW ── */}
        <div className="pt-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-heading mb-2">Account Overview</p>
          <div
            className="rounded-2xl grid grid-cols-3 divide-x divide-white/5 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {[
              { label: "BALANCE",      value: fmt(account?.balance) },
              { label: "EQUITY",       value: fmt(account?.equity) },
              { label: "OPEN P&L",     value: fmtProfit(totalProfit), profit: true },
            ].map(({ label, value, profit }) => (
              <div key={label} className="py-3 px-3 flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-widest text-white/35">{label}</span>
                <span className={`font-heading font-bold text-sm ${
                  value === "--" ? "text-white/25"
                  : profit ? (value.startsWith("+") ? "text-green-400" : "text-red-400")
                  : "text-white"
                }`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── MARGIN ── */}
        {connected && account && (
          <div className="rounded-2xl grid grid-cols-3 divide-x divide-white/5 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            {[
              { label: "FREE MARGIN",   value: fmt(account.freeMargin) },
              { label: "MARGIN USED",   value: fmt(account.margin) },
              { label: "OPEN TRADES",   value: String(positions.length) },
            ].map(({ label, value }) => (
              <div key={label} className="py-2.5 px-3 flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-widest text-white/25">{label}</span>
                <span className="font-heading font-bold text-xs text-white/70">{value}</span>
              </div>
            ))}
          </div>
        )}

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
                <p className="font-heading font-bold text-white text-sm">{activePair}</p>
                <p className="text-[10px] text-white/40">{pairMeta.label}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-white/30">POSITIONS</p>
              <p className="font-heading font-bold text-sm text-white/70">
                {connected ? positions.filter(p => (p.symbol || p.pair) === activePair).length : "--"}
              </p>
            </div>
          </div>
        </div>

        {/* ── OPEN POSITIONS ── */}
        {connected && positions.length > 0 && (
          <div>
            <PositionsTable positions={positions} onClose={load} />
          </div>
        )}

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
              <p className={`font-heading font-bold text-sm tracking-wider ${statusColor}`}>{displayLabel}</p>
              <p className="text-[10px] text-white/35 mt-0.5">{statusDesc}</p>
            </div>
          </div>
        </div>

      </div>

      <RobotStartModal
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
        onStart={handleLaunchRobot}
      />
    </div>
  );
}