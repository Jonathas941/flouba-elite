import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, Maximize2, Minimize2, X, MapPin } from "lucide-react";

const SCAN_LABELS = [
  "SCANNING XAUUSD…", "LIQUIDITY DETECTED", "EMA TREND: BULLISH", "BREAKOUT WATCH",
  "SPREAD NORMAL", "AI CONFIDENCE CLIMBING", "LONDON SESSION ACTIVE", "NEW YORK OPEN",
  "MARKET DATA SYNCHRONIZED", "WAITING FOR CONFIRMATION", "VOLUME EXPANSION", "TREND STRENGTH OK",
];
const STATUS_BAR = [
  "Scanning global liquidity", "Monitoring volatility", "Analyzing trend strength", "Waiting for high-quality setup",
];

function Chip({ item }) {
  return (
    <div className="glass rounded-xl px-2.5 py-1.5 flex items-center gap-2" style={{ border: "1px solid rgba(0,229,255,0.18)" }}>
      <span className="text-[8px] uppercase tracking-widest text-white/40 font-heading">{item.label}</span>
      <span className={`font-heading font-bold text-[11px] ${item.accent}`}>{item.value}</span>
    </div>
  );
}

export default function GlobalMarketDataOverlay({ data, status, pairs, onPairClick, selectedCity, onCloseCity, paused, onTogglePause, onToggleFocus, focus }) {
  const [scanIdx, setScanIdx] = useState(0);
  const [barIdx, setBarIdx] = useState(0);
  const [slotIdx, setSlotIdx] = useState([0, 0, 0, 0]);

  useEffect(() => {
    const t = setInterval(() => setScanIdx((i) => (i + 1) % SCAN_LABELS.length), 2600);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setBarIdx((i) => (i + 1) % STATUS_BAR.length), 2200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setSlotIdx((s) => [(s[0] + 1) % 3, (s[1] + 1) % 3, (s[2] + 1) % 3, (s[3] + 1) % 3]), 2600);
    return () => clearInterval(t);
  }, []);

  const slots = [
    [
      { label: "XAUUSD", value: data.prices.XAUUSD != null ? data.prices.XAUUSD.toFixed(2) : "—", accent: "text-[#ffce4d]" },
      { label: "NAS100", value: data.prices.NAS100 != null ? data.prices.NAS100.toFixed(0) : "—", accent: "text-[#00ff9d]" },
      { label: "USDJPY", value: data.prices.USDJPY != null ? data.prices.USDJPY.toFixed(2) : "—", accent: "text-cyan-300" },
    ],
    [
      { label: "ATR", value: data.atr != null ? data.atr.toFixed(3) : "—", accent: "text-white" },
      { label: "RSI", value: data.rsi != null ? data.rsi.toFixed(1) : "—", accent: data.rsi > 70 ? "text-[#ff4d4d]" : data.rsi < 30 ? "text-[#00ff9d]" : "text-white" },
      { label: "SPREAD", value: data.spread != null ? `${data.spread.toFixed(0)}pt` : "—", accent: "text-white" },
    ],
    [
      { label: "EMA", value: data.emaTrend, accent: data.emaTrend === "Bullish" ? "text-[#00ff9d]" : data.emaTrend === "Bearish" ? "text-[#ff4d4d]" : "text-white" },
      { label: "AI SCORE", value: data.aiScore ? `${data.aiScore}%` : "—", accent: "text-cyan-300" },
      { label: "VOLUME", value: data.volume ? data.volume.toLocaleString() : "—", accent: "text-white" },
    ],
    [
      { label: "EURUSD", value: data.prices.EURUSD != null ? data.prices.EURUSD.toFixed(4) : "—", accent: "text-cyan-300" },
      { label: "GBPUSD", value: data.prices.GBPUSD != null ? data.prices.GBPUSD.toFixed(4) : "—", accent: "text-cyan-300" },
      { label: "CONFIDENCE", value: data.confidence ? `${data.confidence}%` : "—", accent: "text-[#ffce4d]" },
    ],
  ];
  const positions = ["top-14 left-3", "top-14 right-3", "bottom-16 left-3", "bottom-16 right-3"];

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between">
        <div>
          <h2 className="font-heading text-sm font-black text-white tracking-widest neon-text-cyan">GLOBAL MARKET INTELLIGENCE</h2>
          <p className="text-[9px] text-white/40">Flouba Elite AI scans global market conditions in real time.</p>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button onClick={onTogglePause} className="w-8 h-8 rounded-lg glass flex items-center justify-center">
            {paused ? <Play className="w-3.5 h-3.5 text-cyan-300" /> : <Pause className="w-3.5 h-3.5 text-cyan-300" />}
          </button>
          <button onClick={onToggleFocus} className="w-8 h-8 rounded-lg glass flex items-center justify-center">
            {focus ? <Minimize2 className="w-3.5 h-3.5 text-cyan-300" /> : <Maximize2 className="w-3.5 h-3.5 text-cyan-300" />}
          </button>
        </div>
      </div>

      {/* Status indicator */}
      <div className="absolute top-12 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${status.color}55` }}>
        <motion.span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
        <span className="text-[8px] font-heading tracking-widest" style={{ color: status.color }}>{status.label}</span>
      </div>

      {/* Scan label */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2">
        <AnimatePresence mode="wait">
          <motion.span key={scanIdx} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.4 }} className="text-[9px] font-heading tracking-[0.25em] text-cyan-300/80 whitespace-nowrap">
            {SCAN_LABELS[scanIdx]}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Floating data chips */}
      {slots.map((list, i) => (
        <div key={i} className={`absolute ${positions[i]}`}>
          <AnimatePresence mode="wait">
            <motion.div key={slotIdx[i]} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.4 }}>
              <Chip item={list[slotIdx[i]]} />
            </motion.div>
          </AnimatePresence>
        </div>
      ))}

      {/* Pair chips (clickable → scanner) */}
      <div className="absolute bottom-9 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-auto overflow-x-auto no-scrollbar max-w-[92%]">
        {pairs.map((p) => (
          <button key={p} onClick={() => onPairClick(p)} className="shrink-0 text-[9px] font-heading tracking-widest px-2 py-1 rounded-lg glass text-cyan-300/80 whitespace-nowrap">
            {p}
          </button>
        ))}
      </div>

      {/* Bottom status bar */}
      <div className="absolute bottom-0 left-0 right-0 h-8 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)", borderTop: "1px solid rgba(0,229,255,0.12)" }}>
        <AnimatePresence mode="wait">
          <motion.span key={barIdx} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.4 }} className="text-[9px] font-heading tracking-[0.2em] text-white/50">
            {STATUS_BAR[barIdx]}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* City popover */}
      <AnimatePresence>
        {selectedCity && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute left-1/2 -translate-x-1/2 bottom-12 w-[80%] max-w-xs glass rounded-xl p-3 pointer-events-auto" style={{ border: "1px solid rgba(0,229,255,0.3)" }}>
            <button onClick={onCloseCity} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
              <X className="w-3 h-3 text-white/50" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-3.5 h-3.5 text-cyan-300" />
              <span className="font-heading text-xs font-bold text-white tracking-wider">{selectedCity.name}</span>
            </div>
            <p className="text-[10px] text-white/60">{selectedCity.session}</p>
            <p className="text-[10px] text-white/40">Active: {selectedCity.time}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}