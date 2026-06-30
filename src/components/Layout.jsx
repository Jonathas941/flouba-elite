import React from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { LayoutDashboard, BarChart3, Zap, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/",            label: "Home",      icon: LayoutDashboard },
  { to: "/statistics",  label: "Statistics", icon: BarChart3 },
  { to: "/ai-scanner",  label: "Scanner",    icon: Zap },
  { to: "/settings",    label: "Settings",   icon: Settings },
  { to: "/account",     label: "Account",    icon: User },
];

export default function Layout() {
  const location = useLocation();
  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto relative">
      <Outlet />
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 px-3 pb-3">
        <div className="glass rounded-2xl flex items-center justify-around py-2 px-1">
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all",
                  active ? "text-red-500" : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <item.icon className={cn("w-5 h-5", active && "neon-text")} />
                  {active && (
                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full" />
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}