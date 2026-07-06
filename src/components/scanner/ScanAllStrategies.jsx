import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, RefreshCw, CheckCircle, XCircle, Zap, Brain } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import { useToast } from "@/components/ui/use-toast";

const CORE_STRATEGIES = [
  { key: "swing",  name: "Swing Trend Pullback",   icon: "📈", mentality: "Premium" },
  { key: "smc",    name: "SMC Liquidity Sweep",     icon: "💧", mentality: "Premium" },
  { key: "tpr",    name: "EMA Trend Recovery",      icon: "🔄", mentality: "Premium" },
  { key: "hybrid", name: "Hybrid Confluence",       icon: "🎯", mentality: "Premium" },
  { key: "gdb",    name: "Gold Daily Breakout",     icon: "🥇", mentality: "Basic" },
  { key: "gmr",    name: "Gold Morning Range",      icon: "🌅", mentality: "Basic" },
  { key: "nqkz",   name: "NQ Kill Zone Breakout",   icon: "⚡", mentality: "Basic" },
  { key: "msbos",  name: "Market Structure BOS",    icon: "🏗️", mentality: "Basic" },
  { key: "ofor",   name: "Orderflow Opening Range", icon: "📊", mentality: "Basic" },
];

function scoreColor(score) {
  if (score == null) return "text-white/30";
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function scoreBg(score) {
  if (score == null) return "bg-white/5";
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

export default function ScanAllStrategies() {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [aiPick, setAiPick] = useState(null);

  const handleScanAll = useCallback(async () => {
    setScanning(true);
    setResults(null);
    setAiPick(null);
    try {
      const [metricsRes, scanRes, aiRes] = await Promise.all([
        base44.entities.StrategyMetrics.list().catch(() => []),
        mt5Api.scannerStatus().catch(() => null),
        base44.functions.invoke("aiStrategySelector", {}).catch(() => null),
      ]);

      const metricsMap = {};
      (metricsRes || []).forEach((m) => { metricsMap[m.strategy_key] = m; });

      const scanner = scanRes?.data?.scanner;
      const liveScore = scanner?.signal_score ?? null;
      const liveSymbol = scanner?.symbol ?? "--";

      const rows = CORE_STRATEGIES.map((s) => {
        const m = metricsMap[s.key];
        const score = m?.score ?? m?.suitability ?? null;
        const enabled = m?.enabled ?? false;
        const winRate = m?.win_rate ?? null;
        const netProfit = m?.net_profit ?? null;
        return { ...s, score, enabled, winRate, netProfit, statusMsg: m?.status_message };
      }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

      setResults({ rows, liveSymbol, liveScore });

      if (aiRes?.data?.ok && aiRes.data.strategy) {
        setAiPick({ strategy: aiRes.data.strategy, reason: aiRes.data.reason, confidence: aiRes.data.confidence });
      }

      toast({ title: "Scan Complete", description: `Evaluated ${rows.length} core strategies on ${liveSymbol}.`, duration: 3000 });
    } catch (e) {
      toast({ title: "Scan Failed", description: e.message || "Could not complete strategy scan.", variant: "destructive", duration: 4000 });
    } finally {
      setScanning(false);
    }
  }, [toast]);

  return (
    <div className="space-y-3">
      {/* Scan All button */}
      <motion.button
        onClick={handleScanAll}
        disabled={scanning}
        whileTap={{ scale: 0.97 }}
        className="w-full rounded-2xl flex items-center justify-center gap-2.5 py-3.5 font-heading font-black tracking-[0.15em] text-sm transition-all disabled:opacity-50"
        style={{
          background: "rgba(255,49,49,0.08)",
          color: "#FF3131",
          border: "1px solid rgba(255,49,49,0.4)",
          boxShadow: "0 0 16px rgba(255,49,49,0.1)",
        }}
      >
        {scanning ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> SCANNING ALL STRATEGIES…</>
        ) : (
          <><Radar className="w-4 h-4" /> SCAN ALL STRATEGIES</>
        )}
      </motion.button>

      {/* AI Pick */}
      <AnimatePresence>
        {aiPick && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: "rgba(0,255,65,0.08)", border: "1px solid rgba(0,255,65,0.3)" }}>
            <div className="w-9 h-9 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-green-400/70 font-heading">AI Recommended</p>
              <p className="font-heading font-bold text-sm text-green-400">{aiPick.strategy}</p>
              <p className="text-[10px] text-white/40 mt-0.5 line-clamp-2">{aiPick.reason}</p>
            </div>
            {aiPick.confidence != null && (
              <div className="text-right shrink-0">
                <p className="text-[9px] text-white/30 uppercase">Confidence</p>
                <p className="font-heading font-bold text-sm text-green-400">{Math.round(aiPick.confidence)}%</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results listing */}
      <AnimatePresence>
        {results && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-heading">Core Strategies — {results.liveSymbol}</p>
              {results.liveScore != null && (
                <span className="text-[10px] font-heading font-bold text-white/40">Live Score: {results.liveScore}/100</span>
              )}
            </div>

            {results.rows.map((r, i) => (
              <motion.div key={r.key}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-xl flex items-center gap-3 px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-base shrink-0">{r.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-xs text-white truncate">{r.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-heading font-bold ${
                      r.mentality === "Premium" ? "bg-purple-500/15 text-purple-400 border border-purple-500/30" : "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                    }`}>{r.mentality}</span>
                    {r.enabled ? (
                      <span className="flex items-center gap-0.5 text-[8px] text-green-400/70"><CheckCircle className="w-2.5 h-2.5" />ENABLED</span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[8px] text-white/25"><XCircle className="w-2.5 h-2.5" />COOLDOWN</span>
                    )}
                    {r.winRate != null && (
                      <span className="text-[8px] text-white/30">WR {Math.round(r.winRate)}%</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-heading font-black text-sm ${scoreColor(r.score)}`}>{r.score != null ? Math.round(r.score) : "--"}</p>
                  <p className="text-[8px] text-white/25">/ 100</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {!results && !scanning && (
        <div className="rounded-2xl px-4 py-6 flex flex-col items-center gap-2 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}>
          <Zap className="w-5 h-5 text-white/20" />
          <p className="text-[10px] text-white/30 font-heading uppercase tracking-widest">Press Scan All to evaluate every core strategy</p>
        </div>
      )}
    </div>
  );
}