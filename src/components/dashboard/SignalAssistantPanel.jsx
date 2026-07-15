import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { logNotification } from "@/lib/notifications";
import {
  Radar, TrendingUp, TrendingDown, Clock, Target, Shield,
  Loader2, CheckCircle2, XCircle, Send, Zap, RefreshCw, AlertCircle,
  Activity, ArrowUpCircle, ArrowDownCircle, FileClock, Ban,
} from "lucide-react";

const STATUS_META = {
  WAITING_FOR_ENTRY: { label: "WAITING FOR ENTRY", color: "#FFCC42", bg: "rgba(255,204,66,0.08)" },
  CONFIRMED: { label: "CONFIRMED", color: "#00B4FF", bg: "rgba(0,180,255,0.08)" },
  EXECUTED: { label: "EXECUTED", color: "#00FF41", bg: "rgba(0,255,65,0.08)" },
  EXPIRED: { label: "EXPIRED", color: "#FF3131", bg: "rgba(255,49,49,0.06)" },
  CANCELLED: { label: "CANCELLED", color: "#888", bg: "rgba(255,255,255,0.04)" },
};

const MODE_META = {
  signal_only: { label: "SIGNAL ONLY", desc: "Display only — no auto-trade" },
  semi_auto: { label: "SEMI-AUTO", desc: "User confirms each trade" },
  full_auto: { label: "FULL AUTO", desc: "Auto-execute at entry trigger" },
};

function fmtPrice(v) {
  if (v == null) return "--";
  return Number(v).toFixed(v > 100 ? 2 : 5);
}

