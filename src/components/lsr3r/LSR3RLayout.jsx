import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Radar, History, BarChart3, Settings as Cog, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/lsr3r",            label: "Scanner",  icon: Radar },
  { to: "/lsr3r/history",    label: "History",  icon: History },
  { to: "/lsr3r/analytics",  label: "Analytics",icon: BarChart3 },
  { to: "/lsr3r/settings",   label: "Settings", icon: Cog },
  { to: "/lsr3r/webhook",    label: "MT5 Link", icon: Webhook },
];

export default function LSR3RLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen max-w-md mx-auto relative" style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom))" }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-3 pb-2"
        style={{ background: "rgba(5,5,5,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,204,66,0.10)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-heading font-black text-base text-white tracking-wider">
              FLOUBA <span style={{ color: "#FFCC42" }}>ELITE</span>
            </h1>
            <p className="text-[9px] text-white/40 tracking-[0.2em] uppercase font-heading">LSR-3R Scanner</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(255,204,66,0.08)", border: "1px solid rgba(255,204,66,0.20)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#FFCC42" }} />
            <span className="text-[9px] font-heading font-bold tracking-wider" style={{ color: "#FFCC42" }}>LSR-3R</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const active = location.pathname === t.to;
            return (
              <button key={t.to} onClick={() => navigate(t.to)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap",
                  active ? "text-white" : "text-white/35"
                )}
                style={active ? { background: "rgba(255,204,66,0.12)", border: "1px solid rgba(255,204,66,0.30)" } : { border: "1px solid transparent" }}>
                <t.icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-heading font-bold tracking-wider uppercase">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-3">
        <Outlet />
      </div>
    </div>
  );
}