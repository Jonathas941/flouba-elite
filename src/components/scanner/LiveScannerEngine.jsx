import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import { base44 } from "@/api/base44Client";
import {
  TrendingUp, TrendingDown, Zap, Radio, WifiOff,
  Target, AlertTriangle,
} from "lucide-react";
import {
  PAIRS, TIMEFRAMES, MODE_THRESHOLD,
  computeAnalysis, getBestOpportunity,
  isSessionAllowed, getCurrentSession,
} from "@/lib/marketAnalysis";

function ScoreBar({ label, val, max, ok }) {
  const pct = Math.min(100, (val / max) * 100);
  const color = ok === false ? "bg-red-500/60" : pct > 70 ? "bg-green-500" : pct > 40 ? "bg-amber-500" : "bg-red-500/60";
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
      direction === "BUY"
        ? "bg-green-500/20 text-green-400 border border-green-500/40"
        : "bg-red-500/20 text-red-400 border border-red-500/40"
    }`}>
      {direction === "BUY" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {direction}
    </div>
  );
}

export default function LiveScannerEngine({ onScanUpdate, newsBlocked = false, sessionAllowed = true }) {
  const [connected, setConnected]         = useState(false);
  const [botRunning, setBotRunning]       = useState(false);
  const [tradingMode, setTradingMode]     = useState("Balanced");
  const [dailyTrades, setDailyTrades]     = useState(0);
  const [maxDailyTrades, setMaxDailyTrades] = useState(5);
  const [selectedTf, setSelectedTf]       = useState("M1");
  const [scanResults, setScanResults]     = useState({});
  const [lastScanTime, setLastScanTime]   = useState(null);
  const [signalAlerts, setSignalAlerts]   = useState([]);

  const intervalRef    = useRef(null);
  const settingsIdRef  = useRef(null);
  const prevSignalsRef = useRef({});
  const tickRef        = useRef(0);
  const newsBlockedRef = useRef(newsBlocked);
  const sessionOkRef   = useRef(sessionAllowed);
  newsBlockedRef.current = newsBlocked;
  sessionOkRef.current   = sessionAllowed;

  const loadSettings = useCallback(async () => {
    const list = await base44.entities.BotSettings.list();
    const s = list[0];
    if (s) {
      settingsIdRef.current = s.id;
      setConnected(s.connection_status === "Connected");
      setBotRunning(["Running","Scanning Market","Entering Trade","Managing Position","Signal Found","Sending Order","Trade Opened"].includes(s.robot_status));
      setTradingMode(s.trading_mode || "Balanced");
      setMaxDailyTrades(s.max_daily_trades ?? 5);
    }
  }, []);

  const countDailyTrades = useCallback(async () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const trades = await base44.entities.Trade.filter({ status: "Open" });
    setDailyTrades(trades.filter(t => t.opened_at && new Date(t.opened_at) >= today).length);
  }, []);

  useEffect(() => { loadSettings(); countDailyTrades(); }, [loadSettings, countDailyTrades]);

  useEffect(() => {
    const unsub = base44.entities.BotSettings.subscribe((event) => {
      if (event.data) {
        setConnected(event.data.connection_status === "Connected");
        setBotRunning(["Running","Scanning Market","Entering Trade","Managing Position","Signal Found","Sending Order","Trade Opened"].includes(event.data.robot_status));
        setTradingMode(event.data.trading_mode || "Balanced");
        setMaxDailyTrades(event.data.max_daily_trades ?? 5);
      }
    });
    return unsub;
  }, []);

  // 1-second OnTick scan loop
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!connected || !botRunning) return;

    const runScan = () => {
      tickRef.current += 1;
      const t = tickRef.current;
      const threshold = MODE_THRESHOLD[tradingMode] || 65;
      const session = getCurrentSession();
      const results = {};
      const newAlerts = [];
      const debugEntries = [];
      const dailyLimitHit = dailyTrades >= maxDailyTrades;

      PAIRS.forEach((pair) => {
        results[pair] = {};
        TIMEFRAMES.forEach((tf) => {
          const data = computeAnalysis(pair, tf, t);

          const scoreOk   = data.total >= threshold;
          const sessionOk = sessionOkRef.current;
          const newsOk    = !newsBlockedRef.current;
          const dailyOk   = !dailyLimitHit;

          const allPass = data.rsiOk && data.atrOk && data.spreadOk && scoreOk && sessionOk && newsOk && dailyOk;
          data.isValid = allPass;
          results[pair][tf] = data;

          if (tf === "M1") {
            const checks = [
              { label: `EMA20 ${data.ema20AbovEma50 ? ">" : "<"} EMA50 → ${data.direction}`, ok: true },
              { label: `RSI ${data.rsi.toFixed(1)} — ${data.rsiOk ? "✓ passes" : data.direction === "BUY" ? "✗ need >55" : "✗ need <45"}`, ok: data.rsiOk },
              { label: `ATR ${data.atrVal} — ${data.atrOk ? "✓ volatility ok" : "✗ too low"}`, ok: data.atrOk },
              { label: `Spread ${data.spread} — ${data.spreadOk ? "✓ ok" : "✗ too high"}`, ok: data.spreadOk },
              { label: `Score ${data.total}/100 — ${scoreOk ? `✓ ≥${threshold}` : `✗ need ≥${threshold}`}`, ok: scoreOk },
              { label: newsOk ? "✓ News filter: clear" : "✗ News filter: BLOCKED", ok: newsOk },
              { label: sessionOk ? "✓ Session: allowed" : "✗ Session: outside hours", ok: sessionOk },
              { label: dailyOk ? `✓ Daily trades: ${dailyTrades}/${maxDailyTrades}` : `✗ Max daily trades reached`, ok: dailyOk },
            ];
            debugEntries.push({
              pair, tf,
              score: data.total,
              direction: data.direction,
              decision: allPass ? "PENDING" : "BLOCKED",
              reasons: checks,
              time: new Date().toLocaleTimeString(),
            });
          }

          const key = `${pair}-${tf}`;
          if (allPass && !prevSignalsRef.current[key]) {
            newAlerts.push({ pair, tf, direction: data.direction, score: data.total, time: new Date() });
          }
          prevSignalsRef.current[key] = allPass;
        });
      });

      setScanResults(results);
      setLastScanTime(new Date());

      const best = getBestOpportunity(results, selectedTf);
      const sortedDebug = debugEntries.sort((a, b) => {
        if (a.decision === "PENDING" && b.decision !== "PENDING") return -1;
        if (b.decision === "PENDING" && a.decision !== "PENDING") return 1;
        return b.score - a.score;
      });
      onScanUpdate?.({ results, best, session, tick: t, debugLog: sortedDebug });

      if (newAlerts.length > 0) {
        setSignalAlerts((prev) => [...newAlerts, ...prev].slice(0, 5));
        if (settingsIdRef.current) {
          base44.entities.BotSettings.update(settingsIdRef.current, { robot_status: "Signal Found" });
        }
      }
    };

    intervalRef.current = setInterval(runScan, 1000);
    return () => clearInterval(intervalRef.current);
  }, [connected, botRunning, tradingMode, selectedTf, dailyTrades, maxDailyTrades]);

  const threshold = MODE_THRESHOLD[tradingMode] || 65;

  const getScoreStyle = (score, isValid) => {
    if (isValid && score >= 80) return { label: "STRONG SIGNAL", color: "text-green-400", border: "border-green-500/30", bg: "bg-green-500/8" };
    if (isValid && score >= 65) return { label: "VALID SIGNAL",  color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/8" };
    if (score  >= 55)           return { label: "WEAK SIGNAL",   color: "text-orange-400",border: "border-orange-500/20",bg: "" };
    return                             { label: "NO SIGNAL",     color: "text-white/25",  border: "border-white/5",      bg: "" };
  };

  if (!connected) return (
    <GlassCard className="py-14 flex flex-col items-center gap-4 text-center">
      <WifiOff className="w-10 h-10 text-muted-foreground/30" />
      <p className="font-heading text-sm uppercase tracking-widest text-muted-foreground">Waiting for MT5 Connection</p>
    </GlassCard>
  );

  if (!botRunning) return (
    <GlassCard className="py-10 flex flex-col items-center gap-3 text-center">
      <Radio className="w-8 h-8 text-amber-400/40" />
      <p className="font-heading text-sm uppercase tracking-widest text-amber-400">Robot Paused</p>
      <p className="text-xs text-muted-foreground/60">Press START ROBOT to begin live scanning.</p>
    </GlassCard>
  );

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ scale:[1,1.6,1], opacity:[1,0.3,1] }}
            transition={{ duration:1, repeat:Infinity }} />
          <span className="text-xs text-green-400 font-bold font-heading">SCANNING LIVE — OnTick 1s</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{lastScanTime?.toLocaleTimeString() ?? "--"}</span>
      </div>

      {/* TF selector */}
      <div className="flex gap-1.5 items-center">
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
            initial={{ opacity:0, y:-10, scale:0.97 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, scale:0.96 }}
            transition={{ duration:0.2 }}>
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
      {Object.keys(scanResults).length > 0 && !PAIRS.some((p) => scanResults[p]?.[selectedTf]?.isValid) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/3 border border-white/5">
          <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <p className="text-[11px] text-muted-foreground">No valid signal — continuing live scan…</p>
        </div>
      )}

      {/* Symbol cards */}
      {PAIRS.map((pair, i) => {
        const data = scanResults[pair]?.[selectedTf];
        const score = data?.total ?? 0;
        const { label, color, border, bg } = getScoreStyle(score, data?.isValid);

        return (
          <motion.div key={pair} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.02 }}>
            <GlassCard className={`border ${border} ${bg}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${data?.isValid ? "bg-green-500/15 border border-green-500/30" : "bg-white/5"}`}>
                    <span className={`font-heading text-xs font-black ${data?.isValid ? "text-green-400" : "text-muted-foreground/50"}`}>{pair.slice(0,3)}</span>
                  </div>
                  <div>
                    <p className="font-heading font-black text-white text-sm">{pair}</p>
                    <p className={`text-[10px] font-bold ${color}`}>{label}</p>
                    {data && !data.rsiOk    && <p className="text-[9px] text-amber-400/80">RSI condition failed</p>}
                    {data && !data.atrOk    && <p className="text-[9px] text-orange-400/80">ATR too low</p>}
                    {data && !data.spreadOk && <p className="text-[9px] text-red-400/80">Spread too high</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {data?.isValid && <SignalBadge direction={data.direction} />}
                  <div className="text-right">
                    <p className={`font-heading font-black text-lg leading-none ${data?.isValid ? "text-green-400" : "text-white/30"}`}>{score}</p>
                    <p className="text-[9px] text-muted-foreground">/ 100</p>
                  </div>
                </div>
              </div>

              {data && (
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  <ScoreBar label="TREND"  val={data.trend_score}  max={20} />
                  <ScoreBar label="MOM"    val={data.mom_score}    max={15} />
                  <ScoreBar label="RSI"    val={data.rsi_score}    max={10} ok={data.rsiOk} />
                  <ScoreBar label="ATR"    val={data.atr_score}    max={10} ok={data.atrOk} />
                </div>
              )}

              {data && (
                <div className="grid grid-cols-4 gap-1 pt-2 border-t border-white/5">
                  {[
                    { label:"Trend",  val: data.trend,             col: data.trend==="Uptrend" ? "text-green-400" : "text-red-400" },
                    { label:"RSI",    val: data.rsi?.toFixed(1),   col: data.rsiOk ? "text-white" : "text-amber-400" },
                    { label:"ATR",    val: data.atrVal,            col: data.atrOk ? "text-white" : "text-orange-400" },
                    { label:"Spread", val: data.spread,            col: data.spreadOk ? "text-white" : "text-red-400" },
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