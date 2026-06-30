import React from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Brain, Sliders, BarChart3, Crown, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/strategy", label: "Strategy", icon: Brain },
  { to: "/settings", label: "Settings", icon: Sliders },
  { to: "/statistics", label: "Stats", icon: BarChart3 },
  { to: "/subscription", label: "Plans", icon: Crown },
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
                <item.icon className={cn("w-5 h-5", active && "neon-text")} />
                <span className="text-[10px] uppercase tracking-wider font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}