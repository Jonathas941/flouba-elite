import React from "react";
import { motion } from "framer-motion";
import { Radar, Shield, Cloud, Brain, Gauge, Bot } from "lucide-react";

const fmt = (val, dec = 2) =>
  val != null ? `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}` : "--";

export default function SmartControlGrid({ connected, robotStatus, account, positions, winRate, navigate }) {
  const scanning = ["Scanning Market", "Running", "Signal Found", "Entering Trade"].includes(robotStatus);
  const openPnl = positions?.length > 0 ? positions.reduce((s, p) => s + (p.profit ?? p.unrealized_pnl ?? 0), 0) : null;
  const riskPct = connected && account?.balance ? (account.margin / account.balance * 100) : null;

  const cards = [
    {
      icon: Radar,
      title: "AI Scanner",
      desc: "Real-Time Market Scanning & Alerts",
      value: connected ? (scanning ? "Active" : "Idle") : "Offline",
      tone: connected && scanning ? "cyan" : "muted",
      onClick: () => navigate("/ai-scanner"),
    },
    {
      icon: Shield,
      title: "Risk Management",
      desc: "Account risk & daily protection",
      value: connected ? (riskPct != null ? `${riskPct.toFixed(1)}%` : "Protected") : "No data",
      sub: openPnl != null ? `Daily P&L: ${openPnl >= 0 ? "+" : ""}$${openPnl.toFixed(0)}` : "Daily P&L: --",
      tone: "gold",
    },
    {
      icon: Cloud,
      title: "MT5 Connect",
      desc: connected ? `${account?.server || "Connected"}` : "Not connected",
      value: connected ? "CONNECTED" : "DISCONNECTED",
      tone: connected ? "green" : "red",
      onClick: () => navigate(connected ? "/account" : "/connect-mt5"),
    },
    {
      icon: Brain,
      title: "AI Signals",
      desc: "High-probability AI trade signals",
      value: connected ? "View Signals" : "No data",
      tone: "cyan",
      onClick: () => navigate("/ai-signals"),
    },
    {
      icon: Gauge,
      title: "Strategy Performance",
      desc: "Live backtest performance",
      ring: winRate != null && winRate > 0 ? winRate : null,
      tone: "gold",
    },
    {
      icon: Bot,
      title: "Bot Control",
      desc: connected ? `${positions?.length || 0} active position${positions?.length === 1 ? "" : "s"}` : "No account",
      value: connected ? robotStatus.toUpperCase() : "DISCONNECTED",
      tone: connected ? "cyan" : "red",
      onClick: () => navigate("/statistics"),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c, i) => (
        <Card key={c.title} {...c} index={i} />
      ))}
    </div>
  );
}

const TONE = {
  cyan: { glow: "rgba(95,232,255,0.5)", color: "#5fe8ff" },
  gold: { glow: "rgba(255,140,66,0.5)", color: "#ff8c42" },
  green: { glow: "rgba(0,255,157,0.5)", color: "#00ff9d" },
  red: { glow: "rgba(255,77,77,0.5)", color: "#ff4d4d" },
  muted: { glow: "rgba(120,140,160,0.3)", color: "#7a8da0" },
};

function Card({ icon: Icon, title, desc, value, sub, tone = "cyan", ring, onClick, index }) {
  const t = TONE[tone] || TONE.cyan;
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index }}
      onClick={onClick}
      disabled={!onClick}
      className="glass rounded-2xl p-3.5 text-left relative overflow-hidden active:scale-[0.98] transition-transform"
      style={{ boxShadow: `inset 0 0 0 1px ${t.glow.replace('0.5','0.16')}` }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${t.glow.replace('0.5','0.12')}`, border: `1px solid ${t.glow.replace('0.5','0.4')}` }}
        >
          <Icon className="w-4 h-4" style={{ color: t.color }} strokeWidth={2} />
        </div>
        {ring != null ? (
          <PerfRing pct={ring} />
        ) : (
          <span
            className="text-[10px] font-heading font-bold tracking-wider px-2 py-0.5 rounded-full"
            style={{ color: t.color, background: t.glow.replace('0.5','0.1'), border: `1px solid ${t.glow.replace('0.5','0.3')}` }}
          >
            {value}
          </span>
        )}
      </div>
      <h3 className="font-heading font-bold text-[12px] text-white tracking-wide mt-2.5">{title}</h3>
      <p className="text-[10px] text-white/45 leading-tight mt-0.5">{desc}</p>
      {sub && <p className="text-[10px] text-white/55 mt-1 font-heading">{sub}</p>}
      <span className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full" style={{ background: `radial-gradient(circle, ${t.glow.replace('0.5','0.12')}, transparent 70%)` }} />
    </motion.button>
  );
}

function PerfRing({ pct }) {
  const r = 16, c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative w-9 h-9">
      <svg width="36" height="36" className="-rotate-90">
        <circle cx="18" cy="18" r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="none" />
        <circle
          cx="18" cy="18" r={r} stroke="#ff8c42" strokeWidth="3" fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 4px rgba(255,140,66,0.7))" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-heading font-bold text-[#ff8c42]">
        {Math.round(pct)}%
      </span>
    </div>
  );
}