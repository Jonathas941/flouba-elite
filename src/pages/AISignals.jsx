import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/GlassCard";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { logNotification } from "@/lib/notifications";
import {
  Zap, TrendingUp, TrendingDown, Clock, Target, Loader2,
  CheckCircle2, Send, RefreshCw, Shield, Activity, Brain, AlertCircle,
} from "lucide-react";

export default function AISignals() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [signal, setSignal] = useState(null);
  const [autoExecEnabled, setAutoExecEnabled] = useState(false);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Fetch the live AI signal from the Trade Decision Engine + Strategy Selector
  const fetchSignal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [decRes, stratRes, acctRes] = await Promise.all([
        base44.functions.invoke("tradeDecisionEngine", {}),
        base44.functions.invoke("aiStrategySelector", {}),
        base44.functions.invoke("mt5Bridge", { action: "account" }),
      ]);

      if (!mountedRef.current) return;

      const dec = decRes?.data || {};
      const strat = stratRes?.data || {};
      const acct = acctRes?.data || {};

      setConnected(acct?.ok && acct?.data?.account?.connected === true);
      setAutoExecEnabled(dec?.account ? false : false); // loaded from BotSettings separately

      setSignal({
        decision: dec.decision,
        reason: dec.reason,
        score: dec.score,
        minScore: dec.min_score,
        regime: dec.regime,
        regimeDir: dec.regime_dir,
        direction: dec.direction,
        pillars: dec.pillars || [],
        trade: dec.trade || null,
        account: dec.account || null,
        robotRunning: dec.robot_running,
        bestStrategy: strat.strategy || dec.regime || "Analyzing…",
        strategyReason: strat.reason,
        strategyConfidence: strat.confidence,
        marketSnapshot: strat.marketSnapshot,
        connected: dec.connected !== false,
        dangerMode: dec.danger_mode,
      });
    } catch (e) {
      if (mountedRef.current) setError(e.message || "Failed to fetch AI signal");
    }
    if (mountedRef.current) setLoading(false);
  }, []);

  useEffect(() => { fetchSignal(); }, [fetchSignal]);

  // Load auto-execute setting from BotSettings
  useEffect(() => {
    base44.entities.BotSettings.list().then((records) => {
      if (records?.[0]) setAutoExecEnabled(records[0].ai_auto_execute_enabled === true);
    }).catch(() => {});
  }, []);

  // Execute the AI signal trade
  const executeTrade = useCallback(async () => {
    if (!connected) { navigate("/connect-mt5"); return; }
    setExecuting(true);
    try {
      const res = await base44.functions.invoke("executeAiTrade", { force_execute: true });
      const data = res?.data || {};
      if (data?.executed) {
        setExecuted(true);
        const t = data.trade;
        toast({
          title: "AI Signal Trade Placed",
          description: `${t.direction} ${t.symbol} · ${t.lot_size} lot | SL ${t.stop_loss?.toFixed(2)} · TP ${t.take_profit?.toFixed(2)}`,
          duration: 5000,
        });
        logNotification({
          type: "trade",
          title: "AI Signal Trade Executed",
          message: `${t.direction} ${t.symbol} — Lot ${t.lot_size}, SL ${t.stop_loss?.toFixed(2)}, TP ${t.take_profit?.toFixed(2)} (Score ${data.score}/${data.minScore}, Strategy: ${data.bestStrategy})`,
          category: "success",
          meta: { pair: t.symbol, direction: t.direction, lot: t.lot_size, strategy: data.bestStrategy, score: data.score },
        });
      } else {
        toast({
          title: "No Trade Executed",
          description: data?.reason || data?.error || "AI signal did not produce a trade.",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (e) {
      toast({ title: "Execution Failed", description: e.message, variant: "destructive", duration: 4000 });
    }
    if (mountedRef.current) setExecuting(false);
  }, [connected, navigate, toast]);

  const isTrade = signal?.decision === "TRADE" || signal?.decision === "RECOVERY_TRADE";
  const buy = signal?.direction === "BUY";
  const trade = signal?.trade;

  return (
    <div className="px-4 pt-8 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-black text-white neon-text flex items-center gap-2">
            <Zap className="w-5 h-5 text-red-500" /> AI Signals
          </h1>
          <p className="text-sm text-muted-foreground">Live AI trade signals across all 15 strategies.</p>
        </div>
        <button
          onClick={fetchSignal}
          disabled={loading}
          className="w-9 h-9 rounded-xl glass flex items-center justify-center active:scale-95 transition-all"
        >
          <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      {/* Connection status */}
      <div className="flex items-center justify-between gap-3">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-heading tracking-widest ${connected ? "text-[#00FF41]" : "text-[#FF3131]"}`}
          style={{ background: connected ? "rgba(0,255,65,0.08)" : "rgba(255,49,49,0.08)", border: `1px solid ${connected ? "rgba(0,255,65,0.3)" : "rgba(255,49,49,0.3)"}` }}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00FF41]" : "bg-[#FF3131]"} ${connected ? "animate-pulse" : ""}`} />
          {connected ? "MT5 LIVE" : "OFFLINE"}
        </div>
        {autoExecEnabled && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-heading tracking-widest text-amber-400"
            style={{ background: "rgba(255,204,66,0.08)", border: "1px solid rgba(255,204,66,0.3)" }}>
            <Activity className="w-3 h-3" /> AUTO-EXEC ON
          </div>
        )}
        {signal?.dangerMode && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-heading tracking-widest text-red-400 neon-red"
            style={{ background: "rgba(255,49,49,0.12)", border: "1px solid rgba(255,49,49,0.4)" }}>
            <AlertCircle className="w-3 h-3" /> DANGER MODE
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && !signal && (
        <GlassCard>
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-[#00FF41] animate-spin" />
            <p className="text-sm text-white/40 font-heading tracking-wide">Analyzing market across all strategies…</p>
          </div>
        </GlassCard>
      )}

      {/* Error state */}
      {error && (
        <GlassCard>
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={fetchSignal} className="text-xs text-white/60 underline">Retry</button>
          </div>
        </GlassCard>
      )}

      {/* Main signal card */}
      {signal && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard>
            {/* Decision header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isTrade ? (buy ? "bg-green-500/15" : "bg-red-500/15") : "bg-white/5"}`}>
                  {isTrade ? (
                    buy ? <TrendingUp className="w-6 h-6 text-green-400" /> : <TrendingDown className="w-6 h-6 text-red-400" />
                  ) : (
                    <Shield className="w-6 h-6 text-white/40" />
                  )}
                </div>
                <div>
                  <p className="font-heading font-black text-white text-lg">
                    {isTrade ? `${signal.direction} ${signal.bestStrategy?.split(" ")[0] || ""}` : "NO TRADE"}
                  </p>
                  <p className={`text-xs font-semibold ${isTrade ? (buy ? "text-green-400" : "text-red-400") : "text-white/40"}`}>
                    {signal.decision === "RECOVERY_TRADE" ? "Recovery Signal" : isTrade ? "AI Signal Ready" : "Waiting for confluence"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <Target className="w-3 h-3 text-[#00FF41]" />
                  <span className="font-heading font-black text-lg neon-text-green">{signal.score}</span>
                  <span className="text-xs text-white/30">/{signal.minScore}</span>
                </div>
                <p className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Confluence Score</p>
              </div>
            </div>

            {/* Strategy badge */}
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl" style={{ background: "rgba(0,255,65,0.05)", border: "1px solid rgba(0,255,65,0.15)" }}>
              <Brain className="w-3.5 h-3.5 text-[#00FF41] shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">AI Best Strategy</p>
                <p className="text-xs text-white/80 font-semibold truncate">{signal.bestStrategy}</p>
              </div>
              {signal.strategyConfidence != null && (
                <span className="ml-auto text-[10px] font-heading font-bold text-[#00FF41] shrink-0">{signal.strategyConfidence}%</span>
              )}
            </div>

            {signal.strategyReason && (
              <p className="text-[10px] text-white/40 leading-relaxed mb-3">{signal.strategyReason}</p>
            )}

            {/* Reason */}
            <div className="mb-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5">
              <p className="text-[11px] text-white/60 leading-relaxed">{signal.reason}</p>
            </div>

            {/* Trade params */}
            {trade && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="px-3 py-2 rounded-lg bg-white/3">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider">Entry</p>
                  <p className="text-sm font-bold text-white">{trade.entry?.toFixed?.(5) ?? "--"}</p>
                </div>
                <div className="px-3 py-2 rounded-lg bg-white/3">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider">Lot Size</p>
                  <p className="text-sm font-bold text-white">{trade.lot_size ?? "--"}</p>
                </div>
                <div className="px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/15">
                  <p className="text-[9px] text-red-400/50 uppercase tracking-wider">Stop Loss</p>
                  <p className="text-sm font-bold text-red-400">{trade.stop_loss?.toFixed?.(5) ?? "--"}</p>
                </div>
                <div className="px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/15">
                  <p className="text-[9px] text-green-400/50 uppercase tracking-wider">Take Profit</p>
                  <p className="text-sm font-bold text-green-400">{trade.take_profit?.toFixed?.(5) ?? "--"}</p>
                </div>
              </div>
            )}

            {/* Pillars breakdown */}
            {signal.pillars?.length > 0 && (
              <div className="space-y-1.5 mb-4">
                <p className="text-[9px] text-white/30 uppercase tracking-widest font-heading">8-Pillar Analysis</p>
                {signal.pillars.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs">{p.icon}</span>
                    <span className="text-[10px] text-white/50 flex-1 truncate">{p.label}</span>
                    <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p.pass ? "bg-[#00FF41]" : "bg-red-500/60"}`}
                        style={{ width: `${Math.min(100, p.score || 0)}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-heading font-bold w-6 text-right ${p.pass ? "text-[#00FF41]" : "text-red-400"}`}>
                      {p.score || 0}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Execute button */}
            <button
              onClick={executeTrade}
              disabled={executing || executed || !connected}
              className="w-full h-12 rounded-xl font-heading font-black tracking-widest text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              style={executed
                ? { background: "rgba(0,255,65,0.12)", border: "1px solid rgba(0,255,65,0.4)", color: "#00FF41" }
                : { background: "linear-gradient(90deg, #00FF41, #00CC33)", color: "#050505", boxShadow: "0 0 16px rgba(0,255,65,0.35)" }}
            >
              {executing ? <><Loader2 className="w-4 h-4 animate-spin" /> EXECUTING AI SIGNAL…</>
                : executed ? <><CheckCircle2 className="w-4 h-4" /> TRADE EXECUTED</>
                : <><Send className="w-4 h-4" /> EXECUTE AI SIGNAL</>}
            </button>

            {!isTrade && (
              <p className="text-[9px] text-white/25 text-center mt-2">
                AI determined no high-quality signal right now. Press execute to force a trade if conditions are close.
              </p>
            )}
          </GlassCard>
        </motion.div>
      )}

      {/* Account snapshot */}
      {signal?.account && (
        <GlassCard>
          <p className="text-[9px] text-white/30 uppercase tracking-widest font-heading mb-3">Account Snapshot</p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Balance" value={signal.account.balance} />
            <Stat label="Equity" value={signal.account.equity} />
            <Stat label="Floating P/L" value={signal.account.floating_pnl} color={signal.account.floating_pnl >= 0 ? "green" : "red"} />
            <Stat label="Daily P/L" value={signal.account.daily_pnl} color={signal.account.daily_pnl >= 0 ? "green" : "red"} />
            <Stat label="Open Positions" value={`${signal.account.open_positions}/${signal.account.max_concurrent}`} />
            <Stat label="Trades Today" value={signal.account.trades_today} />
          </div>
        </GlassCard>
      )}

      {/* Regime + Safety */}
      {signal && (
        <div className="grid grid-cols-2 gap-3">
          <GlassCard>
            <p className="text-[9px] text-white/30 uppercase tracking-widest font-heading mb-2">Market Regime</p>
            <p className="text-sm font-bold text-white">{signal.regime || "--"}</p>
            {signal.regimeDir && <p className="text-[10px] text-white/40">{signal.regimeDir}</p>}
          </GlassCard>
          <GlassCard>
            <p className="text-[9px] text-white/30 uppercase tracking-widest font-heading mb-2">Robot Status</p>
            <p className={`text-sm font-bold ${signal.robotRunning ? "text-[#00FF41]" : "text-white/40"}`}>
              {signal.robotRunning ? "Running" : "Paused"}
            </p>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  const colorClass = color === "green" ? "text-[#00FF41]" : color === "red" ? "text-[#FF3131]" : "text-white";
  return (
    <div>
      <p className="text-[9px] text-white/30 uppercase tracking-wider">{label}</p>
      <p className={`text-xs font-bold ${colorClass}`}>
        {value != null ? (typeof value === "number" ? `$${value.toFixed(2)}` : value) : "--"}
      </p>
    </div>
  );
}