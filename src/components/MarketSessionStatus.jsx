import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Globe, Clock, AlertTriangle, CheckCircle2, Activity, Crosshair } from "lucide-react";
import { base44 } from "@/api/base44Client";

function QualityBar({ score, max, minRequired }) {
  const pct = max ? (score / max) * 100 : 0;
  const passed = score >= minRequired;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${passed ? "bg-green-500" : "bg-amber-500"}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <span className={`text-[10px] font-heading font-bold ${passed ? "text-green-400" : "text-amber-400"}`}>
        {score ?? "--"}/{max}
      </span>
    </div>
  );
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
          Loading session status…
        </p>
      </div>
    );
  }

  const session = status.session_active;
  const isAsian = session === "Asian";
  const isNY = session === "New York";
  const isClosed = !session;

  // Session accent color
  const accent = isAsian ? "text-violet-400" : isNY ? "text-green-400" : "text-red-400";
  const accentBg = isAsian ? "bg-violet-500/10 border-violet-500/30" : isNY ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30";
  const accentDot = isAsian ? "bg-violet-400" : isNY ? "bg-green-400" : "bg-red-400";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Header — Session Status Badge */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-red-400" />
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-heading">
            Trading Session
          </p>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase tracking-wider ${accentBg}`}>
          <motion.div
            className={`w-1.5 h-1.5 rounded-full ${accentDot}`}
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          {isAsian ? "ASIAN ACTIVE" : isNY ? "NY ACTIVE" : "MARKET CLOSED"}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Entry allowed / blocked */}
        <div className="flex items-center gap-2">
          {status.allowed ? (
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <p className={`text-xs font-heading font-bold ${status.allowed ? "text-green-400" : "text-amber-400"}`}>
            {status.allowed ? "ENTRY ALLOWED" : "ENTRY BLOCKED"}
          </p>
        </div>

        {/* ET time + market open */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-white/30">ET Time</span>
          <span className="text-xs text-white/60 font-heading">
            {status.et_day} {status.et_time}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-white/30">Market</span>
          <span className={`text-xs font-heading font-bold ${status.market_open ? "text-green-400" : "text-red-400"}`}>
            {status.market_open ? "OPEN" : "CLOSED"}
          </span>
        </div>

        {/* Active pair + pair status */}
        {status.active_pair && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/30">Pair</span>
            <div className="text-right">
              <p className="text-xs text-white font-heading font-bold">{status.active_pair}</p>
              {status.pair_status && status.pair_status !== "N/A" && (
                <p className={`text-[9px] font-heading ${
                  status.pair_status === "Preferred" ? "text-green-400" :
                  status.pair_status.startsWith("Conditional") ? "text-amber-400" :
                  "text-white/40"
                }`}>
                  {status.pair_status}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Preferred pairs for active session */}
        {session && status.preferred_pairs?.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/30">Preferred</span>
            <span className="text-[10px] text-white/50 font-heading">
              {status.preferred_pairs.join(" · ")}
            </span>
          </div>
        )}

        {/* Spread */}
        {status.spread != null && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Crosshair className="w-3 h-3 text-white/30" />
              <span className="text-[10px] uppercase tracking-wider text-white/30">Spread</span>
            </div>
            <span className={`text-xs font-heading font-bold ${status.spread > 5 ? "text-amber-400" : "text-white/70"}`}>
              {status.spread} pips
            </span>
          </div>
        )}

        {/* Trade quality score */}
        {status.trade_quality_score != null && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-white/30" />
                <span className="text-[10px] uppercase tracking-wider text-white/30">Quality Score</span>
              </div>
              <span className="text-[9px] text-white/30 font-heading">
                min {status.min_quality_score}/{status.trade_quality_max}
              </span>
            </div>
            <QualityBar
              score={status.trade_quality_score}
              max={status.trade_quality_max}
              minRequired={status.min_quality_score}
            />
            {status.quality_checks?.length > 0 && (
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 pt-0.5">
                {status.quality_checks.map((c, i) => (
                  <span key={i} className={`text-[8px] font-heading ${c.startsWith("✓") ? "text-green-400/60" : "text-red-400/60"}`}>
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Session risk info */}
        {session && (
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-[10px] uppercase tracking-wider text-white/30">Risk / Max Pos</span>
            <span className="text-[10px] text-white/50 font-heading">
              ×{status.session_risk_multiplier} · {status.session_max_positions}
            </span>
          </div>
        )}

        {/* Block reason */}
        {!status.allowed && status.reason && (
          <div className="pt-2 border-t border-white/5">
            <p className="text-[10px] text-amber-300/70 leading-relaxed">{status.reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}