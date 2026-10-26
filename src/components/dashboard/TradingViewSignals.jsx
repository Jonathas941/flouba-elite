import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { setVisibleInterval } from "@/lib/visibleInterval";
import GlassCard from "@/components/GlassCard";
import { Radio, CheckCircle2, XCircle, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { mapStatus, statusColor, isAcceptedToday, isRejected as isRejectedStatus, isTradeOpen } from "@/lib/tradingViewStatus";

const POLL_MS = 30000;

function formatTime(ts) {
  if (!ts) return "--";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "--";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function ActionBadge({ action }) {
  const isBuy = (action || "").toUpperCase() === "BUY";
  const isSell = (action || "").toUpperCase() === "SELL";
  const isClose = (action || "").toUpperCase().startsWith("CLOSE");
  const color = isBuy ? "#00FF41" : isSell ? "#FF3131" : isClose ? "#FFCC42" : "#888";
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[9px] font-heading font-bold tracking-wider"
      style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}
    >
      {(action || "--").toUpperCase()}
    </span>
  );
}

function LegBadge({ leg }) {
  const opened = leg.status === "opened";
  const failed = leg.status === "failed";
  const simulated = leg.status === "simulated";
  const color = opened ? "#00FF41" : failed ? "#FF3131" : simulated ? "#FFCC42" : "#888";
  const Icon = opened ? CheckCircle2 : failed ? XCircle : simulated ? Radio : AlertTriangle;
  return (
    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] font-heading tracking-wide"
      style={{ background: `${color}10`, border: `1px solid ${color}30`, color }}>
      <Icon className="w-2.5 h-2.5" />
      <span className="font-bold">{leg.label}</span>
      <span>{leg.lot?.toFixed(2) ?? "--"}</span>
      <span className="opacity-60">TP:{leg.tp ?? "--"}</span>
      {failed && leg.error && <span className="text-[8px] opacity-70 truncate max-w-[80px]">{leg.error}</span>}
    </div>
  );
}

export default function TradingViewSignals() {
  const [loading, setLoading] = useState(true);
  const [signals, setSignals] = useState([]);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async () => {
    try {
      const { items } = await base44.entities.TradingViewSignal.filter(
        {}, { sort: "-created_date", limit: 30 }
      );
      if (!mountedRef.current) return;
      setSignals(items || []);
      setError(null);
    } catch (e) {
      if (mountedRef.current) setError(e.message || "Failed to load TradingView signals");
    }
    if (mountedRef.current) setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const cleanup = setVisibleInterval(load, POLL_MS);
    return cleanup;
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const todaySignals = signals.filter(s => (s.received_at || "").slice(0, 10) === today);
  const todayAccepted = todaySignals.filter(s => isAcceptedToday(s.status)).length;
  const todayRejected = todaySignals.filter(s => isRejectedStatus(s.status)).length;

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#00FF41]" />
          <p className="text-sm font-heading font-bold text-white">TradingView Signals</p>
        </div>
        <button onClick={load} disabled={loading}
          className="w-7 h-7 rounded-lg glass flex items-center justify-center active:scale-95">
          <RefreshCw className={`w-3.5 h-3.5 text-white/50 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Today's totals */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-heading tracking-wider text-white/60"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          TODAY: {todaySignals.length}
        </div>
        {todayAccepted > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-heading tracking-wider text-[#00FF41]"
            style={{ background: "rgba(0,255,65,0.06)", border: "1px solid rgba(0,255,65,0.2)" }}>
            <CheckCircle2 className="w-2.5 h-2.5" /> {todayAccepted} ACCEPTED
          </div>
        )}
        {todayRejected > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-heading tracking-wider text-[#FF3131]"
            style={{ background: "rgba(255,49,49,0.06)", border: "1px solid rgba(255,49,49,0.2)" }}>
            <XCircle className="w-2.5 h-2.5" /> {todayRejected} REJECTED
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && signals.length === 0 && (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="w-4 h-4 text-[#00FF41] animate-spin" />
          <p className="text-[10px] text-white/40 font-heading tracking-wide">Loading TradingView signals…</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="py-6 text-center">
          <XCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
          <p className="text-[10px] text-red-400">{error}</p>
        </div>
      )}

      {/* Signal list */}
      {!loading && (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {signals.length === 0 ? (
            <p className="text-[10px] text-white/30 text-center py-6">No TradingView signals received yet.</p>
          ) : (
            signals.map((sig, i) => {
              const mappedStatus = mapStatus(sig.status);
              const accepted = mappedStatus === "Accepted";
              const partial = mappedStatus === "Partially Open";
              const rejected = mappedStatus === "Rejected";
              const errored = false;
              const tradeOpen = isTradeOpen(sig.status);
              const legs = Array.isArray(sig.legs) ? sig.legs : [];
              return (
                <div key={i} className="px-2.5 py-2 rounded-lg bg-white/3 border border-white/5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <ActionBadge action={sig.action} />
                      <span className="text-[10px] font-bold text-white/80">{sig.symbol || "--"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {tradeOpen && <CheckCircle2 className="w-3 h-3 text-[#00FF41]" />}
                      {accepted && !tradeOpen && <Radio className="w-3 h-3 text-[#00FF41]" />}
                      {partial && <AlertTriangle className="w-3 h-3 text-[#FFCC42]" />}
                      {(rejected || errored) && <XCircle className="w-3 h-3 text-[#FF3131]" />}
                      <span className="text-[9px] text-white/30">{formatTime(sig.received_at)}</span>
                    </div>
                  </div>

                  {/* SL / Entry / Total Lot */}
                  <div className="flex items-center gap-3 text-[9px] text-white/40 mb-1">
                    <span>SL: <span className="text-white/70 font-semibold">{sig.sl ?? "--"}</span></span>
                    <span>Entry: <span className="text-white/70 font-semibold">{sig.price ?? "--"}</span></span>
                    {sig.total_lot != null && <span>Total: <span className="text-white/70 font-semibold">{sig.total_lot?.toFixed(2)}</span></span>}
                  </div>

                  {/* TP targets */}
                  <div className="flex items-center gap-3 text-[9px] text-white/40 mb-1">
                    <span>TP1: <span className="text-white/70 font-semibold">{sig.tp1 ?? "--"}</span></span>
                    <span>TP2: <span className="text-white/70 font-semibold">{sig.tp2 ?? "--"}</span></span>
                    <span>TP3: <span className="text-white/70 font-semibold">{sig.tp3 ?? "--"}</span></span>
                  </div>

                  {/* Legs */}
                  {legs.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {legs.map((leg, li) => <LegBadge key={li} leg={leg} />)}
                    </div>
                  )}

                  {/* Status badge + rejection reason */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${statusColor(sig.status)}`}>{mappedStatus}</span>
                    {(sig.rejection_reason || sig.message) && (
                      <p className={`text-[9px] truncate ${partial ? "text-[#FFCC42]/80" : (rejected || errored) ? "text-[#FF3131]/80" : "text-white/30"}`}>
                        {sig.rejection_reason || sig.message}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </GlassCard>
  );
}