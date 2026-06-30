import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import { mt5Api } from "@/lib/mt5Api";
import {
  TrendingUp, TrendingDown, Zap, Radio, WifiOff,
  Target, AlertTriangle, Brain, CheckCircle, XCircle,
} from "lucide-react";

const STRATEGY_LABELS = {
  momentum_scalping: "Momentum Scalping",
  range_breakout:    "Range Breakout",
  volatility_spike:  "Volatility Spike",
  hybrid_manual:     "Hybrid Manual",
  hft_scalper:       "HFT Scalper",
  auto:              "Auto",
};

const STRATEGY_COLORS = {
  "Momentum Scalping": "text-green-400",
  "Range Breakout":    "text-sky-400",
  "Volatility Spike":  "text-amber-400",
  "Hybrid Manual":     "text-purple-400",
  "HFT Scalper":       "text-pink-400",
  "Auto":              "text-white/50",
};

function strategyLabel(raw) {
  if (!raw) return "Auto";
  return STRATEGY_LABELS[raw] || raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function SignalBadge({ direction }) {
  if (direction !== "BUY" && direction !== "SELL") {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-lg font-heading font-black text-xs bg-white/5 text-white/30 border border-white/10">
        HOLD
      </div>
    );
  }
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

export default function LiveScannerEngine({ onScanUpdate }) {
  const [scanner, setScanner]   = useState(null);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [signalAlerts, setSignalAlerts] = useState([]);

  const pollRef        = useRef(null);
  const prevSignalRef  = useRef(null);

  const poll = useCallback(async () => {
    try {
      const res = await mt5Api.scannerStatus();
      if (res?.ok && res?.data?.scanner) {
        const s = res.data.scanner;
        setScanner(s);
        setError(null);

        const ind = s.indicators || {};
        const conditions = (s.conditions || []).map((label) => ({ label, ok: !label.includes("✗") }));
        const strategy = strategyLabel(s.strategy);

        if (s.last_signal && s.last_signal !== "HOLD" && prevSignalRef.current !== `${s.symbol}-${s.last_signal}-${s.last_scan_time}`) {
          prevSignalRef.current = `${s.symbol}-${s.last_signal}-${s.last_scan_time}`;
          setSignalAlerts((prev) => [
            { pair: s.symbol, direction: s.last_signal, score: s.signal_score, strategy, time: new Date() },
            ...prev,
          ].slice(0, 5));
        }

        onScanUpdate?.({
          scanner: s,
          debugLog: [{
            pair: s.symbol,
            tf: ind.timeframe || "M1",
            score: s.signal_score ?? 0,
            direction: s.last_signal && s.last_signal !== "HOLD" ? s.last_signal : (ind.ema_20 > ind.ema_50 ? "BUY" : "SELL"),
            strategy,
            decision: s.last_signal === "BUY" || s.last_signal === "SELL" ? "ENTERED" : (s.signal_score > 0 ? "PENDING" : "BLOCKED"),
            reasons: conditions,
            time: s.last_scan_time ? new Date(s.last_scan_time).toLocaleTimeString() : new Date().toLocaleTimeString(),
          }],
        });
      } else {
        setError(res?.error || res?.data?.message || "Scanner unavailable");
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [onScanUpdate]);

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => clearInterval(pollRef.current);
  }, [poll]);

  if (loading) return (
    <GlassCard className="py-14 flex flex-col items-center gap-4 text-center">
      <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      <p className="font-heading text-sm uppercase tracking-widest text-muted-foreground">Loading scanner…</p>
    </GlassCard>
  );

  if (error) return (
    <GlassCard className="py-14 flex flex-col items-center gap-4 text-center">
      <WifiOff className="w-10 h-10 text-muted-foreground/30" />
      <p className="font-heading text-sm uppercase tracking-widest text-muted-foreground">Waiting for MT5 Connection</p>
      <p className="text-[10px] text-white/25">{error}</p>
    </GlassCard>
  );

  if (!scanner?.robot_running) return (
    <GlassCard className="py-10 flex flex-col items-center gap-3 text-center">
      <Radio className="w-8 h-8 text-amber-400/40" />
      <p className="font-heading text-sm uppercase tracking-widest text-amber-400">Robot Paused</p>
      <p className="text-xs text-muted-foreground/60">Press START ROBOT to begin live scanning.</p>
    </GlassCard>
  );

  const ind        = scanner.indicators || {};
  const risk       = scanner.risk || {};
  const strategy   = strategyLabel(scanner.strategy);
  const stratColor = STRATEGY_COLORS[strategy] || "text-white/40";
  const score      = scanner.signal_score ?? 0;
  const direction  = scanner.last_signal && scanner.last_signal !== "HOLD"
    ? scanner.last_signal
    : (ind.ema_20 > ind.ema_50 ? "BUY" : "SELL");
  const isLive     = scanner.last_signal === "BUY" || scanner.last_signal === "SELL";
  const conditions = (scanner.conditions || []).map((label) => ({ label, ok: !label.includes("✗") }));

  return (
    <div className="space-y-3">

      {/* Status bar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ scale:[1,1.6,1], opacity:[1,0.3,1] }}
            transition={{ duration:1, repeat:Infinity }} />
          <span className="text-xs text-green-400 font-bold font-heading">LIVE SCANNING — Real MT5 Data</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {scanner.last_scan_time ? new Date(scanner.last_scan_time).toLocaleTimeString() : "--"}
        </span>
      </div>

      {/* Signal alerts */}
      <AnimatePresence>
        {signalAlerts.map((alert) => (
          <motion.div key={`${alert.pair}-${alert.direction}-${alert.time.getTime()}`}
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
                  <p className="text-[10px] text-muted-foreground">{alert.strategy} · Score {alert.score}/100</p>
                </div>
              </div>
              <SignalBadge direction={alert.direction} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Active symbol card */}
      <GlassCard className={`border ${isLive ? "border-green-500/30 bg-green-500/8" : "border-white/5"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLive ? "bg-green-500/15 border border-green-500/30" : "bg-white/5"}`}>
              <span className={`font-heading text-xs font-black ${isLive ? "text-green-400" : "text-muted-foreground/50"}`}>{scanner.symbol?.slice(0,3)}</span>
            </div>
            <div>
              <p className="font-heading font-black text-white text-sm">{scanner.symbol}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Brain className={`w-2.5 h-2.5 ${stratColor}`} />
                <p className={`text-[9px] font-heading font-bold ${stratColor}`}>{strategy}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SignalBadge direction={scanner.last_signal} />
            <div className="text-right">
              <p className={`font-heading font-black text-lg leading-none ${isLive ? "text-green-400" : "text-white/30"}`}>{score}</p>
              <p className="text-[9px] text-muted-foreground">/ 100</p>
            </div>
          </div>
        </div>

        {/* Real indicators grid */}
        <div className="grid grid-cols-4 gap-1 pt-2 border-t border-white/5">
          {[
            { label: "ADX",    val: ind.adx_14?.toFixed(1) },
            { label: "RSI",    val: ind.rsi_14?.toFixed(1) },
            { label: "ATR",    val: ind.atr_14?.toFixed(3) },
            { label: "Spread", val: ind.spread_pips != null ? `${ind.spread_pips}p` : "--" },
          ].map(({ label, val }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[9px] text-muted-foreground/60 uppercase">{label}</span>
              <span className="text-[10px] font-bold text-white leading-tight truncate">{val ?? "--"}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1 pt-2">
          {[
            { label: "Bid",   val: ind.bid },
            { label: "Ask",   val: ind.ask },
            { label: "EMA20", val: ind.ema_20?.toFixed(2) },
            { label: "EMA50", val: ind.ema_50?.toFixed(2) },
          ].map(({ label, val }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[9px] text-muted-foreground/60 uppercase">{label}</span>
              <span className="text-[10px] font-bold text-white/70 leading-tight truncate">{val ?? "--"}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Reason / conditions */}
      {scanner.reason && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/3 border border-white/5">
          <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <p className="text-[11px] text-muted-foreground">{scanner.reason}</p>
        </div>
      )}

      {conditions.length > 0 && (
        <GlassCard>
          <p className="text-[9px] uppercase tracking-widest text-white/25 font-heading mb-2">Live Conditions</p>
          <div className="space-y-1">
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {c.ok ? <CheckCircle className="w-3 h-3 text-green-400 shrink-0" /> : <XCircle className="w-3 h-3 text-red-400/70 shrink-0" />}
                <span className={`text-[10px] font-heading ${c.ok ? "text-white/60" : "text-red-300/80"}`}>{c.label}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Risk panel */}
      <div className="grid grid-cols-3 divide-x divide-white/5 rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {[
          { label: "DAILY TRADES",  value: `${risk.daily_trades ?? 0}` },
          { label: "DAILY P&L",     value: risk.daily_pnl != null ? `$${risk.daily_pnl.toFixed(2)}` : "--" },
          { label: "OPEN TRADES",   value: `${risk.open_trades ?? scanner.open_positions_count ?? 0}` },
        ].map(({ label, value }) => (
          <div key={label} className="px-3 py-2.5 flex flex-col gap-0.5">
            <span className="text-[8px] uppercase tracking-widest text-white/25 font-heading">{label}</span>
            <span className="font-heading font-bold text-xs text-white">{value}</span>
          </div>
        ))}
      </div>

      {!risk.trading_allowed && risk.block_reason && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
          <Target className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-[11px] font-heading font-bold text-red-400">{risk.block_reason}</p>
        </div>
      )}
    </div>
  );
}