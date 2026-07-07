import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Shield, Brain, CheckCircle2, XCircle, AlertTriangle, Activity } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function DecisionGate() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const evaluate = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("tradeDecisionEngine", {});
      if (res?.data?.ok) setData(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    evaluate();
    const interval = setInterval(evaluate, 12000);
    return () => clearInterval(interval);
  }, [evaluate]);

  if (loading || !data) {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-2.5" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
        <Brain className="w-4 h-4 text-white/30 animate-pulse" />
        <span className="text-[10px] text-white/30 font-heading tracking-wider">Evaluating market conditions…</span>
      </div>
    );
  }

  const isTrade = data.decision === "TRADE";
  const decisionColor = isTrade ? "#00FF41" : data.connected ? "#FFCC42" : "#FF3131";
  const allSafe = data.safety ? Object.values(data.safety).every(Boolean) : true;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0d0d0d", border: `1px solid ${decisionColor}30` }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4" style={{ color: decisionColor }} />
          <span className="text-[10px] font-heading font-bold tracking-wider uppercase text-white/60">Decision Engine</span>
        </div>
        <span className="text-[9px] font-mono text-white/30">{data.score ?? 0}/100</span>
      </div>

      {/* Decision banner */}
      <div className="px-4 py-4" style={{ background: isTrade ? "rgba(0,255,65,0.04)" : data.connected ? "rgba(255,204,66,0.03)" : "transparent" }}>
        <div className="flex items-center gap-3 mb-2">
          <motion.div
            animate={isTrade ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${decisionColor}15`, border: `1px solid ${decisionColor}40` }}
          >
            {isTrade ? <CheckCircle2 className="w-5 h-5" style={{ color: decisionColor }} /> :
             data.connected ? <AlertTriangle className="w-4 h-4" style={{ color: decisionColor }} /> :
             <XCircle className="w-4 h-4" style={{ color: decisionColor }} />}
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-black text-sm tracking-wider" style={{ color: decisionColor }}>
              {isTrade ? `${data.direction} SIGNAL` : "NO TRADE"}
            </p>
            <p className="text-[10px] text-white/40 leading-snug mt-0.5">{data.reason}</p>
          </div>
        </div>

        {isTrade && data.trade && (
          <div className="grid grid-cols-4 gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <MiniStat label="Entry" value={fmtPrice(data.trade.entry, data.account?.symbol)} accent={decisionColor} />
            <MiniStat label="SL" value={fmtPrice(data.trade.stop_loss, data.account?.symbol)} accent="#FF3131" />
            <MiniStat label="TP" value={fmtPrice(data.trade.take_profit, data.account?.symbol)} accent="#00FF41" />
            <MiniStat label="Lot" value={data.trade.lot_size?.toFixed(2)} accent="#FFCC42" />
          </div>
        )}
      </div>

      {/* 8 Pillars scorecard */}
      {data.pillars?.length > 0 && (
        <div className="px-4 py-3 space-y-1.5">
          <p className="text-[9px] font-heading font-bold tracking-wider uppercase text-white/40 mb-2">Confluence Pillars</p>
          {data.pillars.map((p) => (
            <PillarRow key={p.key} pillar={p} />
          ))}
        </div>
      )}

      {/* Account risk snapshot */}
      {data.account && (
        <div className="px-4 py-3 grid grid-cols-3 gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <MiniStat label="Daily P&L" value={fmtPnl(data.account.daily_pnl)} accent={data.account.daily_pnl >= 0 ? "#00FF41" : "#FF3131"} />
          <MiniStat label="Consec. Losses" value={`${data.account.consec_losses}`} accent={data.account.consec_losses >= 2 ? "#FF3131" : "#999"} />
          <MiniStat label="Trades Today" value={`${data.account.trades_today}`} accent="#999" />
        </div>
      )}

      {/* Safety guarantees */}
      {data.safety && (
        <div className="px-4 py-3 flex items-center gap-2 flex-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <Shield className="w-3 h-3" style={{ color: allSafe ? "#00FF41" : "#FF3131" }} />
          {[
            { k: "no_martingale", label: "No Martingale" },
            { k: "no_revenge", label: "No Revenge" },
            { k: "no_overtrading", label: "No Overtrading" },
            { k: "no_grid_after_loss", label: "No Grid" },
          ].map((s) => (
            <span key={s.k} className="text-[8px] px-1.5 py-0.5 rounded font-heading tracking-wider"
              style={{
                background: data.safety[s.k] ? "rgba(0,255,65,0.08)" : "rgba(255,49,49,0.08)",
                color: data.safety[s.k] ? "#00FF41" : "#FF3131",
              }}>
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PillarRow({ pillar }) {
  const color = pillar.pass ? "#00FF41" : "#FF3131";
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-5 text-center">{pillar.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-heading font-bold tracking-wide text-white/70">{pillar.label}</span>
          <span className="text-[9px] font-mono" style={{ color }}>{pillar.score}/100</span>
        </div>
        <p className="text-[9px] text-white/35 leading-tight truncate">{pillar.reason}</p>
      </div>
      {pillar.pass
        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#00FF41" }} />
        : <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "#FF3131" }} />}
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div>
      <p className="text-[8px] text-white/30 uppercase tracking-wider font-heading mb-0.5">{label}</p>
      <p className="text-[11px] font-mono font-bold" style={{ color: accent || "#fff" }}>{value}</p>
    </div>
  );
}

function fmtPrice(v, symbol) {
  if (v == null) return "--";
  const d = symbol === "XAUUSD" ? 2 : 5;
  return Number(v).toFixed(d);
}
function fmtPnl(v) {
  if (v == null) return "--";
  return (v >= 0 ? "+" : "") + `$${Math.abs(v).toFixed(2)}`;
}