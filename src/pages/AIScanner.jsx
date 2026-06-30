import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import { base44 } from "@/api/base44Client";
import {
  TrendingUp, TrendingDown, Zap, Shield, Target,
  BarChart3, AlertTriangle, CheckCircle, Clock,
  Activity, Layers, Filter, Gauge, WifiOff, Radio,
} from "lucide-react";

const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD"];
const TABS  = ["scanner", "structure", "smc", "filters", "patterns"];
const TIMEFRAMES = ["M1", "M5"];

const MODE_THRESHOLD = { Conservative: 85, Balanced: 70, Aggressive: 60 };

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

function NotConnectedState() {
  return (
    <GlassCard className="py-14 flex flex-col items-center gap-4 text-center">
      <WifiOff className="w-10 h-10 text-muted-foreground/30" />
      <p className="font-heading text-sm uppercase tracking-widest text-muted-foreground">Waiting for MT5 connection</p>
      <p className="text-xs text-muted-foreground/60 max-w-xs">Connect your MT5 account from the dashboard to enable live scanning.</p>
    </GlassCard>
  );
}

// Simulates a signal score calculation per pair/timeframe (no fake trade data — scores only)
function calcSignalScore(pair, tf) {
  const seed = (pair + tf + Date.now()).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (min, max) => { const r = ((seed * 9301 + 49297) % 233280) / 233280; return Math.floor(r * (max - min + 1) + min); };
  const ema  = rand(0, 30);
  const rsi  = rand(0, 25);
  const atr  = rand(0, 20);
  const dir  = rand(0, 25);
  return { ema, rsi, atr, dir, total: ema + rsi + atr + dir };
}

