import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Signal, Radar, Bot, Settings, LineChart, Wallet, Bell, KeyRound, MoreHorizontal, CandlestickChart } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/",            label: "Dashboard", icon: LayoutDashboard },
  { to: "/strategy",    label: "Strategy",  icon: LineChart },
  { to: "/ai-signals",  label: "Signals",   icon: Signal },
  { to: "/ai-scanner",  label: "Scanner",   icon: Radar },
  { to: "/statistics",  label: "Stats",     icon: Bot },
  { to: "/account",     label: "Account",   icon: Wallet },
  { to: "/notifications", label: "Alerts",  icon: Bell },
  { to: "/connect-mt5", label: "Connect",   icon: KeyRound },
  { to: "/settings",    label: "More",      icon: MoreHorizontal },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleTabPress = (to) => {
    navigate(to, { replace: location.pathname === to });
  };

  return (
    <div
      className="min-h-screen max-w-md sm:max-w-2xl lg:max-w-4xl mx-auto relative"
      style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom))" }}
    >
      <Outlet />

      <nav className="fixed bottom-0 left-0 right-0 w-full z-50">
        <div
          className="mx-auto max-w-md sm:max-w-2xl lg:max-w-4xl flex items-stretch justify-around sm:justify-center sm:gap-1 lg:gap-3 px-1 sm:px-6 lg:px-8 overflow-x-auto no-scrollbar"
          style={{
            background: "rgba(6,0,0,0.97)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,56,56,0.18)",
            borderLeft: "1px solid rgba(255,56,56,0.10)",
            borderRight: "1px solid rgba(255,56,56,0.10)",
            borderRadius: "20px 20px 0 0",
            boxShadow: "0 -8px 40px rgba(255,56,56,0.08)",
            paddingTop: "10px",
            paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
            scrollbarWidth: "none",
          }}
        >
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <button
                key={item.to}
                onClick={() => handleTabPress(item.to)}
                className={cn(
                  "group flex flex-col items-center justify-center gap-1.5 shrink-0 w-[68px] sm:w-[88px] lg:w-[112px] py-2 sm:py-2.5 px-1.5 rounded-xl transition-all duration-200",
                  active
                    ? "text-red-400 bg-red-400/10"
                    : "text-white/35 hover:text-white/60 hover:bg-white/[0.03]"
                )}
                style={active ? { filter: "drop-shadow(0 0 6px rgba(255,56,56,0.45))" } : undefined}
              >
                <item.icon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 shrink-0 transition-transform group-active:scale-90" />
                <span className={cn("text-[9px] sm:text-xs lg:text-sm uppercase tracking-tight sm:tracking-wider font-heading font-bold leading-none whitespace-nowrap text-center", active && "text-red-400")}>
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