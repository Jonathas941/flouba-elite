import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { setVisibleInterval } from "@/lib/visibleInterval";
import GlassCard from "@/components/GlassCard";
import { Radio, CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";

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

export default function TradingViewSignals() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("mt5Bridge", { action: "tv_feed" });
      if (!mountedRef.current) return;
      const d = res?.data;
      if (d?.ok) {
        setData(d.data);
        setError(null);
      } else {
        setError(d?.error || "Failed to load TradingView feed");
      }
    } catch (e) {
      if (mountedRef.current) setError(e.message || "Failed to load TradingView feed");
    }
    if (mountedRef.current) setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const cleanup = setVisibleInterval(load, POLL_MS);
    return cleanup;
  }, [load]);

  const signals = data?.signals || [];
  const bridgeOnline = data?.bridge_online ?? false;
  const todayTotal = data?.today_total ?? 0;
  const todayAccepted = data?.today_accepted ?? 0;
  const todayRejected = data?.today_rejected ?? 0;

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

      {/* Bridge status + today's totals */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-heading tracking-widest ${bridgeOnline ? "text-[#00FF41]" : "text-[#FF3131]"}`}
          style={{ background: bridgeOnline ? "rgba(0,255,65,0.08)" : "rgba(255,49,49,0.08)", border: `1px solid ${bridgeOnline ? "rgba(0,255,65,0.3)" : "rgba(255,49,49,0.3)"}` }}>
          <span className={`w-1.5 h-1.5 rounded-full ${bridgeOnline ? "bg-[#00FF41] animate-pulse" : "bg-[#FF3131]"}`} />
          {bridgeOnline ? "BRIDGE ONLINE" : "BRIDGE OFFLINE"}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-heading tracking-wider text-white/60"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          TODAY: {todayTotal}
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
      {loading && !data && (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="w-4 h-4 text-[#00FF41] animate-spin" />
          <p className="text-[10px] text-white/40 font-heading tracking-wide">Loading TradingView feed…</p>
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
      {data && !loading && (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {signals.length === 0 ? (
            <p className="text-[10px] text-white/30 text-center py-6">No TradingView signals received yet.</p>
          ) : (
            signals.map((sig, i) => {
              const accepted = sig.accepted !== false && sig.status !== "rejected";
              const rejected = sig.accepted === false || sig.status === "rejected";
              return (
                <div key={i} className="px-2.5 py-2 rounded-lg bg-white/3 border border-white/5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <ActionBadge action={sig.action} />
                      <span className="text-[10px] font-bold text-white/80">{sig.symbol || "--"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {accepted && <CheckCircle2 className="w-3 h-3 text-[#00FF41]" />}
                      {rejected && <XCircle className="w-3 h-3 text-[#FF3131]" />}
                      <span className="text-[9px] text-white/30">{formatTime(sig.received_at || sig.timestamp || sig.time)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] text-white/40">
                    <span>Lot: <span className="text-white/70 font-semibold">{sig.lot ?? sig.volume ?? "--"}</span></span>
                    <span>SL: <span className="text-white/70 font-semibold">{sig.sl ?? sig.stop_loss ?? "--"}</span></span>
                    <span>TP: <span className="text-white/70 font-semibold">{sig.tp ?? sig.take_profit ?? "--"}</span></span>
                    {sig.strategy && <span>Strat: <span className="text-white/70 font-semibold truncate">{sig.strategy}</span></span>}
                  </div>
                  {rejected && sig.rejection_reason && (
                    <p className="text-[9px] text-[#FF3131]/80 mt-1 truncate">Reason: {sig.rejection_reason}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </GlassCard>
  );
}