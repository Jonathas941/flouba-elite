import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Zap, Shield, Clock, AlertTriangle, Radio } from "lucide-react";

function Metric({ label, value, color = "text-white", small = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] uppercase tracking-[0.2em] text-white/25 font-heading">{label}</span>
      <span className={`font-heading font-bold ${small ? "text-[11px]" : "text-sm"} ${color} leading-tight`}>{value ?? "--"}</span>
    </div>
  );
}

export default function AIDashboard({ data, bestSymbol, selectedTf, newsBlocked, sessionAllowed, session }) {
  if (!data) {
    return (
      <div className="py-8 flex flex-col items-center gap-3 text-center rounded-2xl"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <Radio className="w-7 h-7 text-white/15" />
        <p className="font-heading text-xs uppercase tracking-widest text-white/25">Waiting for scan data…</p>
      </div>
    );
  }

  const scoreColor = data.total >= 85 ? "text-green-400"
    : data.total >= 70 ? "text-amber-400"
    : data.total >= 60 ? "text-orange-400" : "text-white/30";

  const trendColor = data.trend === "Uptrend" ? "text-green-400"
    : data.trend === "Downtrend" ? "text-red-400" : "text-amber-400";

  const blocked = newsBlocked || !sessionAllowed;

  return (
    <div className="space-y-2">
      {/* Quality score hero */}
      <div className="rounded-2xl px-4 py-4 flex items-center justify-between"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div>
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/30 font-heading mb-1">Trade Quality</p>
          <div className="flex items-end gap-1">
            <span className={`font-heading font-black text-4xl ${scoreColor}`}>{data.total}</span>
            <span className="font-heading text-sm text-white/30 mb-1">/100</span>
          </div>
          <div className="w-40 h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
            <motion.div
              className={`h-full rounded-full ${data.total >= 85 ? "bg-green-500" : data.total >= 70 ? "bg-amber-500" : data.total >= 60 ? "bg-orange-500" : "bg-white/15"}`}
              initial={{ width: 0 }}
              animate={{ width: `${data.total}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`px-2 py-1 rounded-lg font-heading font-black text-[10px] tracking-widest ${
            data.direction === "BUY"
              ? "bg-green-500/20 text-green-400 border border-green-500/40"
              : "bg-red-500/20 text-red-400 border border-red-500/40"
          }`}>
            {data.direction === "BUY" ? <TrendingUp className="w-3 h-3 inline mr-1" /> : <TrendingDown className="w-3 h-3 inline mr-1" />}
            {data.direction}
          </div>
          <div className={`px-2 py-0.5 rounded-lg font-heading font-bold text-[9px] ${
            data.riskLevel === "Low" ? "bg-green-500/10 text-green-400"
            : data.riskLevel === "Medium" ? "bg-amber-500/10 text-amber-400"
            : "bg-red-500/10 text-red-400"
          }`}>
            {data.riskLevel} Risk
          </div>
        </div>
      </div>

      {/* Blocked warnings */}
      {newsBlocked && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-[11px] font-heading font-bold text-amber-400">NEWS FILTER ACTIVE — Trading paused near high-impact event</p>
        </div>
      )}
      {!sessionAllowed && !newsBlocked && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
          <Clock className="w-4 h-4 text-white/30 shrink-0" />
          <p className="text-[11px] font-heading font-bold text-white/40">SESSION FILTER — Outside allowed trading hours</p>
        </div>
      )}

      {/* 3-col metrics */}
      <div className="grid grid-cols-3 divide-x divide-white/5 rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="px-3 py-2.5"><Metric label="Trend" value={data.trend} color={trendColor} small /></div>
        <div className="px-3 py-2.5"><Metric label="Session" value={session} small /></div>
        <div className="px-3 py-2.5"><Metric label="Market" value={data.marketStatus} color={data.marketStatus === "High Activity" ? "text-green-400" : data.marketStatus === "Active" ? "text-amber-400" : "text-red-400"} small /></div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-white/5 rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="px-2 py-2.5"><Metric label="Spread" value={data.spread} color={data.spreadOk ? "text-white" : "text-red-400"} small /></div>
        <div className="px-2 py-2.5"><Metric label="ATR" value={data.atrVal} small /></div>
        <div className="px-2 py-2.5"><Metric label="Best" value={bestSymbol?.pair} color="text-amber-400" small /></div>
        <div className="px-2 py-2.5"><Metric label="ADX" value={data.adx?.toFixed(1)} color={data.adx > 25 ? "text-green-400" : "text-amber-400"} small /></div>
      </div>

      {/* SL/TP preview */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <span className="text-[8px] uppercase tracking-widest text-red-400/60 font-heading">Smart SL (ATR×1.5)</span>
          <span className="font-heading font-bold text-sm text-red-400">{data.slDistance}</span>
        </div>
        <div className="rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
          style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
          <span className="text-[8px] uppercase tracking-widest text-green-400/60 font-heading">Smart TP (1:2 RR)</span>
          <span className="font-heading font-bold text-sm text-green-400">{data.tpDistance}</span>
        </div>
      </div>

      {/* SMC flags */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "BOS",    active: data.bos,            color: "text-sky-400 border-sky-500/40 bg-sky-500/10" },
          { label: "CHoCH",  active: data.choch,          color: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
          { label: "LIQ SWEEP", active: data.liquiditySweep, color: "text-purple-400 border-purple-500/40 bg-purple-500/10" },
          { label: "SPREAD OK", active: data.spreadOk,    color: "text-green-400 border-green-500/40 bg-green-500/10" },
          { label: "ATR OK",    active: data.atrOk,       color: "text-green-400 border-green-500/40 bg-green-500/10" },
        ].map(({ label, active, color }) => (
          <span key={label} className={`px-2 py-0.5 rounded-lg font-heading font-bold text-[9px] border transition-all ${active ? color : "text-white/20 border-white/8 bg-white/3"}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}