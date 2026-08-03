import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Globe, AlertTriangle, CheckCircle2, Activity, Crosshair, Sun, Moon, Timer } from "lucide-react";
import { base44 } from "@/api/base44Client";

function QualityBar({ score, max, minRequired }) {
  const pct = max && score != null ? (score / max) * 100 : 0;
  const passed = score != null && score >= minRequired;
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

  // Countdown to next session open — ticks every second
  const [countdown, setCountdown] = useState(null);
  useEffect(() => {
    if (!status?.next_session_at) { setCountdown(null); return; }
    const tick = () => {
      const target = new Date(status.next_session_at).getTime();
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown(null); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown({ h, m, s, label: status.next_session_label });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status?.next_session_at, status?.next_session_label]);

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
  const unavailable = status.session_label === "SESSION UNAVAILABLE";

  const accent = unavailable ? "text-white/40" : isAsian ? "text-violet-400" : isNY ? "text-green-400" : "text-red-400";
  const accentBg = unavailable ? "bg-white/5 border-white/10" : isAsian ? "bg-violet-500/10 border-violet-500/30" : isNY ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30";
  const accentDot = unavailable ? "bg-white/30" : isAsian ? "bg-violet-400" : isNY ? "bg-green-400" : "bg-red-400";

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
          {status.session_label || "MARKET CLOSED"}
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

        {/* Countdown to next market open */}
        {!status.allowed && countdown && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl px-3 py-2.5 flex items-center justify-between"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-red-400" />
              <div>
                <p className="text-[9px] uppercase tracking-wider text-white/40 font-heading">Next Market Open</p>
                <p className="text-[10px] text-white/60 font-heading">{countdown.label} Session</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 font-heading font-black text-red-400">
              <span className="text-lg tabular-nums">{String(countdown.h).padStart(2, "0")}</span>
              <span className="text-[9px] text-white/30 mx-0.5">h</span>
              <span className="text-lg tabular-nums">{String(countdown.m).padStart(2, "0")}</span>
              <span className="text-[9px] text-white/30 mx-0.5">m</span>
              <span className="text-lg tabular-nums">{String(countdown.s).padStart(2, "0")}</span>
              <span className="text-[9px] text-white/30 ml-0.5">s</span>
            </div>
          </motion.div>
        )}

        {/* ET time + market status */}
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

        {/* Rollover blackout warning */}
        {status.in_rollover && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-[9px] text-amber-400 font-heading uppercase tracking-wider">Rollover Blackout Active</span>
          </div>
        )}

        {/* Active pair + pair status */}
        {status.active_pair && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/30">Pair</span>
            <div className="text-right">
              <p className="text-xs text-white font-heading font-bold">{status.active_pair}</p>
              {status.pair_status && status.pair_status !== "N/A" && (
                <p className={`text-[9px] font-heading ${
                  status.pair_status === "Allowed" ? "text-green-400" : "text-amber-400"
                }`}>
                  {status.pair_status}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Allowed pairs for active session */}
        {session && status.allowed_pairs?.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/30">Allowed Pairs</span>
            <span className="text-[10px] text-white/50 font-heading text-right max-w-[60%]">
              {status.allowed_pairs.join(" · ")}
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

        {/* ATR */}
        {status.atr != null && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-white/30">ATR</span>
            <span className="text-xs text-white/60 font-heading">{status.atr.toFixed(2)}</span>
          </div>
        )}

        {/* Trade quality score (0-100) */}
        {status.trade_quality_score != null && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-white/30" />
                <span className="text-[10px] uppercase tracking-wider text-white/30">Quality Score</span>
              </div>
              <span className="text-[9px] text-white/30 font-heading">
                min {status.min_quality_score}
              </span>
            </div>
            <QualityBar
              score={status.trade_quality_score}
              max={status.trade_quality_max}
              minRequired={status.min_quality_score}
            />
          </div>
        )}

        {/* Session risk multiplier */}
        {session && (
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-[10px] uppercase tracking-wider text-white/30">Risk Multiplier</span>
            <span className="text-[10px] text-white/50 font-heading">
              ×{status.session_risk_multiplier}
            </span>
          </div>
        )}

        {/* Session windows */}
        <div className="pt-2 border-t border-white/5 space-y-1.5">
          {status.asian_session_window && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Moon className="w-3 h-3 text-violet-400/60" />
                <span className="text-[10px] uppercase tracking-wider text-white/30">Asian</span>
              </div>
              <span className="text-[9px] text-white/40 font-heading">{status.asian_session_window}</span>
            </div>
          )}
          {status.ny_session_window && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sun className="w-3 h-3 text-green-400/60" />
                <span className="text-[10px] uppercase tracking-wider text-white/30">NY</span>
              </div>
              <span className="text-[9px] text-white/40 font-heading">{status.ny_session_window}</span>
            </div>
          )}
        </div>

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