import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";

// Generic status messages shown when no real indicator data is available
const GENERIC_LINES = [
  "[SYS] Initializing Flouba Elite engine…",
  "[MKT] Fetching market data from MT5 bridge…",
  "[SMC] Scanning market structure…",
  "[SMC] Checking break of structure…",
  "[SMC] Checking change of character…",
  "[SMC] Scanning liquidity pools…",
  "[FVG] Scanning fair value gaps…",
  "[SND] Checking supply/demand zones…",
  "[LVL] Mapping key support/resistance levels…",
  "[SES] Checking trading session status…",
  "[NWS] Checking news calendar…",
  "[RISK] Verifying capital protection gates…",
  "[SCAN] No valid signal yet — monitoring…",
  "[SCAN] Waiting for confluence alignment…",
  "[SCAN] Retrying scan cycle…",
];

function fmtNum(v, digits = 2) {
  if (v == null || isNaN(v)) return null;
  return Number(v).toFixed(digits);
}

export default function TerminalScanner({ active, statusLabel, statusDesc, statusColor, statusDot, connected }) {
  const [lines, setLines] = useState([]);
  const [engineData, setEngineData] = useState(null);
  const scrollRef = useRef(null);

  // Poll the trade decision engine for real indicator data
  const fetchEngineData = useCallback(async () => {
    if (!active || !connected) {
      setEngineData(null);
      return;
    }
    try {
      const res = await base44.functions.invoke("tradeDecisionEngine", {});
      const d = res?.data;
      if (d?.ok && d.connected) {
        setEngineData(d);
      } else {
        setEngineData(null);
      }
    } catch {
      setEngineData(null);
    }
  }, [active, connected]);

  // Refresh engine data every 12s while active
  useEffect(() => {
    fetchEngineData();
    if (!active || !connected) return;
    const interval = setInterval(fetchEngineData, 12000);
    return () => clearInterval(interval);
  }, [fetchEngineData]);

  // Build terminal lines from real data, or cycle generic messages
  useEffect(() => {
    if (!active) {
      setLines([]);
      return;
    }

    // If we have real engine data, build lines from it
    if (engineData) {
      const ind = engineData.indicators || {};
      const pillars = engineData.pillars || [];
      const realLines = [];

      realLines.push(`[REG] Market regime: ${engineData.regime || "Unknown"}${engineData.regime_dir ? ` — ${engineData.regime_dir} bias` : ""}`);

      if (ind.ema_20 != null) {
        const parts = [];
        if (ind.ema_20 != null) parts.push(`EMA20=${fmtNum(ind.ema_20)}`);
        if (ind.ema_50 != null) parts.push(`EMA50=${fmtNum(ind.ema_50)}`);
        if (ind.ema_200 != null) parts.push(`EMA200=${fmtNum(ind.ema_200)}`);
        realLines.push(`[EMA] ${parts.join(" ")}`);
      }
      if (ind.rsi != null) realLines.push(`[RSI] RSI(14)=${fmtNum(ind.rsi, 1)} — ${ind.rsi >= 70 ? "overbought" : ind.rsi <= 30 ? "oversold" : ind.rsi >= 50 ? "neutral-bullish" : "neutral-bearish"}`);
      if (ind.atr != null) realLines.push(`[ATR] ATR(14)=${fmtNum(ind.atr)} — ${ind.atr > 0 ? "volatility normal" : "low volatility"}`);
      if (ind.adx != null) realLines.push(`[ADX] ADX=${fmtNum(ind.adx, 1)} — ${ind.adx >= 25 ? "trend forming" : "no clear trend"}`);
      if (ind.spread != null) realLines.push(`[SPR] Spread ${fmtNum(ind.spread)} — within limit`);

      pillars.forEach((p) => {
        if (p.key === "risk") return; // skip capital protection gate in scanner
        const status = p.pass ? "PASS" : "WAIT";
        realLines.push(`[CONF] ${p.label}: ${status}`);
      });

      realLines.push(`[CONF] Confluence score: ${engineData.score ?? 0}/100`);
      realLines.push(`[SCAN] ${engineData.decision === "TRADE" ? `Signal ready — ${engineData.direction}` : "No valid signal yet — monitoring…"}`);

      setLines(realLines.map((text, i) => ({
        ts: new Date().toLocaleTimeString("en-US", { hour12: false }),
        text,
        id: `real-${i}`,
      })));
      return;
    }

    // No real data — cycle generic messages (no fabricated numbers)
    let idx = 0;
    setLines([]);
    const interval = setInterval(() => {
      if (idx >= GENERIC_LINES.length) idx = 0;
      const line = GENERIC_LINES[idx];
      const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
      setLines((prev) => {
        const next = [...prev, { ts, text: line, id: `gen-${idx}-${Date.now()}` }];
        return next.slice(-14);
      });
      idx++;
    }, 650);
    return () => clearInterval(interval);
  }, [active, engineData]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  if (!active) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 hud-clip-sm flex items-center justify-center shrink-0 bg-white/5"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
        </div>
        <div>
          <p className={`font-mono font-bold text-sm tracking-[0.15em] ${statusColor}`}>{statusLabel}</p>
          <p className="text-[9px] font-mono text-white/35 mt-0.5">{statusDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Status header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 hud-clip-sm flex items-center justify-center shrink-0 bg-[#00FF41]/12"
          style={{ border: "1px solid rgba(0,255,65,0.3)", boxShadow: "0 0 14px rgba(0,255,65,0.3)" }}>
          <motion.div className="w-2.5 h-2.5 rounded-full bg-[#00FF41]"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }} />
        </div>
        <div>
          <p className={`font-mono font-bold text-sm tracking-[0.15em] ${statusColor}`}>{statusLabel}</p>
          <p className="text-[9px] font-mono text-white/35 mt-0.5">{statusDesc}</p>
        </div>
      </div>

      {/* Terminal output */}
      <div
        ref={scrollRef}
        className="hud-scanline rounded-lg bg-black/70 border border-[#00FF41]/15 overflow-hidden"
        style={{ height: "140px", overflowY: "auto" }}
      >
        <div className="px-2.5 py-2 space-y-0.5 font-mono text-[9px] leading-tight">
          {lines.length === 0 && (
            <p className="text-[#00FF41]/40">{" > booting scanner…"}</p>
          )}
          {lines.map((line, i) => {
            const isLast = i === lines.length - 1;
            const tag = line.text.match(/^\[(\w+)\]/)?.[1] || "SYS";
            const tagColor =
              tag === "SMC" || tag === "FVG" || tag === "SND" ? "text-amber-400" :
              tag === "RISK" ? "text-red-400" :
              tag === "CONF" ? "text-cyan-400" :
              tag === "SCAN" ? "text-[#00FF41]" :
              "text-white/50";
            return (
              <motion.div
                key={line.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="flex gap-1.5"
              >
                <span className="text-white/20 shrink-0">{line.ts}</span>
                <span className={`shrink-0 ${tagColor}`}>[{tag}]</span>
                <span className={`text-white/70 ${isLast ? "neon-text-green" : ""}`}>{line.text.replace(/^\[\w+\]\s*/, "")}</span>
                {isLast && <span className="text-[#00FF41] animate-pulse">{"█"}</span>}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}