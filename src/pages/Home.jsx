import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { RefreshCw, WifiOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import { logNotification } from "@/lib/notifications";
import FloubaHeader from "@/components/dashboard/FloubaHeader";
import GlobalMarketGlobe from "@/components/dashboard/GlobalMarketGlobe";
import SmartControlGrid from "@/components/dashboard/SmartControlGrid";
import StrategyControlCard from "@/components/dashboard/StrategyControlCard";
import AdaptiveStrategyPanel from "@/components/dashboard/AdaptiveStrategyPanel";
import CooldownBanner from "@/components/dashboard/CooldownBanner";
import BotActionButtons from "@/components/dashboard/BotActionButtons";
import RobotStartModal from "@/components/RobotStartModal";
import StrategyTimeframePanel from "@/components/dashboard/StrategyTimeframePanel";
import EADownloadCard from "@/components/dashboard/EADownloadCard";
import { getStrategyTimeframes } from "@/lib/strategyTimeframes";

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
  const [winRate, setWinRate] = useState(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [botSettings, setBotSettings] = useState(null);

  const wsRef = useRef(null);
  const pollRef = useRef(null);
  const touchStartY = useRef(0);
  const initialLoadRef = useRef(true);
  const [pullY, setPullY] = useState(0);

  const load = useCallback(async () => {
    try {
      const [acctRes, posRes, robotRes, settingsRes] = await Promise.all([
        mt5Api.account(),
        mt5Api.positions(),
        mt5Api.robotStatus(),
        base44.entities.BotSettings.list('-created_date', 1).catch(() => []),
      ]);

      // Unread notification count for the bell badge (failures ignored)
      base44.entities.Notification.filter({ read: false }).then((u) => setUnreadCount(u?.length || 0)).catch(() => {});

      const hasCreds = settingsRes?.[0]?.mt5_account;
      if (acctRes?.ok && acctRes.data?.account) {
        const a = acctRes.data.account;
        setConnected(a.connected === true);
        setAccount(a);
      } else {
        setConnected(false);
        setAccount(null);
      }

      // Auto-reconnect: if disconnected on first load but credentials are saved,
      // the MT5 terminal may need a few seconds to log back in after being idle.
      // Retry once after 4s before showing the "not connected" state permanently.
      if (initialLoadRef.current && !acctRes?.data?.account?.connected && hasCreds) {
        initialLoadRef.current = false;
        let retryCount = 0;
        const retryConnect = async () => {
          if (retryCount >= 3) return;
          retryCount++;
          const retry = await mt5Api.account().catch(() => null);
          if (retry?.ok && retry.data?.account?.connected === true) {
            setConnected(true);
            setAccount(retry.data.account);
            const retryPos = await mt5Api.positions().catch(() => null);
            if (retryPos?.ok && retryPos.data?.positions) setPositions(retryPos.data.positions);
          } else if (retryCount < 3) {
            setTimeout(retryConnect, 3000);
          }
        };
        setTimeout(retryConnect, 3000);
      } else if (initialLoadRef.current) {
        initialLoadRef.current = false;
      }

      if (posRes?.ok && posRes.data?.positions) {
        setPositions(posRes.data.positions);
        if (posRes.data.positions.length > 0) setActivePair(posRes.data.positions[0].symbol || "XAUUSD");
      } else {
        setPositions([]);
      }

      if (settingsRes?.length > 0) {
        setBotSettings(settingsRes[0]);
        setAutoStartEnabled(settingsRes[0].auto_start_enabled ?? false);
        if (settingsRes[0].win_rate != null && settingsRes[0].win_rate > 0) setWinRate(settingsRes[0].win_rate);
      } else {
        setBotSettings(null);
      }

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

  // WebSocket real-time + 15s polling fallback (preserved)
  useEffect(() => {
    load();
    const WS_URL = "wss://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev/ws";
    let ws = null, wsAlive = false, reconnectTimer = null, backoff = 1000, mounted = true;

    const startPoll = () => { clearInterval(pollRef.current); pollRef.current = setInterval(load, 15000); };
    const stopPoll = () => clearInterval(pollRef.current);

    const connectWs = () => {
      if (!mounted) return;
      try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => { wsAlive = true; backoff = 1000; stopPoll(); };
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.account) { setConnected(msg.account.connected === true); setAccount(msg.account); }
            if (msg.positions) { setPositions(msg.positions); if (msg.positions.length > 0) setActivePair(msg.positions[0].symbol || "XAUUSD"); }
          } catch {}
        };
        ws.onerror = () => { wsAlive = false; };
        ws.onclose = () => {
          wsAlive = false;
          if (!mounted) return;
          startPoll();
          reconnectTimer = setTimeout(() => { backoff = Math.min(backoff * 1.5, 15000); connectWs(); }, backoff);
        };
      } catch { wsAlive = false; startPoll(); }
    };
    connectWs();
    const wsTimeout = setTimeout(() => { if (!wsAlive) startPoll(); }, 3000);
    const onVisibility = () => {
      if (document.visibilityState === "visible" && (!ws || ws.readyState > 1)) { clearTimeout(reconnectTimer); backoff = 1000; connectWs(); }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted = false; clearTimeout(wsTimeout); clearTimeout(reconnectTimer); clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVisibility); ws?.close();
    };
  }, [load]);

  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e) => {
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0 && window.scrollY === 0) setPullY(Math.min(dy * 0.4, 60));
  };
  const handleTouchEnd = async () => {
    if (pullY > 45) { setRefreshing(true); await load(); setRefreshing(false); }
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
      ...launchForm,
      strategy,
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
      // Keep status Paused and modal closed so the user can retry — do NOT flip to active.
    }
  };

  const handlePause = async () => {
    try { await mt5Api.robotStop(); } catch {}
    setRobotStatus("Paused");
    toast({ title: "Robot Paused", duration: 3000 });
    logNotification({ type: "bot_action", title: "Robot Paused", message: "Trading robot was paused by user.", category: "info" });
  };

  const handleStopAll = async () => {
    try {
      if (connected) { await mt5Api.robotStop(); }
      if (positions.length > 0) { await mt5Api.closeAll(); }
    } catch {}
    setRobotStatus("Paused");
    toast({ title: "Stop All Sent", description: "Robot paused · close-all requested from MT5 backend.", duration: 3500 });
    logNotification({ type: "alert", title: "Stop All Executed", message: "Robot paused and all open positions requested to close.", category: "warning", meta: { openPositions: positions.length } });
    setTimeout(load, 1500);
  };

  const handleDisconnect = async () => {
    if (connected) { try { await mt5Api.robotStop(); } catch {} }
    try {
      const list = await base44.entities.BotSettings.list();
      if (list?.length > 0) {
        await base44.entities.BotSettings.update(list[0].id, {
          mt5_account: null, mt5_password: null, mt5_server: null, broker_name: null, connection_status: "Disconnected",
        });
      }
    } catch {}
    setConnected(false); setAccount(null); setPositions([]); setRobotStatus("Paused");
    toast({ title: "MT5 Disconnected", description: "Your account has been unlinked.", duration: 3000 });
    logNotification({ type: "connection", title: "MT5 Disconnected", message: "Your MT5 account has been unlinked from Flouba Elite.", category: "danger" });
  };

  const toggleAutoStart = async () => {
    const newVal = !autoStartEnabled; setAutoStartEnabled(newVal);
    try {
      const list = await base44.entities.BotSettings.list();
      if (list?.length > 0) await base44.entities.BotSettings.update(list[0].id, { auto_start_enabled: newVal });
      else await base44.entities.BotSettings.create({ auto_start_enabled: newVal });
      toast({ title: newVal ? "Auto-Start Enabled" : "Auto-Start Disabled", description: newVal ? "Robot will start when market opens" : undefined, duration: 2000 });
    } catch { setAutoStartEnabled(!newVal); toast({ title: "Update failed", variant: "destructive", duration: 2000 }); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" style={{ boxShadow: "0 0 18px rgba(255,56,56,0.4)" }} />
          <p className="font-heading text-[10px] tracking-[0.3em] text-red-400/70">FLOUBA ELITE</p>
        </div>
      </div>
    );
  }

  const active = connected && ["Running", "Scanning Market", "Entering Trade", "Managing Position", "Signal Found", "Sending Order", "Trade Opened"].includes(robotStatus);

  return (
    <div
      className="min-h-screen flex flex-col relative"
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
      {pullY > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50" style={{ opacity: pullY / 60 }}>
          <div className={`w-6 h-6 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full ${refreshing ? "animate-spin" : ""}`} />
        </div>
      )}

      <FloubaHeader onMenu={() => navigate("/settings")} onBell={() => navigate("/notifications")} unread={unreadCount} />

      <div className="flex-1 px-4 sm:px-6 lg:px-8 pt-4 pb-8 space-y-4 max-w-md sm:max-w-2xl lg:max-w-4xl mx-auto w-full">
        {/* Live data banner / quick controls */}
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-heading font-bold uppercase tracking-widest ${connected ? "text-[#00ff9d]" : "text-[#ff6b6b]"}`}
            style={{ background: connected ? "rgba(0,255,157,0.08)" : "rgba(255,77,77,0.08)", border: `1px solid ${connected ? "rgba(0,255,157,0.35)" : "rgba(255,77,77,0.35)"}` }}>
            <motion.span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00ff9d]" : "bg-[#ff6b6b]"}`}
              animate={connected ? { scale: [1, 1.6, 1], opacity: [1, 0.4, 1] } : {}} transition={{ duration: 1.5, repeat: Infinity }} />
            {connected ? "MT5 LIVE" : "NOT CONNECTED"}
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <button onClick={() => navigate("/connect-mt5")} className="text-[10px] font-heading tracking-widest text-red-400/80 px-2.5 py-1.5 rounded-lg glass">CONNECTED</button>
            )}
            <button onClick={load} className="w-8 h-8 rounded-full glass flex items-center justify-center">
              <RefreshCw className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        </div>

        {!connected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass rounded-2xl p-4 flex items-center gap-3" style={{ border: "1px solid rgba(255,77,77,0.25)" }}>
            <WifiOff className="w-5 h-5 text-[#ff6b6b] shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] font-heading tracking-wider text-white/80">No live data connected</p>
              <p className="text-[10px] text-white/45">Connect MT5 to view live chart, signals & bot status.</p>
            </div>
            <button onClick={() => navigate("/connect-mt5")} className="text-[10px] font-heading tracking-widest text-red-400 px-3 py-2 rounded-lg" style={{ background: "rgba(255,56,56,0.1)", border: "1px solid rgba(255,56,56,0.4)" }}>CONNECT</button>
          </motion.div>
        )}

        {/* Cooldown countdown — shown when bot paused after hitting session target */}
        <CooldownBanner settings={botSettings} />

        {/* 1. Global Market Intelligence — 3D AI globe */}
        <GlobalMarketGlobe connected={connected} navigate={navigate} />

        {/* 1a. EA Download */}
        <EADownloadCard />

        {/* 2. Smart Control Grid */}
        <SmartControlGrid connected={connected} robotStatus={robotStatus} account={account} positions={positions} winRate={winRate} navigate={navigate} />

        {/* 3. Strategy Control */}
        <StrategyControlCard />

        {/* 3a. Strategy Timeframe Engine */}
        <StrategyTimeframePanel />

        {/* 3b. Adaptive Strategy Manager */}
        <AdaptiveStrategyPanel connected={connected} />

        {/* 4. Account snapshot when connected */}
        {connected && account && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: "BALANCE", v: account.balance != null ? `$${Number(account.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--" },
              { l: "EQUITY", v: account.equity != null ? `$${Number(account.equity).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--" },
              { l: "OPEN P&L", v: positions.length > 0 ? `${positions.reduce((s, p) => s + (p.profit ?? p.unrealized_pnl ?? 0), 0) >= 0 ? "+" : ""}$${Math.abs(positions.reduce((s, p) => s + (p.profit ?? p.unrealized_pnl ?? 0), 0)).toFixed(2)}` : "--", pnl: true },
            ].map((m) => (
              <div key={m.l} className="glass rounded-xl py-2.5 px-2.5">
                <p className="text-[8px] uppercase tracking-widest text-white/35">{m.l}</p>
                <p className={`font-heading font-bold text-[12px] mt-0.5 ${m.pnl ? (m.v.startsWith("+") ? "text-[#00ff9d]" : "text-[#ff4d4d]") : "text-white"}`}>{m.v}</p>
              </div>
            ))}
          </div>
        )}

        {/* 5. Start / Auto-start / Disconnect controls */}
        <div className="space-y-2.5">
          {!connected ? (
            <button onClick={() => navigate("/connect-mt5")}
              className="w-full rounded-2xl font-heading font-black tracking-widest text-[12px] text-[#1a0000] active:scale-[0.98] transition-transform py-3.5"
              style={{ background: "linear-gradient(90deg, #ff3838, #cc1818)", boxShadow: "0 0 22px rgba(255,56,56,0.45)" }}>
              CONNECT MT5 ACCOUNT
            </button>
          ) : (
            <button onClick={handleStart} disabled={active}
              className="w-full rounded-2xl font-heading font-black tracking-widest text-[12px] active:scale-[0.98] transition-transform py-3.5 disabled:opacity-50"
              style={active
                ? { background: "rgba(0,255,157,0.08)", border: "1px solid rgba(0,255,157,0.35)", color: "#00ff9d" }
                : { background: "linear-gradient(90deg, #ff3838, #cc1818)", color: "#1a0000", boxShadow: "0 0 22px rgba(255,56,56,0.45)" }}>
              {active ? "ROBOT ACTIVE" : "START ROBOT"}
            </button>
          )}

          {connected && (
            <button onClick={toggleAutoStart}
              className="w-full h-11 rounded-2xl flex items-center justify-between px-4 font-heading font-bold tracking-widest text-[10px] transition-colors"
              style={{ background: autoStartEnabled ? "rgba(255,140,66,0.1)" : "rgba(255,255,255,0.03)", border: autoStartEnabled ? "1px solid rgba(255,140,66,0.4)" : "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ color: autoStartEnabled ? "#ff8c42" : "rgba(255,255,255,0.5)" }}>AUTO-START (MARKET OPEN)</span>
              <div className={`w-9 h-5 rounded-full flex items-center transition-colors ${autoStartEnabled ? "bg-[#ff8c42]" : "bg-white/10"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${autoStartEnabled ? "ml-4" : "ml-0.5"}`} />
              </div>
            </button>
          )}

          {connected && (
            <button onClick={handleDisconnect}
              className="w-full h-11 rounded-2xl font-heading text-[10px] tracking-widest text-white/40 hover:text-[#ff6b6b] transition-colors py-2"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              DISCONNECT MT5
            </button>
          )}
        </div>

        {/* 6. Bot action buttons */}
        <BotActionButtons connected={connected} active={active} onPause={handlePause} onStopAll={handleStopAll} />

        {/* 7. Open positions */}
        {connected && positions.length > 0 && (
          <div className="glass rounded-2xl p-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-heading mb-2">Open Positions ({positions.length})</p>
            <div className="space-y-2">
              {positions.slice(0, 4).map((p, i) => {
                const sym = p.symbol || p.pair || activePair;
                const dir = (p.direction || (p.type || "")).toString().toLowerCase().includes("sell") ? "Sell" : "Buy";
                const profit = p.profit ?? p.unrealized_pnl ?? 0;
                return (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-heading font-bold ${dir === "Buy" ? "text-[#00ff9d] bg-[#00ff9d]/10" : "text-[#ff4d4d] bg-[#ff4d4d]/10"}`}>{dir.toUpperCase()}</span>
                      <span className="font-heading text-[11px] text-white tracking-wide">{sym}</span>
                      <span className="text-[10px] text-white/40">{p.volume ?? p.lot ?? "--"}</span>
                    </div>
                    <span className={`font-heading font-bold text-[11px] ${profit >= 0 ? "text-[#00ff9d]" : "text-[#ff4d4d]"}`}>
                      {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <RobotStartModal open={showStartModal} onClose={() => setShowStartModal(false)} onStart={handleLaunchRobot} />
    </div>
  );
}