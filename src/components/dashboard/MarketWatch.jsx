import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

const BASE = {
  XAUUSD: { price: 3368.45, tick: 0.35, spread: "0.30", bullish: true,  ai: 87 },
  EURUSD: { price: 1.08423, tick: 0.00008, spread: "0.1", bullish: false, ai: 62 },
  GBPUSD: { price: 1.27314, tick: 0.00012, spread: "0.2", bullish: true,  ai: 78 },
  USDJPY: { price: 149.821, tick: 0.012, spread: "0.01", bullish: true,  ai: 71 },
  NAS100: { price: 20145.25, tick: 4.5, spread: "0.5",  bullish: false, ai: 55 },
  US30:   { price: 44280.5,  tick: 3.8, spread: "1.0",  bullish: true,  ai: 83 },
};

const fmt = (pair, p) => {
  if (pair === "XAUUSD") return p.toFixed(2);
  if (pair === "USDJPY") return p.toFixed(3);
  if (pair === "NAS100" || pair === "US30") return p.toFixed(2);
  return p.toFixed(5);
};

export default function MarketWatch() {
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, { ...v }]))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setPrices((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([k, v]) => {
            const delta = (Math.random() - 0.5) * v.tick * 2;
            return [k, { ...v, price: v.price + delta, bullish: delta >= 0 ? true : false }];
          })
        )
      );
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h3 className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Market Watch · Live</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
        {Object.entries(prices).map(([pair, data]) => (
          <motion.div
            key={pair}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="snap-start shrink-0 w-36 glass rounded-2xl p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-heading text-xs font-bold text-white tracking-wide">{pair}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${data.bullish ? "bg-green-400" : "bg-red-400"}`} />
            </div>

            <p className="font-heading text-sm font-black text-white">{fmt(pair, data.price)}</p>

            <div className={`flex items-center gap-1 text-xs font-semibold ${data.bullish ? "text-green-400" : "text-red-400"}`}>
              {data.bullish ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {data.bullish ? "Bullish" : "Bearish"}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">AI</span>
                <span className="text-[9px] font-bold text-red-400">{data.ai}%</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${data.ai}%` }} />
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">Spread: {data.spread}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}