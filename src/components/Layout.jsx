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

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md sm:max-w-2xl lg:max-w-4xl z-50">
        <div
          className="flex items-center justify-around px-4"
          style={{
            background: "rgba(8,16,32,0.97)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(0,229,255,0.18)",
            paddingTop: "12px",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          }}
        >
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <button
                key={item.to}
                onClick={() => handleTabPress(item.to)}
                className={cn(
                  "flex flex-col items-center gap-1 py-1 px-3 transition-all",
                  active ? "text-cyan-300" : "text-white/30"
                )}
                style={active ? { filter: "drop-shadow(0 0 6px rgba(0,229,255,0.7))" } : undefined}
              >
                <item.icon className="w-5 h-5" />
                <span className={cn("text-[10px] uppercase tracking-wider font-heading font-bold", active && "text-cyan-300")}>
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