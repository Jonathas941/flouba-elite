import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown, WifiOff, TrendingUp, TrendingDown, LineChart,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, YAxis, Tooltip, ReferenceLine,
} from "recharts";
import { mt5Api } from "@/lib/mt5Api";

const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "AUDJPY", "EURJPY", "AUDUSD", "NZDUSD", "NAS100", "US30", "BTCUSD"];
const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4"];
const MAX_POINTS = 60;

function digitsFor(pair) {
  if (pair === "XAUUSD") return 2;
  if (["USDJPY", "AUDJPY", "EURJPY"].includes(pair)) return 3;
  if (["NAS100", "US30", "BTCUSD"].includes(pair)) return 2;
  return 5;
}

export default function MarketChartCard({ connected, account, activePair, setActivePair, positions }) {
  const [tf, setTf] = useState("H1");
  const [pairOpen, setPairOpen] = useState(false);
  const [series, setSeries] = useState([]); // [{ t, price }]
  const [lastQuote, setLastQuote] = useState(null);
  const [marketClosed, setMarketClosed] = useState(false);
  const tickRef = useRef(0);

  // Poll the live MT5 symbol feed while connected and build a rolling price series.
  useEffect(() => {
    if (!connected) { setSeries([]); setLastQuote(null); setMarketClosed(false); return; }
    let alive = true;
    const pull = async () => {
      try {
        const res = await mt5Api.quotes();
        if (!alive) return;
        const ok = res?.ok && res?.data?.success === true;
        const symbols = res?.data?.symbols || [];
        const sym = symbols.find((s) => (s.symbol || "").toUpperCase() === activePair);
        const bid = sym?.bid;
        if (ok && bid != null && Number(bid) > 0) {
          setMarketClosed(false);
          setLastQuote({ bid: Number(sym.bid), ask: Number(sym.ask), spread: sym.spread });
          setSeries((prev) => {
            const next = [...prev, { t: tickRef.current++, price: Number(bid) }];
            return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
          });
        } else if (ok) {
          // Bridge responded but this symbol has no live tick — market is closed.
          setMarketClosed(true);
        }
      } catch { /* ignore transient quote errors */ }
    };
    pull();
    const id = setInterval(pull, 3000);
    return () => { alive = false; clearInterval(id); };
  }, [connected, activePair]);

  // Reset the rolling series when the pair changes.
  useEffect(() => { setSeries([]); setLastQuote(null); tickRef.current = 0; }, [activePair]);

  const posPrice = connected && positions?.length > 0
    ? positions[0].current_price ?? positions[0].price
    : null;
  const currentPrice = lastQuote?.bid ?? posPrice;
  const pnl = connected && positions?.length > 0
    ? positions.reduce((s, p) => s + (p.profit ?? p.unrealized_pnl ?? 0), 0)
    : null;

  const decimals = currentPrice != null ? digitsFor(activePair) : 2;
  const first = series[0]?.price;
  const last = series[series.length - 1]?.price;
  const up = first != null && last != null && last >= first;
  const lineColor = !connected ? "#5fe8ff" : up ? "#00ff9d" : "#ff4d4d";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl overflow-hidden"
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <button
              onClick={() => setPairOpen((v) => !v)}
              className="flex items-center gap-1.5 font-heading font-bold text-sm text-white tracking-wider"
            >
              {activePair}
              <ChevronDown className="w-3.5 h-3.5 text-cyan-300" />
            </button>
            {pairOpen && (
              <div className="absolute z-20 mt-2 w-40 max-h-52 overflow-auto glass rounded-xl py-1.5">
                {PAIRS.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setActivePair(p); setPairOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-heading tracking-wider hover:bg-cyan-500/10 ${p === activePair ? "text-cyan-300" : "text-white/70"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          {connected ? (
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-lg text-white tabular-nums">
                {currentPrice != null ? Number(currentPrice).toFixed(decimals) : "--"}
              </span>
              {pnl != null && (
                <span className={`flex items-center gap-0.5 text-[11px] font-bold ${pnl >= 0 ? "text-[#00ff9d]" : "text-[#ff4d4d]"}`}>
                  {pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] uppercase tracking-widest text-white/35 font-heading">No live data</span>
          )}
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`px-1.5 py-1 rounded-md text-[10px] font-heading font-bold tracking-wider transition-colors ${
                tf === t ? "bg-cyan-500/25 text-cyan-300" : "text-white/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Chart body */}
      <div className="relative h-52 mx-3 mb-3 rounded-2xl overflow-hidden grid-lines" style={{ background: "rgba(2,8,20,0.6)" }}>
        {connected && series.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 6, left: 6, bottom: 4 }}>
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis
                domain={["dataMin", "dataMax"]} hide
                scale="linear" padding={{ top: 6, bottom: 6 }}
              />
              <Tooltip
                contentStyle={{ background: "rgba(8,16,32,0.92)", border: "1px solid rgba(0,229,255,0.25)", borderRadius: 10, fontSize: 10, padding: "4px 8px" }}
                labelStyle={{ display: "none" }}
                formatter={(v) => [Number(v).toFixed(decimals), activePair]}
                itemStyle={{ color: "#fff", fontFamily: "Orbitron, sans-serif", fontWeight: 700 }}
              />
              {first != null && <ReferenceLine y={first} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />}
              <Area
                type="monotone" dataKey="price" stroke={lineColor} strokeWidth={2}
                fill="url(#priceFill)" isAnimationActive={false} dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart connected={connected} marketClosed={marketClosed} hasQuote={lastQuote != null} />
        )}
      </div>

      {/* Indicator chips */}
      <div className="flex items-center gap-1.5 px-4 pb-3.5 flex-wrap">
        {["EMA 200", "Bollinger", "Volume", "RSI", "MACD"].map((ind) => (
          <span key={ind} className="px-2 py-0.5 rounded-full text-[9px] font-heading tracking-wider bg-white/5 text-cyan-200/70 border border-cyan-500/20">
            {ind}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

function EmptyChart({ connected, marketClosed, hasQuote }) {
  if (!connected) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <WifiOff className="w-7 h-7 text-white/25" />
        <p className="text-[11px] text-white/45 font-heading tracking-wider text-center px-6">
          Connect MT5 to view live chart
        </p>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
      <LineChart className="w-6 h-6 text-cyan-300/50" />
      <p className="text-[11px] text-white/55 font-heading tracking-wider text-center px-6">
        {marketClosed
          ? "Market closed — live feed idle"
          : hasQuote
            ? "Building live chart from MT5 feed…"
            : "Live feed active · awaiting live ticks"}
      </p>
      <div className="mt-1 flex gap-1">
        {[0,1,2,3,4].map((i) => (
          <span key={i} className="w-1 h-1 rounded-full bg-cyan-400/60 animate-pulse" style={{ animationDelay: `${i*0.15}s` }} />
        ))}
      </div>
    </div>
  );
}