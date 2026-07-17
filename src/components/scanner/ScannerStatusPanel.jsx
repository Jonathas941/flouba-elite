import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, AlertCircle } from "lucide-react";
import { mt5Api } from "@/lib/mt5Api";

export default function ScannerStatusPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await mt5Api.scannerStatus();
        if (cancelled) return;
        if (res?.ok && res?.data) {
          setData(res.data);
          setError(null);
        } else {
          setError(res?.error || res?.data?.message || "Scanner status unavailable");
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
      if (!cancelled) setLoading(false);
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      <span className="text-[10px] text-white/30 font-heading">Loading scanner…</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "rgba(255,80,80,0.05)", border: "1px solid rgba(255,80,80,0.15)" }}>
      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
      <div>
        <p className="text-[10px] font-heading font-bold text-red-400">Scanner Unavailable</p>
        <p className="text-[9px] text-white/30">{error}</p>
      </div>
    </div>
  );

  // Normalise — backend returns { success, scanner: { ... } }
  const s        = data?.scanner ?? data;
  const degraded = s?.degraded === true;
  const running  = s?.robot_running ?? s?.running ?? s?.active ?? false;
  const strategy = s?.strategy ?? s?.active_strategy ?? null;
  const signals  = s?.last_signal ?? s?.signal_count ?? null;
  const score    = s?.signal_score ?? null;
  const lastTick = s?.last_scan_time ? new Date(s.last_scan_time).toLocaleTimeString() : (s?.last_tick ?? null);
  const openPos  = s?.open_positions_count ?? null;
  const symbol   = s?.symbol ?? null;
  const pairs    = symbol ? [symbol] : [];
  const blockReason = s?.risk?.block_reason ?? null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="rounded-xl px-4 py-3 space-y-2"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${running ? "bg-green-500/15" : "bg-white/5"}`}>
            <Zap className={`w-3 h-3 ${running ? "text-green-400" : "text-white/30"}`} />
          </div>
          <p className="font-heading font-bold text-xs text-white uppercase tracking-wider">Scanner Status</p>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-heading font-bold uppercase ${running ? "bg-green-500/10 text-green-400 border border-green-500/25" : "bg-white/5 text-white/30 border border-white/10"}`}>
          <motion.div
            className={`w-1 h-1 rounded-full ${running ? "bg-green-400" : "bg-white/20"}`}
            animate={running ? { scale: [1, 1.8, 1], opacity: [1, 0.3, 1] } : {}}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          {running ? "LIVE" : "IDLE"}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-1.5 pt-1">
        {[
          { label: "LAST SIGNAL",  value: signals ?? "--" },
          { label: "SCORE",        value: score != null ? `${score}/100` : "--" },
          { label: "OPEN POS",     value: openPos != null ? String(openPos) : "--" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg px-2 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-[8px] uppercase tracking-wider text-white/25 font-heading">{label}</p>
            <p className="font-heading font-bold text-xs text-white mt-0.5 truncate">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {strategy && <span className="text-[9px] font-heading font-bold px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 uppercase">{strategy.replace(/_/g," ")}</span>}
        {symbol   && <span className="text-[9px] font-heading font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/50">{symbol}</span>}
        {degraded && <span className="text-[9px] font-heading font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-300 uppercase">Heartbeat Mode</span>}
        {lastTick && <span className="text-[9px] text-white/20 font-heading ml-auto">Scan: {lastTick}</span>}
      </div>

      {degraded && blockReason && (
        <p className="text-[9px] text-amber-300/70 pt-1 leading-snug">⚠ {blockReason}</p>
      )}

      {/* Pair chips */}
      {Array.isArray(pairs) && pairs.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {pairs.slice(0, 10).map((pair) => (
            <span key={pair} className="text-[8px] font-heading font-bold px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/8">
              {pair}
            </span>
          ))}
          {pairs.length > 10 && <span className="text-[8px] text-white/25">+{pairs.length - 10}</span>}
        </div>
      )}
    </motion.div>
  );
}