import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import {
  TrendingUp, TrendingDown, Zap, Shield,
  BarChart3, AlertTriangle, Activity, Layers, Filter, Gauge, Brain,
} from "lucide-react";
import LiveScannerEngine from "@/components/scanner/LiveScannerEngine";
import AIDashboard from "@/components/analysis/AIDashboard";
import SessionNewsFilter from "@/components/analysis/SessionNewsFilter";
import DrawdownProtection from "@/components/analysis/DrawdownProtection";
import LiveDebugPanel from "@/components/scanner/LiveDebugPanel";
import ScannerStatusPanel from "@/components/scanner/ScannerStatusPanel";
import TradeChecklist from "@/components/scanner/TradeChecklist";
import SystemHealthCheck from "@/components/health/SystemHealthCheck";

const TABS = [
  { id: "dashboard", label: "AI Dashboard", icon: Brain },
  { id: "scanner",   label: "Scanner",      icon: Zap },
  { id: "session",   label: "Sessions",     icon: Filter },
  { id: "structure", label: "Structure",    icon: Activity },
  { id: "patterns",  label: "Patterns",     icon: Layers },
  { id: "protect",   label: "Protection",   icon: Shield },
  { id: "health",    label: "Health",       icon: Gauge },
];

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-red-400" />
      </div>
      <div>
        <h2 className="font-heading text-sm font-bold text-white uppercase tracking-wide">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function AIScanner() {
  const [tab, setTab] = useState("dashboard");
  const [scanData, setScanData] = useState(null);  // { scanner, debugLog } — real MT5 data
  const [filterState, setFilterState] = useState({ sessionAllowed: true, newsBlocked: false, newsEvent: null, currentSession: "--" });

  const handleScanUpdate = useCallback((data) => {
    setScanData(data);
  }, []);

  const handleFilterChange = useCallback((state) => {
    setFilterState(state);
  }, []);

  return (
    <div className="bg-black min-h-screen max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <h1 className="font-heading text-xl font-black text-white" style={{ textShadow: "0 0 20px rgba(220,38,38,0.6)" }}>
          AI ANALYSIS
        </h1>
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-heading">Market Quality Engine</p>
      </div>

      {/* Tab bar — horizontal scroll */}
      <div className="px-4 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl font-heading text-[10px] uppercase tracking-wider font-bold transition-all ${
                tab === id ? "bg-red-500/20 text-red-400 border border-red-500/40" : "text-white/30 border border-white/8 bg-white/3"
              }`}>
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* LiveScannerEngine always runs in background when on scanner/dashboard tabs */}
      <div className={tab === "scanner" ? "px-4 pb-6" : "hidden"}>
        <LiveScannerEngine onScanUpdate={handleScanUpdate} />
      </div>

      {/* Background runner — keeps scan data & debug log fresh on other tabs */}
      {tab !== "scanner" && (
        <div className="hidden">
          <LiveScannerEngine onScanUpdate={handleScanUpdate} />
        </div>
      )}

      {/* Tab content */}
      <div className="px-4 pb-6 space-y-4">

        {/* AI DASHBOARD */}
        {tab === "dashboard" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <ScannerStatusPanel />
            <SessionNewsFilter onFilterChange={handleFilterChange} />
            <AIDashboard scanner={scanData?.scanner} />
            <TradeChecklist scanner={scanData?.scanner} />
            <LiveDebugPanel debugLog={scanData?.debugLog ?? []} />
          </motion.div>
        )}

        {/* SESSION / NEWS */}
        {tab === "session" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <SectionHeader icon={Filter} title="Session & News Filter" subtitle="Control when the robot is allowed to trade" />
            <SessionNewsFilter onFilterChange={handleFilterChange} />

            {/* Session info cards */}
            <div className="space-y-2">
              {[
                { name: "Asian",      hours: "00:00–08:00 UTC", pairs: "USDJPY, AUDUSD", activity: "Low",    color: "text-sky-400" },
                { name: "London",     hours: "08:00–12:00 UTC", pairs: "EURUSD, GBPUSD, XAUUSD", activity: "High",   color: "text-green-400" },
                { name: "London+NY",  hours: "12:00–16:00 UTC", pairs: "All pairs — peak liquidity", activity: "Peak",   color: "text-amber-400" },
                { name: "New York",   hours: "16:00–21:00 UTC", pairs: "NAS100, US30, XAUUSD", activity: "High",   color: "text-orange-400" },
              ].map((s) => (
                <div key={s.name} className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <p className={`font-heading font-bold text-sm ${s.color}`}>{s.name}</p>
                    <p className="text-[10px] text-white/30">{s.hours}</p>
                    <p className="text-[9px] text-white/20">{s.pairs}</p>
                  </div>
                  <span className={`text-[9px] font-heading font-bold px-2 py-0.5 rounded-full border ${
                    s.activity === "Peak" ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                    : s.activity === "High" ? "text-green-400 border-green-500/30 bg-green-500/10"
                    : "text-white/30 border-white/10 bg-white/5"
                  }`}>{s.activity}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* MARKET STRUCTURE */}
        {tab === "structure" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <SectionHeader icon={Activity} title="Market Structure" subtitle="Trend identification via swing analysis" />
            {[
              { label: "Uptrend",             tag: "HH / HL", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", icon: TrendingUp,    desc: "Price makes Higher Highs (HH) followed by Higher Lows (HL). Only Buy setups valid." },
              { label: "Downtrend",           tag: "LH / LL", color: "text-red-400",   bg: "bg-red-500/10 border-red-500/20",     icon: TrendingDown,  desc: "Price makes Lower Highs (LH) followed by Lower Lows (LL). Only Sell setups valid." },
              { label: "Break of Structure",  tag: "BOS",     color: "text-sky-400",   bg: "bg-sky-500/10 border-sky-500/20",     icon: Zap,           desc: "Price breaks the most recent swing high or low. Confirms trend continuation." },
              { label: "Change of Character", tag: "ChoCH",   color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: AlertTriangle, desc: "First opposite BOS after a trend. Early reversal signal — watch for new direction." },
              { label: "Fair Value Gap",      tag: "FVG",     color: "text-purple-400",bg: "bg-purple-500/10 border-purple-500/20",icon: BarChart3,    desc: "3-candle imbalance — price tends to return and fill the gap before continuing." },
            ].map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
                <GlassCard className={`border ${item.bg}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center`}>
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className={`font-heading text-sm font-bold ${item.color}`}>{item.label}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${item.bg} ${item.color} font-bold`}>{item.tag}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* PATTERNS */}
        {tab === "patterns" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <SectionHeader icon={Layers} title="Candlestick Patterns" subtitle="12 high-probability reversal setups" />
            <div>
              <p className="text-xs text-green-400 uppercase tracking-widest font-bold mb-3">▲ Bullish Patterns</p>
              <div className="space-y-2">
                {[
                  { name: "Hammer",               power: 82, desc: "Long lower wick at demand zone — buyers rejected lows." },
                  { name: "Bullish Engulfing",    power: 88, desc: "Large green candle fully engulfs prior red candle." },
                  { name: "Morning Star",         power: 85, desc: "3-candle: bearish → doji → strong bullish reversal." },
                  { name: "Three White Soldiers", power: 80, desc: "3 consecutive strong bullish closes — continuation." },
                  { name: "Tweezer Bottom",       power: 78, desc: "Two candles with identical lows — double rejection." },
                  { name: "Piercing Line",        power: 74, desc: "Bullish close above midpoint of prior bearish candle." },
                ].map((p, i) => (
                  <motion.div key={p.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <GlassCard className="flex gap-3 items-start py-3">
                      <div className="w-8 h-8 shrink-0 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-heading text-xs font-bold text-white">{p.name}</h4>
                          <span className="text-xs font-bold text-green-400">{p.power}%</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed mb-1.5">{p.desc}</p>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-green-500 rounded-full"
                            initial={{ width: 0 }} animate={{ width: `${p.power}%` }}
                            transition={{ duration: 0.9, delay: 0.1 + i * 0.05 }} />
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-red-400 uppercase tracking-widest font-bold mb-3">▼ Bearish Patterns</p>
              <div className="space-y-2">
                {[
                  { name: "Shooting Star",     power: 81, desc: "Long upper wick at supply zone — sellers rejected highs." },
                  { name: "Hanging Man",       power: 72, desc: "Hammer shape at tops — sellers starting to dominate." },
                  { name: "Bearish Engulfing", power: 88, desc: "Large red candle fully engulfs prior green candle." },
                  { name: "Evening Star",      power: 85, desc: "3-candle: bullish → doji → strong bearish reversal." },
                  { name: "Three Black Crows", power: 80, desc: "3 consecutive strong bearish closes — continuation." },
                  { name: "Dark Cloud Cover",  power: 75, desc: "Bearish close below midpoint of prior bullish candle." },
                ].map((p, i) => (
                  <motion.div key={p.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <GlassCard className="flex gap-3 items-start py-3">
                      <div className="w-8 h-8 shrink-0 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-heading text-xs font-bold text-white">{p.name}</h4>
                          <span className="text-xs font-bold text-red-400">{p.power}%</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed mb-1.5">{p.desc}</p>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-red-500 rounded-full"
                            initial={{ width: 0 }} animate={{ width: `${p.power}%` }}
                            transition={{ duration: 0.9, delay: 0.1 + i * 0.05 }} />
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* PROTECTION */}
        {tab === "protect" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <DrawdownProtection />

            {/* Score weight reference */}
            <div>
              <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading mb-2">Trade Quality Score Weights</p>
              <div className="space-y-1.5">
                {[
                  { label: "Trend Direction",   weight: 20, color: "bg-green-500" },
                  { label: "Market Structure",   weight: 15, color: "bg-sky-500" },
                  { label: "Momentum",           weight: 15, color: "bg-amber-500" },
                  { label: "Volume",             weight: 10, color: "bg-blue-500" },
                  { label: "ATR (Volatility)",   weight: 10, color: "bg-orange-500" },
                  { label: "RSI",                weight: 10, color: "bg-purple-500" },
                  { label: "Supply & Demand",    weight: 10, color: "bg-pink-500" },
                  { label: "Liquidity Sweep",    weight: 10, color: "bg-red-500" },
                ].map(({ label, weight, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-[10px] text-white/50 w-36 shrink-0 font-heading">{label}</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div className={`h-full ${color} rounded-full`}
                        initial={{ width: 0 }} animate={{ width: `${weight}%` }}
                        transition={{ duration: 0.8 }} />
                    </div>
                    <span className="text-[10px] font-heading font-bold text-white/50 w-6 text-right">{weight}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 mt-1">
                  <span className="text-[10px] font-heading font-black text-white/60">TOTAL</span>
                  <span className="text-[10px] font-heading font-black text-white">100</span>
                </div>
              </div>
            </div>

            {/* Threshold reference */}
            <div className="space-y-1.5">
              <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading mb-2">Mode Thresholds</p>
              {[
                { mode: "Conservative", threshold: 85, color: "text-sky-400" },
                { mode: "Balanced",     threshold: 70, color: "text-green-400" },
                { mode: "Aggressive",   threshold: 60, color: "text-amber-400" },
              ].map(({ mode, threshold, color }) => (
                <div key={mode} className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className={`font-heading font-bold text-xs ${color}`}>{mode}</span>
                  <span className="font-heading font-bold text-xs text-white/60">Score ≥ {threshold}/100</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* HEALTH */}
        {tab === "health" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <SectionHeader icon={Gauge} title="System Health Check" subtitle="Connection, account, scanner & risk diagnostics" />
            <SystemHealthCheck />
          </motion.div>
        )}
      </div>
    </div>
  );
}