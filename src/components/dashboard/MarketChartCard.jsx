import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, WifiOff, TrendingUp, TrendingDown, Activity } from "lucide-react";

const PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "AUDJPY", "EURJPY", "AUDUSD", "NZDUSD", "NAS100", "US30", "BTCUSD"];
const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4"];

export default function MarketChartCard({ connected, account, activePair, setActivePair, positions }) {
  const [tf, setTf] = useState("H1");
  const [pairOpen, setPairOpen] = useState(false);

  const currentPrice =
    connected && positions?.length > 0
      ? positions[0].current_price ?? positions[0].price
      : null;

  const pnl = connected && positions?.length > 0
    ? positions.reduce((s, p) => s + (p.profit ?? p.unrealized_pnl ?? 0), 0)
    : null;

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
                {currentPrice != null ? Number(currentPrice).toFixed(Number(currentPrice) > 100 ? 2 : 5) : "--"}
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
        {connected ? (
          <EmptyChart connected={true} />
        ) : (
          <EmptyChart connected={false} />
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

function EmptyChart({ connected }) {
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
      <Activity className="w-6 h-6 text-cyan-300/50" />
      <p className="text-[11px] text-white/55 font-heading tracking-wider">
        Live feed active · awaiting candle data
      </p>
      <div className="mt-1 flex gap-1">
        {[0,1,2,3,4].map((i) => (
          <span key={i} className="w-1 h-1 rounded-full bg-cyan-400/60 animate-pulse" style={{ animationDelay: `${i*0.15}s` }} />
        ))}
      </div>
    </div>
  );
}