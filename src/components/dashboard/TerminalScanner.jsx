import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const SCAN_LINES = [
  "[SYS] Initializing Flouba Elite engine v3.2…",
  "[MKT] Fetching XAUUSD M1 candles…",
  "[MKT] Fetching XAUUSD M5 candles…",
  "[MKT] Fetching XAUUSD M15 candles…",
  "[EMA] EMA20=2341.55 EMA50=2338.12 EMA200=2330.88",
  "[RSI] RSI(14)=58.3 — neutral-bullish",
  "[ATR] ATR(14)=2.41 — volatility normal",
  "[ADX] ADX=24.7 — trend forming",
  "[MACD] Histogram +0.38 — bullish momentum",
  "[SMC] Scanning swing highs/lows (lookback 20)…",
  "[SMC] Checking BOS on M15…",
  "[SMC] Checking CHOCH on M5…",
  "[SMC] Scanning liquidity pools…",
  "[SMC] No sweep detected in current range",
  "[FVG] Scanning fair value gaps…",
  "[FVG] No active FVG within entry zone",
  "[SND] Checking supply/demand zones…",
  "[SND] Demand zone @ 2331.40 confirmed",
  "[LVL] Key resistance: 2345.20",
  "[LVL] Key support: 2331.40",
  "[REG] Market regime: Trending — Bullish bias",
  "[SES] London session: ACTIVE",
  "[SES] New York session: PENDING",
  "[NWS] No high-impact news within 60 min",
  "[SPR] Spread 0.32 — within limit",
  "[RISK] Equity guard: OK — margin 12.4%",
  "[RISK] Daily drawdown: 0.8% — within limit",
  "[CONF] Confluence score: 52/100",
  "[CONF] Pillar 1 (Structure): PASS",
  "[CONF] Pillar 2 (Trend): PASS",
  "[CONF] Pillar 3 (Pullback): WAITING",
  "[CONF] Pillar 4 (Liquidity): PASS",
  "[CONF] Pillar 5 (Volatility): PASS",
  "[CONF] Pillar 6 (Momentum): PASS",
  "[CONF] Pillar 7 (Session): PASS",
  "[CONF] Pillar 8 (News): PASS",
  "[SCAN] No valid signal yet — monitoring…",
  "[SCAN] Waiting for pullback into EMA20 zone…",
  "[SCAN] Retrying scan cycle…",
];

export default function TerminalScanner({ active, statusLabel, statusDesc, statusColor, statusDot, connected }) {
  const [lines, setLines] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setLines([]);
      return;
    }
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= SCAN_LINES.length) idx = 0;
      const line = SCAN_LINES[idx];
      const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
      setLines((prev) => {
        const next = [...prev, { ts, text: line, id: idx }];
        return next.slice(-14);
      });
      idx++;
    }, 650);
    return () => clearInterval(interval);
  }, [active]);

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
                key={line.id + "-" + i}
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