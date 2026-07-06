import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/GlassCard";
import { useToast } from "@/components/ui/use-toast";
import { mt5Api } from "@/lib/mt5Api";
import { logNotification } from "@/lib/notifications";
import { Zap, TrendingUp, TrendingDown, Clock, Target, Loader2, CheckCircle2, Send } from "lucide-react";

const SIGNALS = [
  { pair: "XAUUSD", direction: "Buy",  confidence: 87, pattern: "Bullish Engulfing",   entry: 3365.20, sl: 3355.00, tp: 3390.00, risk: "1.5R", time: "09:14", status: "Active" },
  { pair: "US30",   direction: "Buy",  confidence: 83, pattern: "Three White Soldiers", entry: 44150, sl: 43900, tp: 44600, risk: "2.0R", time: "10:02", status: "Active" },
  { pair: "GBPUSD", direction: "Buy",  confidence: 78, pattern: "Morning Star",          entry: 1.27050, sl: 1.26700, tp: 1.27900, risk: "1.8R", time: "11:30", status: "Pending" },
  { pair: "EURUSD", direction: "Sell", confidence: 62, pattern: "Shooting Star",          entry: 1.08540, sl: 1.08750, tp: 1.08100, risk: "1.2R", time: "12:45", status: "Pending" },
  { pair: "NAS100", direction: "Sell", confidence: 55, pattern: "Evening Star",           entry: 20210, sl: 20400, tp: 19900, risk: "1.0R", time: "13:18", status: "Expired" },
];

