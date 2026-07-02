import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Globe, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

function formatCountdown(secs) {
  if (secs == null) return "--";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function MarketSessionStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await base44.functions.invoke("sessionManager", {});
        if (res?.data && !res.data.error) setStatus(res.data);
      } catch {}
      setLoading(false);
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !status) {
    return (
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
        <p className="text-[10px] text-white/40 font-heading uppercase tracking-widest">
          Loading market status…
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Header — Market Open/Closed */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-red-400" />
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-heading">
            Market Session
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase tracking-wider ${
            status.market_open
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
          }`}
        >
          <motion.div
            className={`w-1.5 h-1.5 rounded-full ${status.market_open ? "bg-green-400" : "bg-red-400"}`}
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          {status.market_open ? "OPEN" : "CLOSED"}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Trading allowed / blocked */}
        <div className="flex items-center gap-2">
          {status.allowed ? (
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <p
            className={`text-xs font-heading font-bold ${
              status.allowed ? "text-green-400" : "text-amber-400"
            }`}
          >
            {status.allowed ? "TRADING ALLOWED" : "TRADING BLOCKED"}
          </p>
        </div>

        {/* Current active session(s) */}
        {status.current_sessions?.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/30">Active Session</span>
            <span className="text-xs text-white font-heading font-bold">
              {status.current_sessions.join(", ")}
            </span>
          </div>
        )}

        {/* Next session (when none active) */}
        {!status.current_sessions?.length && status.next_session && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/30">Next Session</span>
            <div className="text-right">
              <p className="text-xs text-white font-heading font-bold">
                {status.next_session.name} · {status.next_session.opens_at}
              </p>
              <p className="text-[10px] text-red-400 font-heading">
                {formatCountdown(status.next_session.countdown_seconds)}
              </p>
            </div>
          </div>
        )}

        {/* ET time */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-white/30">ET Time</span>
          <span className="text-xs text-white/60 font-heading">
            {status.et_day} {status.et_time}
          </span>
        </div>

        {/* Block reason */}
        {!status.allowed && status.reason && (
          <div className="pt-2 border-t border-white/5">
            <p className="text-[10px] text-amber-300/70 leading-relaxed">{status.reason}</p>
          </div>
        )}

        {/* Countdown to next trading window */}
        {!status.allowed && status.next_trading_window && (
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-white/40" />
              <span className="text-[10px] uppercase tracking-wider text-white/30">Next Window</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-white font-heading font-bold">
                {status.next_trading_window.opens_at} ET
              </p>
              <p className="text-[10px] text-red-400 font-heading">
                {formatCountdown(status.next_trading_window.countdown_seconds)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}