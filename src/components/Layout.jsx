import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Radar, BarChart3, Settings, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/",            label: "Home",       icon: LayoutDashboard },
  { to: "/ai-scanner",  label: "Scanner",    icon: Radar },
  { to: "/statistics",  label: "Statistics", icon: BarChart3 },
  { to: "/settings",    label: "Settings",   icon: Settings },
  { to: "/account",     label: "Account",    icon: Wallet },
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

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 px-4 pb-4">
        <div className="flex items-center justify-around py-2.5 px-2 rounded-2xl"
          style={{
            background: "rgba(12,12,12,0.97)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.07)",
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
                  "flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all",
                  active ? "text-[#FF3131]" : "text-white/30"
                )}
                style={active ? { filter: "drop-shadow(0 0 6px rgba(255,49,49,0.5))" } : undefined}
              >
                <item.icon className="w-5 h-5" />
                <span className={cn("text-[10px] uppercase tracking-wider font-heading font-bold", active && "text-[#FF3131]")}>
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