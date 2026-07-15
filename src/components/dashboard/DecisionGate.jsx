import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Shield, Brain, CheckCircle2, XCircle, AlertTriangle, Zap, Radio, Newspaper } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import { useToast } from "@/components/ui/use-toast";

export default function DecisionGate() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

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

  const handleEmergencyClose = async () => {
    setClosing(true);
    try {
      const res = await mt5Api.closeAll();
      toast({
        title: "Emergency Close Executed",
        description: res?.ok ? "All open positions closed. Capital protected." : (res?.error || "Close command sent."),
        variant: res?.ok ? "default" : "destructive",
        duration: 4000,
      });
    } catch (e) {
      toast({ title: "Close Failed", description: e.message, variant: "destructive", duration: 4000 });
    }
    setClosing(false);
    setTimeout(evaluate, 1500);
  };

  if (loading || !data) {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-2.5" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.06)" }}>
        <Brain className="w-4 h-4 text-white/30 animate-pulse" />
        <span className="text-[10px] text-white/30 font-heading tracking-wider">Analyzing market conditions…</span>
      </div>
    );
  }

  const isTrade = data.decision === "TRADE";
  const isLocked = data.decision === "NO_TRADE" && data.pillars?.some((p) => p.key === "risk" && !p.pass && p.block);
  const decisionColor = isTrade ? "#00FF41" : isLocked ? "#FF3131" : data.connected ? "#FFCC42" : "#FF3131";

  // Bot status state machine
  let botState = "WAITING";
  if (!data.connected) botState = "DISCONNECTED";
  else if (isLocked) botState = "LOCKED";
  else if (data.account?.consec_losses >= 2) botState = "STOPPED";
  else if (isTrade) botState = "ENTERING";
  else if (data.account?.open_positions > 0) botState = "MANAGING";
  else botState = "ANALYZING";

  const ind = data.indicators || {};
  const acct = data.account || {};
  const sess = data.session || {};
  const drawdownPct = acct.balance > 0 ? Math.max(0, ((acct.balance - acct.equity) / acct.balance) * 100) : 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#0d0d0d", border: `1px solid ${decisionColor}30` }}>
      {/* ── Header: Status + Score ── */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-2">
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
            className="w-2 h-2 rounded-full" style={{ background: decisionColor, boxShadow: `0 0 8px ${decisionColor}` }} />
          <span className="text-[10px] font-heading font-bold tracking-wider uppercase text-white/60">Decision Engine</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[8px] text-white/30 uppercase tracking-wider font-heading">Trade Quality</p>
            <p className="text-[14px] font-mono font-black" style={{ color: data.score >= data.min_score ? "#00FF41" : "#FF3131" }}>
              {data.score}<span className="text-[9px] text-white/30">/{data.min_score}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Bot Status Banner ── */}
      <div className="px-4 py-3" style={{ background: `${decisionColor}08` }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${decisionColor}15`, border: `1px solid ${decisionColor}40` }}>
            {isTrade ? <CheckCircle2 className="w-5 h-5" style={{ color: decisionColor }} /> :
             isLocked ? <Shield className="w-5 h-5" style={{ color: decisionColor }} /> :
             <AlertTriangle className="w-4 h-4" style={{ color: decisionColor }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-black text-sm tracking-wider" style={{ color: decisionColor }}>
              {botState} · {isTrade ? `${data.direction} SIGNAL` : "NO TRADE"}
            </p>
            <p className="text-[10px] text-white/40 leading-snug mt-0.5">{data.reason}</p>
          </div>
        </div>

        {/* Mode + Regime + Trend strip */}
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          <StatChip label="Mode" value={data.trading_mode} color="#FFCC42" />
          <StatChip label="Regime" value={data.regime} color="#8888FF" />
          <StatChip label="Trend" value={ind.ema_direction || data.regime_dir || "Flat"} color={ind.ema_direction === "BUY" ? "#00FF41" : ind.ema_direction === "SELL" ? "#FF3131" : "#999"} />
        </div>

        {/* Trade params when signal */}
        {isTrade && data.trade && (
          <div className="grid grid-cols-4 gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <MiniStat label="Entry" value={fmtPrice(data.trade.entry)} accent={decisionColor} />
            <MiniStat label="SL" value={fmtPrice(data.trade.stop_loss)} accent="#FF3131" />
            <MiniStat label="TP" value={fmtPrice(data.trade.take_profit)} accent="#00FF41" />
            <MiniStat label="Lot" value={data.trade.lot_size?.toFixed(2)} accent="#FFCC42" />
          </div>
        )}
      </div>

      {/* ── Indicator Strip: Spread, ATR, RSI, ADX ── */}
      {data.connected && (
        <div className="px-4 py-3 grid grid-cols-4 gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <IndicatorTile label="Spread" value={ind.spread != null ? `${ind.spread}pts` : "--"} ok={ind.spread < 30} />
          <IndicatorTile label="ATR" value={ind.atr ? ind.atr.toFixed(2) : "--"} ok={true} />
          <IndicatorTile label="RSI" value={ind.rsi ? ind.rsi.toFixed(0) : "--"} ok={ind.rsi > 25 && ind.rsi < 75} />
          <IndicatorTile label="ADX" value={ind.adx ? ind.adx.toFixed(0) : "--"} ok={ind.adx == null || ind.adx >= 25} />
        </div>
      )}

      {/* ── Pillar Scorecard ── */}
      {data.pillars?.length > 0 && (
        <div className="px-4 py-3 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-[9px] font-heading font-bold tracking-wider uppercase text-white/40 mb-2">Confluence Pillars (Weighted)</p>
          {data.pillars.filter((p) => p.weight > 0).map((p) => (
            <PillarRow key={p.key} pillar={p} />
          ))}
        </div>
      )}

      {/* ── Account + Risk Snapshot ── */}
      {data.connected && data.account && (
        <div className="px-4 py-3 grid grid-cols-3 gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <MiniStat label="Daily P&L" value={fmtPnl(acct.daily_pnl)} accent={acct.daily_pnl >= 0 ? "#00FF41" : "#FF3131"} />
          <MiniStat label="Drawdown" value={`${drawdownPct.toFixed(2)}%`} accent={drawdownPct > 2 ? "#FF3131" : "#999"} />
          <MiniStat label="Open Trades" value={`${acct.open_positions}/${acct.max_concurrent}`} accent="#FFCC42" />
          <MiniStat label="Consec. Losses" value={`${acct.consec_losses}`} accent={acct.consec_losses >= 2 ? "#FF3131" : "#999"} />
          <MiniStat label="Trades Today" value={`${acct.trades_today}`} accent="#999" />
          <MiniStat label="Risk/Trade" value={data.trade ? `${(data.trade.risk_amount || 0).toFixed(1)}%` : "--"} accent="#FFCC42" />
        </div>
      )}

      {/* ── Session + News Status ── */}
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-1.5">
          <Radio className="w-3 h-3" style={{ color: sess.open ? "#00FF41" : "#FF3131" }} />
          <span className="text-[9px] font-heading tracking-wider" style={{ color: sess.open ? "#00FF41" : "#FF3131" }}>
            {sess.open ? `${sess.name} SESSION` : "MARKET CLOSED"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Newspaper className="w-3 h-3" style={{ color: data.news_safe ? "#00FF41" : "#FF3131" }} />
          <span className="text-[9px] font-heading tracking-wider" style={{ color: data.news_safe ? "#00FF41" : "#FF3131" }}>
            {data.news_safe ? "NEWS SAFE" : "NEWS RISK"}
          </span>
        </div>
      </div>

      {/* ── Safety Guarantees ── */}
      {data.safety && (
        <div className="px-4 py-2.5 flex items-center gap-1.5 flex-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <Shield className="w-3 h-3 shrink-0" style={{ color: "#00FF41" }} />
          {[
            { k: "no_martingale", label: "No Martingale" },
            { k: "no_revenge", label: "No Revenge" },
            { k: "no_overtrading", label: "No Overtrading" },
            { k: "no_grid_after_loss", label: "No Grid" },
            { k: "no_random_entries", label: "No Random Entries" },
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

      {/* ── Emergency Close All ── */}
      {data.connected && (
        <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,49,49,0.15)" }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleEmergencyClose}
            disabled={closing || !data.account?.open_positions}
            className="w-full h-9 rounded-xl flex items-center justify-center gap-2 font-heading font-black text-[11px] tracking-widest disabled:opacity-40"
            style={{ background: "rgba(255,49,49,0.08)", color: "#FF3131", border: "1px solid rgba(255,49,49,0.4)" }}>
            {closing ? (
              <>
                <div className="w-3 h-3 border-2 border-red-500/40 border-t-red-500 rounded-full animate-spin" />
                <span>CLOSING ALL…</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>EMERGENCY CLOSE ALL</span>
              </>
            )}
          </motion.button>
        </div>
      )}
    </div>
  );
}

function PillarRow({ pillar }) {
  const color = pillar.pass ? "#00FF41" : "#FF3131";
  const pts = Math.round((pillar.score / 100) * (pillar.weight || 0));
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-5 text-center">{pillar.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-heading font-bold tracking-wide text-white/70">{pillar.label}</span>
          <span className="text-[9px] font-mono" style={{ color }}>{pts}/{pillar.weight}</span>
        </div>
        <p className="text-[9px] text-white/35 leading-tight truncate">{pillar.reason}</p>
      </div>
      {pillar.pass
        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#00FF41" }} />
        : <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "#FF3131" }} />}
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
      <p className="text-[8px] text-white/30 uppercase tracking-wider font-heading">{label}</p>
      <p className="text-[10px] font-mono font-bold truncate" style={{ color }}>{value}</p>
    </div>
  );
}

function IndicatorTile({ label, value, ok }) {
  return (
    <div className="text-center">
      <p className="text-[8px] text-white/30 uppercase tracking-wider font-heading mb-0.5">{label}</p>
      <p className="text-[11px] font-mono font-bold" style={{ color: ok ? "#00FF41" : "#FF3131" }}>{value}</p>
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

function fmtPrice(v) {
  if (v == null) return "--";
  return Number(v).toFixed(v > 100 ? 2 : 5);
}
function fmtPnl(v) {
  if (v == null) return "--";
  return (v >= 0 ? "+" : "") + `$${Math.abs(v).toFixed(2)}`;
}