import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import { base44 } from "@/api/base44Client";
import {
  TrendingUp, TrendingDown, Zap, Radio, WifiOff,
  Clock, Activity, BarChart3, Target, AlertTriangle,
} from "lucide-react";
import {
  PAIRS, TIMEFRAMES, MODE_THRESHOLD,
  computeAnalysis, getBestOpportunity,
  isSessionAllowed, getCurrentSession,
} from "@/lib/marketAnalysis";

function ScoreBar({ label, val, max, color }) {
  const pct = (val / max) * 100;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">{label}</span>
        <span className="text-[9px] font-bold text-white">{val}/{max}</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SignalBadge({ direction }) {
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg font-heading font-black text-xs ${
      direction === "BUY" ? "bg-green-500/20 text-green-400 border border-green-500/40" : "bg-red-500/20 text-red-400 border border-red-500/40"
    }`}>
      {direction === "BUY" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {direction}
    </div>
  );
}

export default function LiveScannerEngine({ onScanUpdate }) {
  const [connected, setConnected] = useState(false);
  const [botRunning, setBotRunning] = useState(false);
  const [tradingMode, setTradingMode] = useState("Balanced");
  const [newsFilter, setNewsFilter] = useState(true);
  const [selectedTf, setSelectedTf] = useState("M1");
  const [scanResults, setScanResults] = useState({});
  const [tick, setTick] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [signalAlerts, setSignalAlerts] = useState([]);
  const intervalRef = useRef(null);
  const settingsIdRef = useRef(null);
  const prevSignalsRef = useRef({});
  const tickRef = useRef(0);

  const loadSettings = useCallback(async () => {
    const list = await base44.entities.BotSettings.list();
    const s = list[0];
    if (s) {
      settingsIdRef.current = s.id;
      setConnected(s.connection_status === "Connected");
      setBotRunning(["Running", "Scanning Market", "Entering Trade", "Managing Position", "Signal Found", "Sending Order", "Trade Opened"].includes(s.robot_status));
      setTradingMode(s.trading_mode || "Balanced");
      setNewsFilter(s.news_filter ?? true);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    const unsub = base44.entities.BotSettings.subscribe((event) => {
      if (event.data) {
        setConnected(event.data.connection_status === "Connected");
        setBotRunning(["Running", "Scanning Market", "Entering Trade", "Managing Position", "Signal Found", "Sending Order", "Trade Opened"].includes(event.data.robot_status));
        setTradingMode(event.data.trading_mode || "Balanced");
        setNewsFilter(event.data.news_filter ?? true);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!connected || !botRunning) return;

    const runScan = () => {
      tickRef.current += 1;
      const currentTick = tickRef.current;
      const threshold = MODE_THRESHOLD[tradingMode] || 70;
      const session = getCurrentSession();
      const results = {};
      const newAlerts = [];

      PAIRS.forEach((pair) => {
        results[pair] = {};
        TIMEFRAMES.forEach((tf) => {
          const data = computeAnalysis(pair, tf, currentTick);
          const sessionOk = isSessionAllowed("All", session); // scanner shows all
          data.isValid = data.total >= threshold && data.spreadOk && data.atrOk && sessionOk;
          results[pair][tf] = data;

          const key = `${pair}-${tf}`;
          const wasSignal = prevSignalsRef.current[key];
          if (data.isValid && !wasSignal) {
            newAlerts.push({ pair, tf, direction: data.direction, score: data.total, time: new Date() });
          }
          prevSignalsRef.current[key] = data.isValid;
        });
      });

      setScanResults(results);
      setLastScanTime(new Date());
      setTick(currentTick);

      const best = getBestOpportunity(results, selectedTf);
      onScanUpdate?.({ results, best, session, tick: currentTick });

      if (newAlerts.length > 0) {
        setSignalAlerts((prev) => [...newAlerts, ...prev].slice(0, 5));
        if (settingsIdRef.current) {
          base44.entities.BotSettings.update(settingsIdRef.current, { robot_status: "Signal Found" });
        }
      }
    };

    intervalRef.current = setInterval(runScan, 1000);
    return () => clearInterval(intervalRef.current);
  }, [connected, botRunning, tradingMode, selectedTf, newsFilter]);

  const threshold = MODE_THRESHOLD[tradingMode] || 70;

  const getScoreStyle = (score) => {
    if (score >= 85) return { label: "STRONG SIGNAL", color: "text-green-400",  border: "border-green-500/30",  bg: "bg-green-500/8" };
    if (score >= 70) return { label: "VALID SIGNAL",  color: "text-amber-400",  border: "border-amber-500/30",  bg: "bg-amber-500/8" };
    if (score >= 60) return { label: "WEAK SIGNAL",   color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/8" };
    return                  { label: "NO SIGNAL",     color: "text-white/25",   border: "border-white/5",       bg: "" };
  };

  if (!connected) {
    return (
      <GlassCard className="py-14 flex flex-col items-center gap-4 text-center">
        <WifiOff className="w-10 h-10 text-muted-foreground/30" />
        <p className="font-heading text-sm uppercase tracking-widest text-muted-foreground">Waiting for MT5 Connection</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs">Connect your MT5 account from the dashboard to enable live scanning.</p>
      </GlassCard>
    );
  }

  if (!botRunning) {
    return (
      <GlassCard className="py-10 flex flex-col items-center gap-3 text-center">
        <Radio className="w-8 h-8 text-amber-400/40" />
        <p className="font-heading text-sm uppercase tracking-widest text-amber-400">Robot Paused</p>
        <p className="text-xs text-muted-foreground/60">Press START ROBOT on the Home screen to begin live scanning.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ scale: [1, 1.6, 1], opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }} />
          <span className="text-xs text-green-400 font-bold font-heading">SCANNING LIVE MARKET</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {lastScanTime ? lastScanTime.toLocaleTimeString() : "--"}
        </span>
      </div>

      {/* TF selector + threshold */}
      <div className="flex gap-2 items-center">
        {["M1","M5","M15","H1"].map((tf) => (
          <button key={tf} onClick={() => setSelectedTf(tf)}
            className={`px-3 py-1.5 rounded-xl font-heading text-xs font-bold uppercase tracking-widest transition-all ${selectedTf === tf ? "bg-red-600 text-white" : "glass text-muted-foreground"}`}>
            {tf}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 glass rounded-xl">
          <Target className="w-3 h-3 text-red-400" />
          <span className="text-[10px] font-bold text-white">{threshold}pt · {tradingMode}</span>
        </div>
      </div>

      {/* Signal alerts */}
      <AnimatePresence>
        {signalAlerts.map((alert) => (
          <motion.div key={`${alert.pair}-${alert.tf}-${alert.time.getTime()}`}
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}>
            <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${
              alert.direction === "BUY" ? "bg-green-500/10 border-green-500/40" : "bg-red-500/10 border-red-500/40"
            }`}>
              <div className="flex items-center gap-3">
                <Zap className={`w-4 h-4 ${alert.direction === "BUY" ? "text-green-400" : "text-red-400"}`} />
                <div>
                  <p className="font-heading font-black text-white text-sm">SIGNAL — {alert.pair}</p>
                  <p className="text-[10px] text-muted-foreground">{alert.tf} · Score {alert.score}/100 · {alert.time.toLocaleTimeString()}</p>
                </div>
              </div>
              <SignalBadge direction={alert.direction} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* No signal notice */}
      {Object.keys(scanResults).length > 0 && !PAIRS.some((p) => (scanResults[p]?.[selectedTf]?.isValid)) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/3 border border-white/5">
          <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <p className="text-[11px] text-muted-foreground">No valid signal — continuing live scan…</p>
        </div>
      )}

      {/* Symbol cards */}
      {PAIRS.map((pair, i) => {
        const data = scanResults[pair]?.[selectedTf];
        const score = data?.total ?? 0;
        const { label, color, border, bg } = getScoreStyle(score);
        const isValid = data?.isValid;

        return (
          <motion.div key={pair} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
            <GlassCard className={`border ${border} ${bg}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isValid ? "bg-green-500/15 border border-green-500/30" : "bg-white/5"}`}>
                    <span className={`font-heading text-xs font-black ${isValid ? "text-green-400" : "text-muted-foreground/50"}`}>{pair.slice(0, 3)}</span>
                  </div>
                  <div>
                    <p className="font-heading font-black text-white text-sm">{pair}</p>
                    <p className={`text-[10px] font-bold ${color}`}>{label}</p>
                    {data && !data.spreadOk && <p className="text-[9px] text-red-400">Spread too high</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {data && isValid && <SignalBadge direction={data.direction} />}
                  <div className="text-right">
                    <p className={`font-heading font-black text-lg leading-none ${isValid ? "text-green-400" : "text-white/30"}`}>{score}</p>
                    <p className="text-[9px] text-muted-foreground">/ 100</p>
                  </div>
                </div>
              </div>

              {data && (
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  <ScoreBar label="TREND" val={data.trend_score}  max={20} color={data.trend_score  > 14 ? "bg-green-500" : data.trend_score  > 7 ? "bg-amber-500" : "bg-red-500/60"} />
                  <ScoreBar label="MOM"   val={data.mom_score}    max={15} color={data.mom_score    > 10 ? "bg-green-500" : data.mom_score    > 5 ? "bg-amber-500" : "bg-red-500/60"} />
                  <ScoreBar label="VOL"   val={data.vol_score}    max={10} color={data.vol_score    > 7  ? "bg-green-500" : data.vol_score    > 3 ? "bg-amber-500" : "bg-red-500/60"} />
                  <ScoreBar label="ATR"   val={data.atr_score}    max={10} color={data.atr_score    > 7  ? "bg-green-500" : data.atr_score    > 3 ? "bg-amber-500" : "bg-red-500/60"} />
                </div>
              )}
              {data && (
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  <ScoreBar label="RSI"    val={data.rsi_score}    max={10} color={data.rsi_score   > 7  ? "bg-green-500" : data.rsi_score    > 3 ? "bg-amber-500" : "bg-red-500/60"} />
                  <ScoreBar label="STRUCT" val={data.struct_score} max={15} color={data.struct_score> 10 ? "bg-green-500" : data.struct_score > 5 ? "bg-amber-500" : "bg-red-500/60"} />
                  <ScoreBar label="S/D"    val={data.sd_score}     max={10} color={data.sd_score    > 7  ? "bg-green-500" : data.sd_score     > 3 ? "bg-amber-500" : "bg-red-500/60"} />
                  <ScoreBar label="LIQ"    val={data.liq_score}    max={10} color={data.liq_score   > 7  ? "bg-green-500" : data.liq_score    > 3 ? "bg-amber-500" : "bg-red-500/60"} />
                </div>
              )}

              {data && (
                <div className="grid grid-cols-4 gap-1 pt-2 border-t border-white/5">
                  {[
                    { label: "Trend",  val: data.trend,       col: data.trend === "Uptrend" ? "text-green-400" : data.trend === "Downtrend" ? "text-red-400" : "text-amber-400" },
                    { label: "Spread", val: data.spread,      col: data.spreadOk ? "text-white" : "text-red-400" },
                    { label: "ATR",    val: data.atrVal,      col: "text-white" },
                    { label: "Market", val: data.marketStatus, col: data.marketStatus === "High Activity" ? "text-green-400" : data.marketStatus === "Active" ? "text-amber-400" : "text-red-400" },
                  ].map(({ label: lbl, val, col }) => (
                    <div key={lbl} className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-muted-foreground/60 uppercase">{lbl}</span>
                      <span className={`text-[10px] font-bold ${col} leading-tight truncate`}>{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        );
      })}
    </div>
  );
}