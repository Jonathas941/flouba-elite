import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { setVisibleInterval } from "@/lib/visibleInterval";
import GlassCard from "@/components/GlassCard";
import { Activity, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { mapStatus, statusColor, isAcceptedToday, isRejected as isRejectedStatus } from "@/lib/tradingViewStatus";

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isMarketHours() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  return day >= 1 && day <= 5; // Mon–Fri
}

function StatusBadge({ status }) {
  const mapped = mapStatus(status);
  const cls = statusColor(status);
  return <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${cls}`}>{mapped}</span>;
}

export default function PipelineStatusCard({ onSignals }) {
  const [signals, setSignals] = useState([]);
  const [bridgeStatus, setBridgeStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const [sigList, statusRes] = await Promise.all([
        base44.entities.TradingViewSignal.list("-created_date", 20),
        base44.functions.invoke("mt5Bridge", { action: "status" }).catch(() => null),
      ]);
      setSignals(sigList || []);
      if (onSignals) onSignals(sigList || []);
      setBridgeStatus(statusRes?.data || null);
    } catch {
      // silent — will retry next tick
    } finally {
      setLoading(false);
    }
  }, [onSignals]);

  useEffect(() => {
    fetchStatus();
    const cleanup = setVisibleInterval(fetchStatus, 60000);
    return cleanup;
  }, [fetchStatus]);

  const lastSignal = signals[0];
  const todaySignals = signals.filter(s => isToday(s.received_at || s.created_date));
  const todayReceived = todaySignals.length;
  const todayAccepted = todaySignals.filter(s => isAcceptedToday(s.status)).length;
  const todayRejected = todaySignals.filter(s => isRejectedStatus(s.status)).length;

  const last3 = signals.slice(0, 3);
  const last3Rejected = last3.length === 3 && last3.every(s => isRejectedStatus(s.status));

  const lastSignalDate = lastSignal?.received_at || lastSignal?.created_date;
  const noSignal24h = lastSignalDate ? (Date.now() - new Date(lastSignalDate).getTime()) > 24 * 60 * 60 * 1000 : signals.length === 0;
  const showAlert = (noSignal24h && isMarketHours()) || last3Rejected;

  const bridgeConnected = bridgeStatus?.connected === true || bridgeStatus?.status === "connected";
  const eaVersion = bridgeStatus?.ea_version || bridgeStatus?.data?.ea_version || "—";

  if (loading) {
    return (
      <GlassCard className="p-4">
        <div className="w-6 h-6 border-2 border-[#FF3131]/30 border-t-[#FF3131] rounded-full animate-spin mx-auto" />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider">Pipeline Status</h2>
        <span className="text-[9px] text-white/30">refreshes every 60s</span>
      </div>

      {/* Alert Banner */}
      {showAlert && (
        <div className="bg-[#FF3131]/10 border border-[#FF3131]/30 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#FF3131] mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-white/80">
            {noSignal24h && isMarketHours() && (
              <p>No signal received in the last 24 hours during market hours.</p>
            )}
            {last3Rejected && <p>The last 3 signals were all rejected — check your alert configuration.</p>}
          </div>
        </div>
      )}

      {/* Last Signal */}
      <div className="bg-black/30 rounded-lg p-3 border border-white/5 space-y-1.5">
        <p className="text-[9px] text-white/30 uppercase tracking-wider">Last Signal Received</p>
        {lastSignal ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/80 font-bold">{lastSignal.symbol || "—"}</span>
              <StatusBadge status={lastSignal.status} />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/40">
              <span>{lastSignal.action || "—"}</span>
              <span>{lastSignal.received_at ? new Date(lastSignal.received_at).toLocaleString() : "—"}</span>
            </div>
            {lastSignal.message && (
              <p className="text-[10px] text-white/30 italic truncate">{lastSignal.message}</p>
            )}
          </>
        ) : (
          <p className="text-[10px] text-white/30">No signals received yet.</p>
        )}
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-black/30 rounded-lg p-2.5 border border-white/5 text-center">
          <p className="text-[9px] text-white/30 uppercase tracking-wider">Received</p>
          <p className="text-lg font-bold text-white/80">{todayReceived}</p>
        </div>
        <div className="bg-black/30 rounded-lg p-2.5 border border-white/5 text-center">
          <p className="text-[9px] text-white/30 uppercase tracking-wider">Accepted</p>
          <p className="text-lg font-bold text-[#00FF41]">{todayAccepted}</p>
        </div>
        <div className="bg-black/30 rounded-lg p-2.5 border border-white/5 text-center">
          <p className="text-[9px] text-white/30 uppercase tracking-wider">Rejected</p>
          <p className="text-lg font-bold text-[#FF3131]">{todayRejected}</p>
        </div>
      </div>

      {/* MT5 Bridge */}
      <div className="bg-black/30 rounded-lg p-3 border border-white/5 space-y-1.5">
        <p className="text-[9px] text-white/30 uppercase tracking-wider">MT5 Bridge</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {bridgeConnected ? (
              <CheckCircle className="w-4 h-4 text-[#00FF41]" />
            ) : (
              <XCircle className="w-4 h-4 text-[#FF3131]" />
            )}
            <span className="text-xs text-white/80 font-bold">
              {bridgeConnected ? "Online" : "Offline"}
            </span>
          </div>
          <div className="text-[10px] text-white/40">
            <span className="text-white/30">EA: </span>
            <span className="font-mono">{eaVersion}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}