export default function AISignals() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef(0);
  const FILTERS = ["All", "Active", "Pending", "Expired"];
  const filtered = filter === "All" ? SIGNALS : SIGNALS.filter((s) => s.status === filter);

  const [connected, setConnected] = useState(false);
  const [lotSize, setLotSize] = useState(0.01);
  const [placing, setPlacing] = useState(null);
  const [placed, setPlaced] = useState(new Set());

  useEffect(() => {
    mt5Api.account().then((res) => {
      setConnected(res?.ok && res?.data?.account?.connected === true);
    }).catch(() => setConnected(false));
  }, []);

  const placeTrade = useCallback(async (signal, index) => {
    if (!connected) { navigate("/connect-mt5"); return; }
    setPlacing(index);
    try {
      const isBuy = signal.direction === "Buy";
      const res = isBuy
        ? await mt5Api.buy(signal.pair, lotSize, signal.sl, signal.tp)
        : await mt5Api.sell(signal.pair, lotSize, signal.sl, signal.tp);
      if (res?.ok && res?.data?.success !== false) {
        setPlaced((prev) => new Set(prev).add(index));
        toast({ title: "Trade Placed", description: `${signal.direction} ${signal.pair} · ${lotSize} lot | SL ${signal.sl} · TP ${signal.tp}`, duration: 4000 });
        logNotification({ type: "trade", title: "AI Signal Trade Placed", message: `${signal.direction} ${signal.pair} — Lot ${lotSize}, SL ${signal.sl}, TP ${signal.tp} (${signal.pattern})`, category: "success", meta: { pair: signal.pair, direction: signal.direction, lot: lotSize, sl: signal.sl, tp: signal.tp } });
      } else {
        toast({ title: "Order Failed", description: res?.error || res?.data?.message || res?.data?.detail || "MT5 rejected the order.", variant: "destructive", duration: 4000 });
      }
    } catch {
      toast({ title: "Order Failed", description: "Could not reach MT5 bridge.", variant: "destructive", duration: 3000 });
    }
    setPlacing(null);
  }, [connected, lotSize, navigate, toast]);

  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e) => {
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0 && window.scrollY === 0) setPullY(Math.min(dy * 0.4, 60));
  };
  const handleTouchEnd = async () => {
    if (pullY > 45) {
      setRefreshing(true);
      await new Promise((r) => setTimeout(r, 800));
      setRefreshing(false);
    }
    setPullY(0);
  };

  return (
    <div className="px-4 pt-8 space-y-4"
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {/* Pull to refresh indicator */}
      {pullY > 0 && (
        <div className="flex justify-center" style={{ marginTop: pullY - 20, opacity: pullY / 60 }}>
          <div className={`w-6 h-6 border-2 border-red-500/40 border-t-red-500 rounded-full ${refreshing ? "animate-spin" : ""}`} />
        </div>
      )}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-black text-white neon-text flex items-center gap-2">
            <Zap className="w-5 h-5 text-red-500" /> AI Signals
          </h1>
          <p className="text-sm text-muted-foreground">Real-time AI-generated trade setups.</p>
        </div>
        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
      </header>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold tracking-wide transition-all ${filter === f ? "bg-red-600 text-white neon-red" : "glass text-muted-foreground"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Lot size selector + MT5 connection status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-heading tracking-widest text-white/50">LOT</span>
          <div className="flex gap-1.5">
            {[0.01, 0.02, 0.05, 0.1].map((l) => (
              <button key={l} onClick={() => setLotSize(l)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-heading font-bold transition-all ${lotSize === l ? "bg-[#00FF41] text-[#050505]" : "glass text-white/60"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-heading tracking-widest ${connected ? "text-[#00FF41]" : "text-[#FF3131]"}`}
          style={{ background: connected ? "rgba(0,255,65,0.08)" : "rgba(255,49,49,0.08)", border: `1px solid ${connected ? "rgba(0,255,65,0.3)" : "rgba(255,49,49,0.3)"}` }}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00FF41]" : "bg-[#FF3131]"}`} />
          {connected ? "MT5 LIVE" : "OFFLINE"}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((s, i) => {
          const buy = s.direction === "Buy";
          const statusColor = s.status === "Active" ? "bg-green-500/15 text-green-400" : s.status === "Pending" ? "bg-amber-500/15 text-amber-400" : "bg-white/5 text-muted-foreground";
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <GlassCard>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${buy ? "bg-green-500/15" : "bg-red-500/15"}`}>
                      {buy ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
                    </div>
                    <div>
                      <p className="font-heading font-bold text-white">{s.pair}</p>
                      <p className={`text-xs font-semibold ${buy ? "text-green-400" : "text-red-400"}`}>{s.direction}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${statusColor}`}>{s.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[["Entry", s.entry], ["Stop Loss", s.sl], ["Take Profit", s.tp]].map(([l, v]) => (
                    <div key={l}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{l}</p>
                      <p className="text-sm font-semibold text-white">{typeof v === "number" && v > 100 ? v.toFixed(2) : v?.toFixed?.(5) ?? v}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">{s.pattern}</p>
                    <span className="text-xs text-red-400 font-semibold">{s.risk}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{s.time}</div>
                    <div className="flex items-center gap-1 text-xs">
                      <Target className="w-3 h-3 text-red-500" />
                      <span className="font-bold text-red-400">{s.confidence}%</span>
                    </div>
                  </div>
                </div>
                {s.status !== "Expired" && (
                  <button
                    onClick={() => placeTrade(s, i)}
                    disabled={placing === i || placed.has(i)}
                    className="w-full mt-3 h-10 rounded-xl font-heading font-bold tracking-widest text-[10px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    style={placed.has(i)
                      ? { background: "rgba(0,255,65,0.12)", border: "1px solid rgba(0,255,65,0.4)", color: "#00FF41" }
                      : { background: "linear-gradient(90deg, #00FF41, #00CC33)", color: "#050505", boxShadow: "0 0 16px rgba(0,255,65,0.35)" }}
                  >
                    {placing === i ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> SENDING ORDER…</>
                      : placed.has(i) ? <><CheckCircle2 className="w-3.5 h-3.5" /> TRADE PLACED</>
                      : <><Send className="w-3.5 h-3.5" /> PLACE {s.direction.toUpperCase()} · {lotSize} LOT</>}
                  </button>
                )}
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}