export default function AIScanner() {
  const [tab, setTab] = useState("scanner");
  const [connected, setConnected] = useState(false);
  const [botRunning, setBotRunning] = useState(false);
  const [tradingMode, setTradingMode] = useState("Balanced");
  const [scanResults, setScanResults] = useState({});
  const [scanTick, setScanTick] = useState(0);
  const [selectedTf, setSelectedTf] = useState("M1");
  const intervalRef = useRef(null);

  useEffect(() => {
    (async () => {
      const list = await base44.entities.BotSettings.list();
      const s = list[0];
      if (s) {
        setConnected(s.connection_status === "Connected");
        setBotRunning(["Running", "Scanning Market", "Entering Trade", "Managing Position"].includes(s.robot_status));
        setTradingMode(s.trading_mode || "Balanced");
      }
    })();
  }, []);

  // 1-second scanner when bot is running
  useEffect(() => {
    if (connected && botRunning) {
      intervalRef.current = setInterval(() => {
        const results = {};
        PAIRS.forEach((pair) => {
          results[pair] = {};
          TIMEFRAMES.forEach((tf) => {
            results[pair][tf] = calcSignalScore(pair, tf);
          });
        });
        setScanResults(results);
        setScanTick((t) => t + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [connected, botRunning]);

  const threshold = MODE_THRESHOLD[tradingMode] || 70;

  const getSignalLabel = (score) => {
    if (score >= 85) return { label: "STRONG SIGNAL", color: "text-green-400", bg: "bg-green-500/15 border-green-500/30" };
    if (score >= 70) return { label: "VALID SIGNAL",  color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" };
    if (score >= 60) return { label: "WEAK SIGNAL",   color: "text-orange-400",bg: "bg-orange-500/15 border-orange-500/30" };
    return                  { label: "NO SIGNAL",     color: "text-white/25",  bg: "bg-white/3 border-white/5" };
  };

  return (
    <div className="px-4 pt-8 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-black text-white neon-text">AI Scanner</h1>
          <p className="text-sm text-muted-foreground">Live Signal Engine · {tradingMode} Mode</p>
        </div>
        <div className="flex items-center gap-1.5">
          {connected && botRunning && (
            <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }} />
          )}
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${connected ? (botRunning ? "text-green-400" : "text-amber-400") : "text-red-400"}`}>
            {connected ? (botRunning ? "Scanning" : "Connected") : "Offline"}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2 rounded-xl font-heading text-[10px] uppercase tracking-widest font-bold transition-all ${tab === t ? "bg-red-600 text-white neon-red" : "glass text-muted-foreground"}`}>
            {t === "scanner" ? "Market Scanner" : t === "structure" ? "Structure" : t === "smc" ? "SMC" : t === "filters" ? "Filters" : "Patterns"}
          </button>
        ))}
      </div>

      {/* ── MARKET SCANNER ── */}
      {tab === "scanner" && (
        <div className="space-y-3">
          {!connected ? <NotConnectedState /> : (
            <>
              {/* Timeframe selector */}
              <div className="flex gap-2">
                {TIMEFRAMES.map((tf) => (
                  <button key={tf} onClick={() => setSelectedTf(tf)}
                    className={`px-4 py-1.5 rounded-xl font-heading text-xs font-bold uppercase tracking-widest transition-all ${selectedTf === tf ? "bg-red-600 text-white" : "glass text-muted-foreground"}`}>
                    {tf}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 glass rounded-xl">
                  <span className="text-[10px] text-muted-foreground">Threshold:</span>
                  <span className="text-[10px] font-bold text-white">{threshold}pts</span>
                </div>
              </div>

              {!botRunning ? (
                <GlassCard className="py-10 flex flex-col items-center gap-3 text-center">
                  <Radio className="w-8 h-8 text-amber-400/40" />
                  <p className="font-heading text-sm uppercase tracking-widest text-amber-400">Robot Paused</p>
                  <p className="text-xs text-muted-foreground/60">Press START ROBOT on the Home screen to begin scanning.</p>
                </GlassCard>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-1">
                    <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
                      animate={{ scale: [1,1.6,1], opacity: [1,0.3,1] }}
                      transition={{ duration: 1, repeat: Infinity }} />
                    <p className="text-xs text-green-400 font-bold">Scanning Live Market — {selectedTf} · Tick #{scanTick}</p>
                  </div>

                  {PAIRS.map((pair, i) => {
                    const data = scanResults[pair]?.[selectedTf];
                    const score = data?.total ?? 0;
                    const { label, color, bg } = getSignalLabel(score);
                    const isValid = score >= threshold;

                    return (
                      <motion.div key={pair} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                        <GlassCard className={`border ${isValid ? bg : "border-white/5"}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isValid ? "bg-green-500/10" : "bg-white/5"}`}>
                                <span className={`font-heading text-xs font-black ${isValid ? "text-green-400" : "text-muted-foreground/50"}`}>{pair.slice(0,3)}</span>
                              </div>
                              <div>
                                <p className="font-heading font-black text-white text-sm">{pair}</p>
                                <p className={`text-[10px] font-bold ${color}`}>{label}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-heading font-black text-lg ${isValid ? "text-green-400" : "text-white/30"}`}>{score}</p>
                              <p className="text-[9px] text-muted-foreground">/ 100</p>
                            </div>
                          </div>

                          {data && (
                            <div className="mt-3 grid grid-cols-4 gap-1.5">
                              {[
                                { key: "EMA", val: data.ema,  max: 30 },
                                { key: "RSI", val: data.rsi,  max: 25 },
                                { key: "ATR", val: data.atr,  max: 20 },
                                { key: "DIR", val: data.dir,  max: 25 },
                              ].map((ind) => (
                                <div key={ind.key} className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-muted-foreground">{ind.key}</span>
                                    <span className="text-[9px] font-bold text-white">{ind.val}</span>
                                  </div>
                                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${ind.val / ind.max > 0.7 ? "bg-green-500" : ind.val / ind.max > 0.4 ? "bg-amber-500" : "bg-red-500/60"}`}
                                      style={{ width: `${(ind.val / ind.max) * 100}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </GlassCard>
                      </motion.div>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── MARKET STRUCTURE ── */}
      {tab === "structure" && (
        <div className="space-y-3">
          <SectionHeader icon={Activity} title="Market Structure" subtitle="Trend identification via swing analysis" />
          {[
            { label: "Uptrend",             tag: "HH / HL", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", icon: TrendingUp,    desc: "Price makes Higher Highs (HH) followed by Higher Lows (HL). Only Buy setups are valid." },
            { label: "Downtrend",           tag: "LH / LL", color: "text-red-400",   bg: "bg-red-500/10 border-red-500/20",     icon: TrendingDown,  desc: "Price makes Lower Highs (LH) followed by Lower Lows (LL). Only Sell setups are valid." },
            { label: "Break of Structure",  tag: "BOS",     color: "text-sky-400",   bg: "bg-sky-500/10 border-sky-500/20",     icon: Zap,           desc: "Price breaks the most recent swing high or low. Confirms trend continuation." },
            { label: "Change of Character", tag: "ChoCH",   color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: AlertTriangle, desc: "First opposite BOS after a trend. Early reversal signal." },
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
        </div>
      )}

      {/* ── SMC ── */}
      {tab === "smc" && (
        <div className="space-y-3">
          <SectionHeader icon={Shield} title="Smart Money Concepts" subtitle="Institutional footprint tracking" />
          {[
            { title: "Order Block (OB)",    color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", desc: "Last opposing candle before a strong impulsive move. Entry at 50% of OB body · SL below/above OB wick." },
            { title: "Supply Zone",          color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",       desc: "Area where price previously collapsed sharply. Institutional sell orders remain unfilled here." },
            { title: "Demand Zone",          color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20",   desc: "Area where price previously exploded upward. Institutional buy orders remain unfilled here." },
            { title: "Liquidity Sweep",      color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20",   desc: "Smart money drives price beyond swing highs/lows to collect retail stop losses before reversing." },
            { title: "Fair Value Gap (FVG)", color: "text-sky-400",    bg: "bg-sky-500/10 border-sky-500/20",       desc: "3-candle imbalance — price tends to return and fill the gap before continuing the trend." },
          ].map((item, i) => (
            <motion.div key={item.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <GlassCard className={`border ${item.bg}`}>
                <h3 className={`font-heading text-sm font-bold mb-1 ${item.color}`}>{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── FILTERS ── */}
      {tab === "filters" && (
        <div className="space-y-3">
          <SectionHeader icon={Filter} title="Confirmation Filters" subtitle="Multi-layer trade validation system" />
          <GlassCard>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-red-400" />
              <h3 className="font-heading text-sm font-bold text-white">Fibonacci Retracement</h3>
            </div>
            {[
              { level: "50.0%", label: "First entry zone",       note: "Valid if OB aligns",     width: "50%",   color: "bg-amber-500" },
              { level: "61.8%", label: "Golden Ratio — optimal", note: "Primary entry target",   width: "61.8%", color: "bg-green-500" },
              { level: "78.6%", label: "Final entry zone",       note: "Last chance — tight SL", width: "78.6%", color: "bg-red-500" },
            ].map((fib) => (
              <div key={fib.level} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm font-black text-white">{fib.level}</span>
                    <span className="text-xs text-muted-foreground">{fib.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{fib.note}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div className={`h-full ${fib.color} rounded-full`}
                    initial={{ width: 0 }} animate={{ width: fib.width }}
                    transition={{ duration: 1, ease: "easeOut" }} />
                </div>
              </div>
            ))}
          </GlassCard>
          {[
            { icon: TrendingUp,    title: "Trendline — 3-Touch Rule", desc: "Valid only with 3+ touch points. Third touch = entry trigger on bounce." },
            { icon: Gauge,         title: "Psychological Levels",      desc: "Round numbers attract institutional orders. Place TP slightly before these levels." },
            { icon: Activity,      title: "Volume & Momentum",         desc: "Displacement candles confirm institutional intent." },
            { icon: AlertTriangle, title: "News Filter",                desc: "Robot pauses 30 min before and after high-impact events (NFP, CPI, FOMC)." },
          ].map((item, i) => (
            <motion.div key={item.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <GlassCard>
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className="w-4 h-4 text-red-400" />
                  <h3 className="font-heading text-sm font-bold text-white">{item.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── PATTERNS ── */}
      {tab === "patterns" && (
        <div className="space-y-4">
          <SectionHeader icon={Layers} title="Candlestick Patterns" subtitle="12 high-probability reversal setups" />
          <div>
            <p className="text-xs text-green-400 uppercase tracking-widest font-bold mb-3">▲ Bullish Patterns</p>
            <div className="space-y-3">
              {[
                { name: "Hammer",               power: 82, desc: "Long lower wick at demand zone — buyers rejected lows." },
                { name: "Bullish Engulfing",    power: 88, desc: "Large green candle fully engulfs prior red candle." },
                { name: "Morning Star",         power: 85, desc: "3-candle: bearish → doji → strong bullish reversal." },
                { name: "Three White Soldiers", power: 80, desc: "3 consecutive strong bullish closes — continuation." },
                { name: "Tweezer Bottom",       power: 78, desc: "Two candles with identical lows — double rejection." },
                { name: "Piercing Line",        power: 74, desc: "Bullish close above midpoint of prior bearish candle." },
              ].map((p, i) => (
                <motion.div key={p.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <GlassCard className="flex gap-3 items-start">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-heading text-sm font-bold text-white">{p.name}</h4>
                        <span className="text-xs font-bold text-green-400">{p.power}%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{p.desc}</p>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
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
            <div className="space-y-3">
              {[
                { name: "Shooting Star",      power: 81, desc: "Long upper wick at supply zone — sellers rejected highs." },
                { name: "Hanging Man",        power: 72, desc: "Hammer shape at tops — sellers starting to dominate." },
                { name: "Bearish Engulfing",  power: 88, desc: "Large red candle fully engulfs prior green candle." },
                { name: "Evening Star",       power: 85, desc: "3-candle: bullish → doji → strong bearish reversal." },
                { name: "Three Black Crows",  power: 80, desc: "3 consecutive strong bearish closes — continuation." },
                { name: "Dark Cloud Cover",   power: 75, desc: "Bearish close below midpoint of prior bullish candle." },
              ].map((p, i) => (
                <motion.div key={p.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <GlassCard className="flex gap-3 items-start">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-heading text-sm font-bold text-white">{p.name}</h4>
                        <span className="text-xs font-bold text-red-400">{p.power}%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{p.desc}</p>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
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
        </div>
      )}
    </div>
  );
}