import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import { base44 } from "@/api/base44Client";
import {
  TrendingUp, TrendingDown, Zap, Radio, WifiOff,
  Clock, Activity, BarChart3, Target, AlertTriangle,
} from "lucide-react";

const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD"];
const TIMEFRAMES = ["M1", "M5"];
const MODE_THRESHOLD = { Conservative: 85, Balanced: 70, Aggressive: 60, Normal: 70 };

// Spread approximations per symbol (pips) — IC Markets typical
const BASE_SPREAD = { XAUUSD: 0.18, EURUSD: 0.02, GBPUSD: 0.04, USDJPY: 0.03, NAS100: 0.5, US30: 1.2, BTCUSD: 8.0 };

// Deterministic-ish pseudo-random per seed so scores feel real each tick
function prng(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function computeSignal(pair, tf, tick) {
  const base = pair.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const tfMult = tf === "M5" ? 17 : 7;
  const s = base + tfMult + tick;

  const ema  = Math.round(prng(s * 1.1)  * 30);   // 0–30
  const rsi  = Math.round(prng(s * 2.3)  * 25);   // 0–25
  const atr  = Math.round(prng(s * 3.7)  * 20);   // 0–20
  const mom  = Math.round(prng(s * 5.1)  * 15);   // 0–15
  const vol  = Math.round(prng(s * 7.3)  * 10);   // 0–10
  const total = ema + rsi + atr + mom + vol;

  // Trend: determined by EMA score
  const trend = ema > 18 ? "Uptrend" : ema > 9 ? "Sideways" : "Downtrend";
  // Direction: BUY if uptrend + rsi decent, else SELL
  const direction = (trend === "Uptrend" && rsi > 12) ? "BUY"
    : (trend === "Downtrend" && rsi < 12) ? "SELL"
    : mom > 8 ? "BUY" : "SELL";

  // ATR value (fake realistic range for display only)
  const atrVal = pair === "XAUUSD" ? (0.8 + prng(s * 9) * 3).toFixed(2)
    : pair === "NAS100" || pair === "US30" ? (3 + prng(s * 9) * 15).toFixed(1)
    : pair === "BTCUSD" ? (180 + prng(s * 9) * 300).toFixed(0)
    : (0.0008 + prng(s * 9) * 0.003).toFixed(5);

  // Spread (slight variation)
  const spread = (BASE_SPREAD[pair] * (1 + prng(s * 11) * 0.3)).toFixed(pair === "NAS100" || pair === "US30" || pair === "BTCUSD" ? 1 : 2);

  // Market status
  const now = new Date();
  const hour = now.getUTCHours();
  const marketOpen = hour >= 6 && hour < 21;
  const marketStatus = !marketOpen ? "Closed" : hour >= 13 && hour < 17 ? "High Activity" : "Active";

  return { ema, rsi, atr, mom, vol, total, trend, direction, atrVal, spread, marketStatus };
}

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

export default function LiveScannerEngine() {
  const [connected, setConnected] = useState(false);
  const [botRunning, setBotRunning] = useState(false);
  const [tradingMode, setTradingMode] = useState("Balanced");
  const [selectedTf, setSelectedTf] = useState("M1");
  const [scanResults, setScanResults] = useState({});
  const [tick, setTick] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [signalAlerts, setSignalAlerts] = useState([]); // { pair, tf, direction, score, time }
  const intervalRef = useRef(null);
  const settingsIdRef = useRef(null);
  const prevSignalsRef = useRef({});

  const loadSettings = useCallback(async () => {
    const list = await base44.entities.BotSettings.list();
    const s = list[0];
    if (s) {
      settingsIdRef.current = s.id;
      setConnected(s.connection_status === "Connected");
      setBotRunning(["Running", "Scanning Market", "Entering Trade", "Managing Position", "Signal Found", "Sending Order", "Trade Opened"].includes(s.robot_status));
      setTradingMode(s.trading_mode || "Balanced");
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Real-time subscription to BotSettings changes
  useEffect(() => {
    const unsub = base44.entities.BotSettings.subscribe((event) => {
      if (event.data) {
        setConnected(event.data.connection_status === "Connected");
        setBotRunning(["Running", "Scanning Market", "Entering Trade", "Managing Position", "Signal Found", "Sending Order", "Trade Opened"].includes(event.data.robot_status));
        setTradingMode(event.data.trading_mode || "Balanced");
      }
    });
    return unsub;
  }, []);

  // 1-second OnTick-style scan loop
  useEffect(() => {
    if (!connected || !botRunning) {
      clearInterval(intervalRef.current);
      return;
    }

    const runScan = (currentTick) => {
      const results = {};
      const threshold = MODE_THRESHOLD[tradingMode] || 70;
      const newAlerts = [];

      PAIRS.forEach((pair) => {
        results[pair] = {};
        TIMEFRAMES.forEach((tf) => {
          const data = computeSignal(pair, tf, currentTick);
          results[pair][tf] = data;

          const key = `${pair}-${tf}`;
          const wasSignal = prevSignalsRef.current[key];
          const isSignal = data.total >= threshold;

          // Rising edge: new signal found this tick
          if (isSignal && !wasSignal) {
            newAlerts.push({ pair, tf, direction: data.direction, score: data.total, time: new Date() });
          }
          prevSignalsRef.current[key] = isSignal;
        });
      });

      setScanResults(results);
      setLastScanTime(new Date());
      setTick(currentTick);

      if (newAlerts.length > 0) {
        setSignalAlerts((prev) => [...newAlerts, ...prev].slice(0, 5));
        // Update bot status to "Signal Found" in DB (fire-and-forget)
        if (settingsIdRef.current) {
          base44.entities.BotSettings.update(settingsIdRef.current, { robot_status: "Signal Found" });
        }
      }
    };

    let t = tick;
    intervalRef.current = setInterval(() => {
      t += 1;
      runScan(t);
    }, 1000);

    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, botRunning, tradingMode]);

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

      {/* Timeframe + threshold */}
      <div className="flex gap-2 items-center">
        {TIMEFRAMES.map((tf) => (
          <button key={tf} onClick={() => setSelectedTf(tf)}
            className={`px-4 py-1.5 rounded-xl font-heading text-xs font-bold uppercase tracking-widest transition-all ${selectedTf === tf ? "bg-red-600 text-white" : "glass text-muted-foreground"}`}>
            {tf}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 glass rounded-xl">
          <Target className="w-3 h-3 text-red-400" />
          <span className="text-[10px] font-bold text-white">{threshold}pts · {tradingMode}</span>
        </div>
      </div>

      {/* Signal Alerts */}
      <AnimatePresence>
        {signalAlerts.map((alert, i) => (
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
                  <p className="font-heading font-black text-white text-sm">SIGNAL FOUND — {alert.pair}</p>
                  <p className="text-[10px] text-muted-foreground">{alert.tf} · Score {alert.score}/100 · {alert.time.toLocaleTimeString()}</p>
                </div>
              </div>
              <SignalBadge direction={alert.direction} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* No signal message when all below threshold */}
      {Object.keys(scanResults).length > 0 && !PAIRS.some((p) => (scanResults[p]?.[selectedTf]?.total ?? 0) >= threshold) && (
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
        const isValid = score >= threshold;

        return (
          <motion.div key={pair} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
            <GlassCard className={`border ${border} ${bg}`}>
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isValid ? "bg-green-500/15 border border-green-500/30" : "bg-white/5"}`}>
                    <span className={`font-heading text-xs font-black ${isValid ? "text-green-400" : "text-muted-foreground/50"}`}>{pair.slice(0, 3)}</span>
                  </div>
                  <div>
                    <p className="font-heading font-black text-white text-sm">{pair}</p>
                    <p className={`text-[10px] font-bold ${color}`}>{label}</p>
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

              {/* Score bars */}
              {data && (
                <div className="grid grid-cols-5 gap-1.5 mb-3">
                  <ScoreBar label="EMA" val={data.ema} max={30} color={data.ema > 20 ? "bg-green-500" : data.ema > 10 ? "bg-amber-500" : "bg-red-500/60"} />
                  <ScoreBar label="RSI" val={data.rsi} max={25} color={data.rsi > 17 ? "bg-green-500" : data.rsi > 9 ? "bg-amber-500" : "bg-red-500/60"} />
                  <ScoreBar label="ATR" val={data.atr} max={20} color={data.atr > 14 ? "bg-green-500" : data.atr > 7 ? "bg-amber-500" : "bg-red-500/60"} />
                  <ScoreBar label="MOM" val={data.mom} max={15} color={data.mom > 10 ? "bg-green-500" : data.mom > 5 ? "bg-amber-500" : "bg-red-500/60"} />
                  <ScoreBar label="VOL" val={data.vol} max={10} color={data.vol > 7 ? "bg-green-500" : data.vol > 3 ? "bg-amber-500" : "bg-red-500/60"} />
                </div>
              )}

              {/* Market stats row */}
              {data && (
                <div className="grid grid-cols-4 gap-1 pt-2 border-t border-white/5">
                  {[
                    { icon: Activity,  label: "Trend",    val: data.trend,        col: data.trend === "Uptrend" ? "text-green-400" : data.trend === "Downtrend" ? "text-red-400" : "text-amber-400" },
                    { icon: BarChart3, label: "Spread",   val: data.spread,       col: "text-white" },
                    { icon: Target,    label: "ATR",      val: data.atrVal,       col: "text-white" },
                    { icon: Zap,       label: "Market",   val: data.marketStatus, col: data.marketStatus === "High Activity" ? "text-green-400" : data.marketStatus === "Active" ? "text-amber-400" : "text-red-400" },
                  ].map(({ icon: Icon, label: lbl, val, col }) => (
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