function timeLeft(expiration) {
  if (!expiration) return 0;
  const ms = new Date(expiration).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

export default function SignalAssistantPanel({ connected }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [signals, setSignals] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [acting, setActing] = useState(null);
  const [now, setNow] = useState(Date.now());
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Tick for countdown
  useEffect(() => {
    const t = setInterval(() => mountedRef.current && setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load settings + signals
  const loadData = useCallback(async () => {
    try {
      const [saRes, sigRes] = await Promise.all([
        base44.entities.SignalAssistantSettings.list('-created_date', 1).catch(() => []),
        base44.entities.FloubaSignal.filter({ status: { $in: ["WAITING_FOR_ENTRY", "CONFIRMED", "EXECUTED", "EXPIRED", "CANCELLED"] } }, '-created_date', 5).catch(() => []),
      ]);
      if (!mountedRef.current) return;
      setSettings(saRes?.[0] || null);
      setSignals(sigRes || []);
    } catch {}
  }, []);

  useEffect(() => { loadData(); const t = setInterval(loadData, 10000); return () => clearInterval(t); }, [loadData]);

  // Subscribe to signal changes
  useEffect(() => {
    const unsub = base44.entities.FloubaSignal.subscribe(() => loadData());
    return unsub;
  }, [loadData]);

  const scanMarket = useCallback(async () => {
    if (!connected) { navigate("/connect-mt5"); return; }
    setScanning(true);
    try {
      const res = await base44.functions.invoke("floubaSignalScanner", {});
      const d = res?.data;
      if (d?.signal_created) {
        toast({ title: "Signal Detected", description: `${d.signal.direction} ${d.signal.symbol} — Score ${d.score}/${d.minScore}`, duration: 5000 });
        logNotification({ type: "trade", title: "AI Signal Generated", message: `${d.signal.direction} ${d.signal.symbol} — Entry ${fmtPrice(d.signal.entry_price)}, SL ${fmtPrice(d.signal.stop_loss)}, TP ${fmtPrice(d.signal.take_profit)}, Confidence ${d.signal.confidence_score}%`, category: "info", meta: { signal_id: d.signal.id } });
      } else {
        toast({ title: "No Signal", description: d?.reason || "No high-quality signal found right now.", duration: 4000 });
      }
      loadData();
    } catch (e) {
      toast({ title: "Scan Failed", description: e.message, variant: "destructive", duration: 4000 });
    }
    if (mountedRef.current) setScanning(false);
  }, [connected, navigate, toast, loadData]);

  const executeAction = useCallback(async (signalId, action, label) => {
    setActing(action);
    try {
      const res = await base44.functions.invoke("floubaSignalExecute", { signal_id: signalId, action });
      const d = res?.data;
      if (d?.ok) {
        toast({ title: label, description: action === "cancel" ? "Signal cancelled." : `Trade placed — Ticket ${d.ticket || "pending"}`, duration: 4000 });
        logNotification({ type: "trade", title: label, message: action === "cancel" ? "Signal cancelled by user." : `Signal executed — ${d.ticket ? `Ticket ${d.ticket}` : "pending"}`, category: action === "cancel" ? "info" : "success", meta: { signal_id: signalId } });
      } else {
        toast({ title: "Action Failed", description: d?.error || "Could not complete action.", variant: "destructive", duration: 4000 });
      }
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 4000 });
    }
    if (mountedRef.current) setActing(null);
  }, [toast, loadData]);

  const mode = settings?.execution_mode || "signal_only";
  const modeMeta = MODE_META[mode];
  const activeSignals = signals.filter(s => s.status === "WAITING_FOR_ENTRY" || s.status === "CONFIRMED");
  const recentSignals = signals.filter(s => s.status === "EXECUTED" || s.status === "EXPIRED" || s.status === "CANCELLED").slice(0, 2);
  const currentSignal = activeSignals[0] || null;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,204,66,0.03)", border: "1px solid rgba(255,204,66,0.15)", backdropFilter: "blur(12px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,204,66,0.1)" }}>
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-[#FFCC42]" />
          <p className="font-mono font-bold text-xs text-white tracking-[0.15em]">SIGNAL ASSISTANT</p>
        </div>
        <span className="text-[9px] font-mono font-bold tracking-[0.15em]" style={{ color: modeMeta.color }}>{modeMeta.label}</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Mode description */}
        <p className="text-[9px] text-white/35 font-mono leading-relaxed">{modeMeta.desc} · {settings?.virtual_trigger_mode ? "Virtual Trigger" : "Broker Pending"} · Exp {settings?.signal_expiration_minutes ?? 30}min</p>

        {/* Scan button */}
        <motion.button
          onClick={scanMarket}
          disabled={scanning || !connected}
          whileTap={{ scale: 0.97 }}
          className="w-full h-10 rounded-xl flex items-center justify-center gap-2 font-mono font-bold text-[11px] tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50"
          style={{ background: "rgba(255,204,66,0.08)", border: "1px solid rgba(255,204,66,0.3)", color: "#FFCC42" }}
        >
          {scanning ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> SCANNING…</> : <><RefreshCw className="w-3.5 h-3.5" /> SCAN MARKET</>}
        </motion.button>

        {/* Active signal display */}
        <AnimatePresence mode="wait">
          {currentSignal ? (
            <motion.div key={currentSignal.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="rounded-xl p-3 space-y-2.5"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>

              {/* Direction + Symbol + Status */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: currentSignal.direction === "BUY" ? "rgba(0,255,65,0.1)" : "rgba(255,49,49,0.1)" }}>
                    {currentSignal.direction === "BUY"
                      ? <TrendingUp className="w-5 h-5 text-[#00FF41]" />
                      : <TrendingDown className="w-5 h-5 text-[#FF3131]" />}
                  </div>
                  <div>
                    <p className="font-mono font-bold text-sm text-white">{currentSignal.symbol}</p>
                    <p className="text-[9px] text-white/40">{currentSignal.strategy_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <StatusBadge status={currentSignal.status} />
                  <p className="text-[9px] font-mono text-white/30 mt-0.5">{currentSignal.direction === "BUY" ? "BUY" : "SELL"}</p>
                </div>
              </div>

              {/* Confidence + Expiration */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-[#FFCC42]" />
                  <span className="font-mono font-bold text-sm text-[#FFCC42]" style={{ textShadow: "0 0 8px rgba(255,204,66,0.4)" }}>{currentSignal.confidence_score}</span>
                  <span className="text-[9px] text-white/30">/100</span>
                </div>
                <ExpirationTimer expiration={currentSignal.expiration_time} now={now} />
              </div>

              {/* Trade params grid */}
              <div className="grid grid-cols-2 gap-1.5">
                <ParamCell label="Entry" value={fmtPrice(currentSignal.entry_price)} />
                <ParamCell label="Lot Size" value={currentSignal.lot_size ?? "--"} />
                <ParamCell label="Stop Loss" value={fmtPrice(currentSignal.stop_loss)} color="#FF3131" />
                <ParamCell label="Take Profit" value={fmtPrice(currentSignal.take_profit)} color="#00FF41" />
                <ParamCell label="Risk %" value={`${currentSignal.risk_percentage ?? "--"}%`} />
                <ParamCell label="R:R" value={`1:${currentSignal.risk_reward ?? "--"}`} />
              </div>

              {/* Reasons */}
              <div className="space-y-1">
                <ReasonRow label="Signal" text={currentSignal.signal_reason} />
                <ReasonRow label="Structure" text={currentSignal.market_structure_reason} />
              </div>

              {/* Action buttons — Semi-Auto mode */}
              {mode === "semi_auto" && (currentSignal.status === "WAITING_FOR_ENTRY" || currentSignal.status === "CONFIRMED") && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <ActionButton
                    onClick={() => executeAction(currentSignal.id, "execute", "Trade Executed")}
                    disabled={!!acting}
                    loading={acting === "execute"}
                    icon={<Zap className="w-3 h-3" />}
                    label={currentSignal.direction === "BUY" ? "BUY NOW" : "SELL NOW"}
                    color={currentSignal.direction === "BUY" ? "#00FF41" : "#FF3131"}
                  />
                  <ActionButton
                    onClick={() => executeAction(currentSignal.id, "place_pending", "Pending Order Placed")}
                    disabled={!!acting}
                    loading={acting === "place_pending"}
                    icon={<FileClock className="w-3 h-3" />}
                    label="PENDING ORDER"
                    color="#FFCC42"
                  />
                  <ActionButton
                    onClick={() => executeAction(currentSignal.id, "cancel", "Signal Cancelled")}
                    disabled={!!acting}
                    loading={acting === "cancel"}
                    icon={<Ban className="w-3 h-3" />}
                    label="CANCEL SIGNAL"
                    color="#888"
                    full
                  />
                </div>
              )}

              {/* Full Auto status */}
              {mode === "full_auto" && currentSignal.status === "CONFIRMED" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(0,180,255,0.06)", border: "1px solid rgba(0,180,255,0.15)" }}>
                  <Activity className="w-3.5 h-3.5 text-[#00B4FF] animate-pulse" />
                  <p className="text-[10px] text-[#00B4FF] font-mono">Monitoring price — will execute at entry trigger.</p>
                </div>
              )}
              {mode === "full_auto" && currentSignal.status === "WAITING_FOR_ENTRY" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,204,66,0.05)", border: "1px solid rgba(255,204,66,0.15)" }}>
                  <Activity className="w-3.5 h-3.5 text-[#FFCC42] animate-pulse" />
                  <p className="text-[10px] text-[#FFCC42] font-mono">Waiting confirmation — monitor will activate shortly.</p>
                </div>
              )}

              {/* Signal Only mode */}
              {mode === "signal_only" && currentSignal.status === "WAITING_FOR_ENTRY" && (
                <p className="text-[9px] text-white/25 text-center pt-1">Signal Only Mode — review and decide manually.</p>
              )}
            </motion.div>
          ) : (
            <motion.div key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-6 gap-2">
              <Shield className="w-5 h-5 text-white/15" />
              <p className="text-[10px] text-white/25 font-mono">No active signals — press SCAN to find setups</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent signals */}
        {recentSignals.length > 0 && (
          <div className="space-y-1 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <p className="text-[8px] text-white/25 font-mono uppercase tracking-wider pt-1">Recent</p>
            {recentSignals.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {s.status === "EXECUTED" ? <CheckCircle2 className="w-3 h-3 text-[#00FF41]" />
                    : s.status === "EXPIRED" ? <Clock className="w-3 h-3 text-[#FF3131]/60" />
                    : <XCircle className="w-3 h-3 text-white/30" />}
                  <span className="text-[10px] font-mono text-white/40">{s.direction} {s.symbol}</span>
                </div>
                <span className="text-[9px] font-mono" style={{ color: STATUS_META[s.status]?.color }}>{STATUS_META[s.status]?.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.WAITING_FOR_ENTRY;
  return (
    <span className="text-[8px] font-mono font-bold tracking-[0.15em] px-1.5 py-0.5 rounded"
      style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
  );
}

function ExpirationTimer({ expiration, now }) {
  const left = timeLeft(expiration);
  const mins = Math.floor(left / 60);
  const secs = left % 60;
  const danger = left <= 30;
  return (
    <div className="flex items-center gap-1">
      <Clock className={`w-3 h-3 ${danger ? "text-[#FF3131]" : "text-white/30"}`} />
      <span className={`font-mono font-bold text-xs ${danger ? "text-[#FF3131]" : "text-white/50"}`}>
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  );
}

function ParamCell({ label, value, color }) {
  return (
    <div className="px-2 py-1.5 rounded-md" style={{ background: "rgba(255,255,255,0.02)" }}>
      <p className="text-[8px] text-white/30 font-mono uppercase tracking-wider">{label}</p>
      <p className="text-xs font-mono font-bold" style={{ color: color || "white" }}>{value}</p>
    </div>
  );
}

function ReasonRow({ label, text }) {
  if (!text) return null;
  return (
    <div className="px-2 py-1.5 rounded-md" style={{ background: "rgba(255,255,255,0.015)" }}>
      <p className="text-[8px] text-white/30 font-mono uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-[9px] text-white/50 leading-relaxed">{text}</p>
    </div>
  );
}

function ActionButton({ onClick, disabled, loading, icon, label, color, full }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.96 }}
      className={`${full ? "col-span-2" : ""} h-9 rounded-lg flex items-center justify-center gap-1.5 font-mono font-bold text-[10px] tracking-[0.15em] active:scale-95 transition-all disabled:opacity-50`}
      style={{ background: `${color}10`, border: `1px solid ${color}40`, color }}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : icon}
      <span>{label}</span>
    </motion.button>
  );
}