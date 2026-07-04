import React, { useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Signal, Radar, Bot, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/",           label: "Dashboard", icon: LayoutDashboard },
  { to: "/ai-signals", label: "Signals",   icon: Signal },
  { to: "/ai-scanner", label: "Scanner",   icon: Radar },
  { to: "/statistics", label: "Bot",       icon: Bot },
  { to: "/settings",   label: "Settings",  icon: Settings },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  // Track the last-visited path per tab so switching back restores state
  const tabHistory = useRef({});

  const handleTabPress = (to) => {
    const alreadyActive = location.pathname === to;
    if (alreadyActive) {
      // Re-tap: go to root of this tab (same as `to`)
      navigate(to, { replace: true });
    } else {
      // Save current path for the outgoing tab
      tabHistory.current[location.pathname] = location.pathname;
      // Navigate to saved sub-path for this tab, or its root
      navigate(tabHistory.current[to] || to);
    }
  };

  return (
    <div
      className="min-h-screen max-w-md sm:max-w-2xl lg:max-w-4xl mx-auto relative"
      style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom))" }}
    >
      <Outlet />

      <nav className="fixed bottom-0 left-0 right-0 w-full z-50">
        <div
          className="mx-auto max-w-md sm:max-w-2xl lg:max-w-4xl flex items-center justify-around px-1 sm:px-6 lg:px-10"
          style={{
            background: "rgba(8,16,32,0.97)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(0,229,255,0.18)",
            borderLeft: "1px solid rgba(0,229,255,0.10)",
            borderRight: "1px solid rgba(0,229,255,0.10)",
            paddingTop: "10px",
            paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
          }}
        >
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <button
                key={item.to}
                onClick={() => handleTabPress(item.to)}
                className={cn(
                  "flex flex-col items-center gap-1 py-1 px-1.5 sm:px-5 lg:px-8 transition-all min-w-0 flex-1",
                  active ? "text-cyan-300" : "text-white/30"
                )}
                style={active ? { filter: "drop-shadow(0 0 6px rgba(0,229,255,0.7))" } : undefined}
              >
                <item.icon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 shrink-0" />
                <span className={cn("text-[9px] sm:text-xs lg:text-sm uppercase tracking-tight sm:tracking-wider font-heading font-bold leading-none truncate w-full text-center", active && "text-cyan-300")}>
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