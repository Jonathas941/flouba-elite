import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { mt5Api } from "@/lib/mt5Api";
import { base44 } from "@/api/base44Client";
import GlassCard from "@/components/GlassCard";
import { getStrategyTimeframes, lastCandleCloseUTC, nextCandleCloseUTC } from "@/lib/strategyTimeframes";
import { Clock, Layers, Gauge, Activity, Monitor, Info } from "lucide-react";

function fmtTime(d) {
  if (!d) return "--";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function Chip({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: "text-white/70 bg-white/5 border-white/10",
    up: "text-[#00ff9d] bg-[#00ff9d]/10 border-[#00ff9d]/25",
    cool: "text-cyan-300 bg-cyan-500/10 border-cyan-500/25",
    warn: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <p className="text-[8px] uppercase tracking-[0.2em] opacity-70 font-heading">{label}</p>
      <p className="font-heading font-bold text-[12px] mt-0.5 truncate">{value}</p>
    </div>
  );
}

export default function StrategyTimeframePanel() {
  const [strategy, setStrategy] = useState(null);
  const [symbol, setSymbol] = useState(null);
  const [chartTf, setChartTf] = useState(null);
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const load = async () => {
      try {
        const [robotRes, scanRes, stgRes] = await Promise.all([
          mt5Api.robotStatus().catch(() => null),
          mt5Api.scannerStatus().catch(() => null),
          base44.entities.BotSettings.list("-created_date", 1).catch(() => []),
        ]);
        if (robotRes?.ok && robotRes.data?.robot) {
          const r = robotRes.data.robot;
          setRunning(!!r.running);
          if (r.config?.strategy) setStrategy(r.config.strategy);
          if (r.config?.symbol) setSymbol(r.config.symbol);
        }
        // chart timeframe if the bridge/scanner exposes it
        const ind = scanRes?.ok ? (scanRes.data?.scanner?.indicators || scanRes.data?.indicators || scanRes.data?.scanner || null) : null;
        const ct = ind?.chart_timeframe || ind?.period || ind?.chart_period || scanRes?.data?.chart_timeframe || null;
        if (ct) setChartTf(String(ct));
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 5000);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(id); clearInterval(tick); };
  }, []);

  const tf = getStrategyTimeframes(strategy);
  const lastClose = strategy ? lastCandleCloseUTC(tf.main, now) : null;
  const nextClose = strategy ? nextCandleCloseUTC(tf.main, now) : null;
  const secsToNext = nextClose ? Math.max(0, Math.floor((nextClose.getTime() - now.getTime()) / 1000)) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Layers className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <h3 className="font-heading text-[13px] font-black text-white tracking-wide leading-tight">Strategy Timeframe Engine</h3>
              <p className="text-[10px] text-white/40">Internal timeframes — independent of chart</p>
            </div>
          </div>
          <span className={`text-[9px] font-heading tracking-widest px-2 py-1 rounded-full ${running ? "text-[#00ff9d] bg-[#00ff9d]/10" : "text-white/40 bg-white/5"}`}>
            {running ? "ACTIVE" : "IDLE"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Chip label="Active Strategy" value={strategy || "—"} tone="cool" />
          <Chip label="Symbol" value={symbol || "—"} tone="neutral" />
          <Chip label="Main Timeframe" value={tf.main} tone="up" />
          <Chip label="HTF Confirmation" value={tf.htf || "None"} tone={tf.htf ? "up" : "neutral"} />
          {tf.confirm && <Chip label="Confirm TF" value={tf.confirm} tone="warn" />}
          {tf.entry && <Chip label="Entry TF" value={tf.entry} tone="warn" />}
          <Chip label="Current Chart TF" value={chartTf || "User-selected"} tone="neutral" />
        </div>

        <div className="flex items-center justify-between py-1.5 border-t border-white/5">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-300" />
            <span className="text-[11px] text-white/55">Last completed signal candle</span>
          </div>
          <span className="text-[11px] font-heading font-bold text-cyan-300">{fmtTime(lastClose)}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-t border-white/5">
          <div className="flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-white/55">Next {tf.main} candle close</span>
          </div>
          <span className="text-[11px] font-heading font-bold text-amber-400">
            {secsToNext != null ? `${Math.floor(secsToNext / 60)}:${String(secsToNext % 60).padStart(2, "0")}` : "--"}
          </span>
        </div>

        {tf.note && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.15)" }}>
            <Activity className="w-3.5 h-3.5 text-cyan-300 shrink-0 mt-0.5" />
            <p className="text-[10px] text-white/65 leading-relaxed">{tf.note}</p>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(0,255,157,0.05)", border: "1px solid rgba(0,255,157,0.18)" }}>
          <Info className="w-3.5 h-3.5 text-[#00ff9d] shrink-0 mt-0.5" />
          <p className="text-[10px] text-[#9dffd4] leading-relaxed">
            Bot uses internal strategy timeframe automatically — M{tf.main?.replace("M", "")}, {tf.htf || "—"} data is read explicitly, so the chart timeframe never changes the strategy result.
          </p>
        </div>
      </GlassCard>
    </motion.div>
  );
}