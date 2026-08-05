import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Radar, BarChart3, Settings, Wallet, LineChart, Network, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/",            label: "Home",       icon: LayoutDashboard },
  { to: "/ai-scanner",  label: "Scanner",    icon: Radar },
  { to: "/statistics",  label: "Statistics", icon: BarChart3 },
  { to: "/settings",    label: "Settings",   icon: Settings },
  { to: "/account",     label: "Account",    icon: Wallet },
  { to: "/tradingview",  label: "TradingView", icon: LineChart },
  { to: "/market-structure", label: "Market Structure", icon: Network },
  { to: "/ai-analyst", label: "AI Analyst", icon: Bot },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen max-w-md mx-auto relative"
      style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom))" }}
    >
      <Outlet />

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 px-2 pb-4">
        <div className="flex items-stretch justify-between gap-0.5 py-1.5 px-1 rounded-2xl"
          style={{
            background: "rgba(12,12,12,0.97)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(0,255,65,0.10)",
            borderRadius: "22px",
            boxShadow: "0 -4px 30px rgba(0,0,0,0.6)",
          }}>
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl transition-all",
                  "flex-1 min-w-0 h-12 px-0.5",
                  active ? "text-[#00FF41]" : "text-white/30 hover:text-white/50"
                )}
                style={active ? { filter: "drop-shadow(0 0 6px rgba(0,255,65,0.5))" } : undefined}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="text-[10px] font-semibold truncate w-full text-center leading-none">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}