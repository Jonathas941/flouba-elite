import React from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { LayoutDashboard, BarChart3, Zap, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/",            label: "Home",       icon: LayoutDashboard },
  { to: "/ai-scanner",  label: "Scanner",    icon: Zap },
  { to: "/statistics",  label: "Statistics", icon: BarChart3 },
  { to: "/settings",    label: "Settings",   icon: Settings },
  { to: "/account",     label: "Account",    icon: User },
];

export default function Layout() {
  const location = useLocation();
  return (
    <div className="min-h-screen max-w-md mx-auto relative" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom))" }}>
      <Outlet />
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
        <div className="flex items-center justify-around px-4 border-t border-white/8"
          style={{ background: "rgba(10,10,10,0.97)", backdropFilter: "blur(20px)", paddingTop: "12px", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-1 px-3 transition-all",
                  active ? "text-red-500" : "text-white/30"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className={cn("text-[10px] uppercase tracking-wider font-heading font-bold", active && "text-red-500")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}