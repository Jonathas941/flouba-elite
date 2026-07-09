import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { mt5Api } from "@/lib/mt5Api";
import HudPanel from "@/components/dashboard/hud/HudPanel";

const fmt = (v) => {
  if (v == null || isNaN(v)) return "--";
  const n = Number(v);
  if (n >= 1000) return n.toFixed(2);
  if (n >= 10) return n.toFixed(3);
  return n.toFixed(5);
};

export default function EmaIndicatorPanel() {
  const [ind, setInd] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await mt5Api.scannerStatus();
        if (cancelled) return;
        if (res?.ok && res?.data) {
          const s = res.data?.scanner ?? res.data;
          const indicators = s?.indicators || s || null;
          setInd(indicators);
          setConnected(indicators?.bid != null || indicators?.ema_20 != null);
        } else {
          setConnected(false);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const ema20 = ind?.ema_20 ?? ind?.ema20 ?? null;
  const ema200 = ind?.ema_200 ?? ind?.ema200 ?? null;
  const price = ind?.bid ?? ind?.price ?? null;

  let trend = "neutral";
  let trendLabel = "NEUTRAL";
  let TrendIcon = Minus;
  let accent = "#FFCC42";
  if (ema20 != null && ema200 != null) {
    if (ema20 > ema200) { trend = "bull"; trendLabel = "BULLISH"; TrendIcon = TrendingUp; accent = "#00FF41"; }
    else if (ema20 < ema200) { trend = "bear"; trendLabel = "BEARISH"; TrendIcon = TrendingDown; accent = "#FF3131"; }
  }

  const spread20_200 = ema20 != null && ema200 != null ? Math.abs(ema20 - ema200) : null;

  return (
    <HudPanel label="EMA Trend Engine" accent={accent}>
      <div className="space-y-2.5">
        {/* Trend header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              className="w-8 h-8 hud-clip-sm flex items-center justify-center"
              style={{ background: `${accent}15`, border: `1px solid ${accent}40` }}
              animate={trend !== "neutral" ? { opacity: [1, 0.6, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <TrendIcon className="w-4 h-4" style={{ color: accent }} />
            </motion.div>
            <div>
              <p className="font-mono font-bold text-sm tracking-[0.15em]" style={{ color: accent, textShadow: `0 0 8px ${accent}50` }}>
                {connected ? trendLabel : "NO DATA"}
              </p>
              <p className="text-[9px] font-mono text-white/30">EMA 20 vs EMA 200</p>
            </div>
          </div>
          {spread20_200 != null && (
            <div className="text-right">
              <p className="text-[8px] font-mono uppercase tracking-[0.15em] text-white/30">SEPARATION</p>
              <p className="font-mono font-bold text-xs text-white/70">{fmt(spread20_200)}</p>
            </div>
          )}
        </div>

        {/* EMA values grid */}
        <div className="grid grid-cols-3 divide-x divide-[#00FF41]/10">
          <div className="py-1 px-2 flex flex-col gap-0.5 items-center text-center">
            <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-[#00FF41]/40">EMA 20</span>
            <span className="font-mono font-bold text-sm text-white" style={connected && ema20 != null ? { textShadow: "0 0 6px rgba(0,255,65,0.3)" } : {}}>
              {connected ? fmt(ema20) : "--"}
            </span>
          </div>
          <div className="py-1 px-2 flex flex-col gap-0.5 items-center text-center">
            <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-[#FFCC42]/40">EMA 200</span>
            <span className="font-mono font-bold text-sm text-white" style={connected && ema200 != null ? { textShadow: "0 0 6px rgba(255,204,66,0.3)" } : {}}>
              {connected ? fmt(ema200) : "--"}
            </span>
          </div>
          <div className="py-1 px-2 flex flex-col gap-0.5 items-center text-center">
            <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-white/30">PRICE</span>
            <span className={`font-mono font-bold text-sm ${connected ? "text-white" : "text-white/25"}`}>
              {connected ? fmt(price) : "--"}
            </span>
          </div>
        </div>

        {/* Position relative to EMAs */}
        {connected && price != null && ema20 != null && ema200 != null && (
          <div className="flex items-center gap-1.5 text-[9px] font-mono">
            <span className="text-white/30">Price</span>
            <span className={price > ema20 ? "text-[#00FF41]" : "text-[#FF3131]"}>{price > ema20 ? "▲" : "▼"}</span>
            <span className="text-white/25">EMA20</span>
            <span className={ema20 > ema200 ? "text-[#00FF41]" : "text-[#FF3131]"}>{ema20 > ema200 ? "▲" : "▼"}</span>
            <span className="text-white/25">EMA200</span>
          </div>
        )}
      </div>
    </HudPanel>
  );
}