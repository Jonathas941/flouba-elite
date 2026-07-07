import React from "react";
import { motion } from "framer-motion";
import { Bell, ChevronDown } from "lucide-react";

const BG_IMG = "https://media.base44.com/images/public/6a437ad84dc8721fedd64296/396b16096_generated_image.png";
const ROBOT_IMG = "https://media.base44.com/images/public/6a437ad84dc8721fedd64296/586a57cc0_generated_image.png";

const fmt = (val, connected) =>
  connected && val != null ? `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--";
const fmtProfit = (val, connected) => {
  if (!connected || val == null) return "--";
  const n = Number(val);
  return (n >= 0 ? "+" : "-") + `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function HolographicHero({ connected, account, openPnl, active, robotStatus, unreadCount, onNotifications, onConnectMT5 }) {
  const profitToday = connected ? (openPnl || account?.profit_today) : null;
  const statusLabel = active ? (robotStatus === "Running" ? "ONLINE" : "SCANNING") : connected ? "STANDBY" : "OFFLINE";

  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: 340 }}>
      {/* Background */}
      <img src={BG_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55 }} />
      <div className="absolute inset-0 hud-scanline" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(5,5,5,0.3) 0%, rgba(5,5,5,0.15) 35%, rgba(5,5,5,0.88) 82%, #050505 100%)" }} />

      {/* Corner metadata */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-0.5">
        <span className="text-[7px] font-mono text-[#00FF41]/40 tracking-[0.2em]">ENCRYPTION: AES-256</span>
        <span className="text-[7px] font-mono text-[#00FF41]/25 tracking-[0.2em]">SECTOR: ELITE-01</span>
      </div>
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-0.5 items-end">
        <span className="text-[7px] font-mono text-[#00FF41]/40 tracking-[0.2em]">PROTOCOL: FLOUBA</span>
        <span className="text-[7px] font-mono text-[#00FF41]/25 tracking-[0.2em]">VECTOR: QUANTUM</span>
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-11">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 hud-clip-sm text-[9px] font-mono font-bold uppercase tracking-[0.2em] ${connected ? "text-[#00FF41]" : "text-[#FF3131]"}`}
          style={{ background: "rgba(11,18,22,0.75)", border: `1px solid ${connected ? "rgba(0,255,65,0.35)" : "rgba(255,49,49,0.35)"}` }}>
          <motion.span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#00FF41]" : "bg-[#FF3131]"}`}
            animate={connected ? { scale: [1, 1.6, 1], opacity: [1, 0.4, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ boxShadow: connected ? "0 0 8px rgba(0,255,65,0.8)" : "0 0 8px rgba(255,49,49,0.8)" }} />
          {connected ? "LINKED" : "OFFLINE"}
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <button onClick={onConnectMT5} className="flex items-center gap-1 text-[9px] font-mono font-bold text-white/80 px-2.5 py-1.5 hud-clip-sm"
              style={{ background: "rgba(11,18,22,0.75)", border: "1px solid rgba(0,255,65,0.2)" }}>
              MT5 <ChevronDown className="w-3 h-3" />
            </button>
          )}
          <button onClick={onNotifications} className="relative w-8 h-8 flex items-center justify-center hud-clip-sm"
            style={{ background: "rgba(11,18,22,0.75)", border: "1px solid rgba(0,255,65,0.2)" }}>
            <Bell className="w-4 h-4 text-[#00FF41]/70" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#FF3131] text-[8px] font-bold text-white flex items-center justify-center"
                style={{ boxShadow: "0 0 6px rgba(255,49,49,0.6)" }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Scanner Ring with Robot */}
      <div className="relative z-10 flex flex-col items-center justify-center mt-5">
        <div className="relative" style={{ width: 190, height: 190 }}>
          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-full"
            style={{ border: "2px solid rgba(0,255,65,0.25)", boxShadow: "0 0 32px rgba(0,255,65,0.12), inset 0 0 30px rgba(0,255,65,0.06)" }} />

          {/* Rotating sweep */}
          <motion.div className="absolute inset-0 rounded-full"
            style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(0,255,65,0.2) 35deg, transparent 75deg)" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />

          {/* Tick marks */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200" style={{ filter: "drop-shadow(0 0 3px rgba(0,255,65,0.25))" }}>
            {Array.from({ length: 60 }).map((_, i) => {
              const angle = (i * 6) * Math.PI / 180;
              const isMajor = i % 5 === 0;
              const r1 = 96;
              const r2 = isMajor ? 87 : 91;
              return (
                <line key={i}
                  x1={100 + r1 * Math.cos(angle)} y1={100 + r1 * Math.sin(angle)}
                  x2={100 + r2 * Math.cos(angle)} y2={100 + r2 * Math.sin(angle)}
                  stroke={isMajor ? "rgba(0,255,65,0.55)" : "rgba(0,255,65,0.25)"}
                  strokeWidth={isMajor ? 1.5 : 0.8} />
              );
            })}
          </svg>

          {/* Inner glass circle with robot */}
          <div className="absolute rounded-full overflow-hidden"
            style={{ inset: 22, border: "1px solid rgba(0,255,65,0.3)", boxShadow: "inset 0 0 18px rgba(0,255,65,0.08), 0 0 18px rgba(0,255,65,0.15)" }}>
            <img src={ROBOT_IMG} alt="Flouba Elite AI" className="w-full h-full object-cover object-top" style={{ opacity: 0.9 }} />
            <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 35%, transparent 35%, rgba(0,255,65,0.06) 68%, rgba(5,5,5,0.55) 100%)" }} />
            {/* Horizontal scan line */}
            <motion.div className="absolute left-0 right-0 h-px"
              style={{ background: "linear-gradient(to right, transparent, rgba(0,255,65,0.6), transparent)", boxShadow: "0 0 8px rgba(0,255,65,0.4)" }}
              animate={{ top: ["10%", "85%", "10%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
          </div>

          {/* Status label on ring */}
          <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ top: -7 }}>
            <span className="text-[8px] font-mono font-bold text-[#00FF41] tracking-[0.3em] px-2 py-0.5"
              style={{ background: "#050505", border: "1px solid rgba(0,255,65,0.3)", textShadow: "0 0 8px rgba(0,255,65,0.6)" }}>{statusLabel}</span>
          </div>
        </div>

        {/* Floating data chips */}
        <div className="relative mt-4 flex gap-2">
          {[
            { label: "BAL", value: fmt(account?.balance, connected) },
            { label: "EQT", value: fmt(account?.equity, connected) },
            { label: "P&L", value: fmtProfit(profitToday, connected), isProfit: true },
          ].map(({ label, value, isProfit }) => {
            const isPos = isProfit && value !== "--" && value.startsWith("+");
            const isNeg = isProfit && value !== "--" && value.startsWith("-");
            return (
              <div key={label} className="px-3 py-1.5 flex flex-col items-center hud-clip-sm"
                style={{ background: "rgba(11,18,22,0.8)", border: `1px solid ${isNeg ? "rgba(255,49,49,0.3)" : "rgba(0,255,65,0.3)"}`, boxShadow: "0 0 10px rgba(0,255,65,0.06)" }}>
                <span className="text-[7px] font-mono text-[#00FF41]/50 tracking-[0.15em]">{label}</span>
                <span className={`text-[11px] font-mono font-bold ${
                  value === "--" ? "text-white/30" : isNeg ? "text-[#FF3131]" : isPos ? "text-[#00FF41]" : "text-white"
                }`} style={isPos ? { textShadow: "0 0 6px rgba(0,255,65,0.4)" } : {}}>{value}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Title */}
      <div className="relative z-10 flex flex-col items-center mt-5 pb-1">
        <h1 className="font-heading font-black text-white text-center leading-none"
          style={{ fontSize: 28, letterSpacing: "0.14em", textShadow: "0 0 22px rgba(0,255,65,0.55), 0 2px 10px rgba(0,0,0,0.8)" }}>
          FLOUBA ELITE
        </h1>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="h-px w-7" style={{ background: "linear-gradient(to right, transparent, rgba(0,255,65,0.6))" }} />
          <p className="font-mono font-bold tracking-[0.4em] text-[#00FF41]/80" style={{ fontSize: 8, textShadow: "0 0 8px rgba(0,255,65,0.4)" }}>
            AI TRADING ROBOT
          </p>
          <div className="h-px w-7" style={{ background: "linear-gradient(to left, transparent, rgba(0,255,65,0.6))" }} />
        </div>
      </div>
    </div>
  );
}