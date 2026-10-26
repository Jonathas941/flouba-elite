import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Radar, BarChart3, Settings, Wallet, LineChart, Network, Bot, ShieldAlert } from "lucide-react";
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
  { to: "/risk",       label: "Risk",       icon: ShieldAlert },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [navHidden, setNavHidden] = React.useState(false);

  React.useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          const delta = currentY - lastScrollY;
          if (delta > 4 && currentY > 80) setNavHidden(true);
          else if (delta < -4) setNavHidden(false);
          lastScrollY = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="min-h-screen max-w-md mx-auto relative"
      style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom))" }}
    >
      <Outlet />

      <nav
        className={cn(
          "fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-transform duration-300 ease-out",
          navHidden && "translate-y-[calc(100%+env(safe-area-inset-bottom)+0.75rem)]"
        )}
      >
        <div className="flex items-stretch justify-between gap-0.5 py-1.5 px-1 rounded-2xl"
          style={{
            background: "rgba(22,26,32,0.98)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(0,255,65,0.22)",
            borderRadius: "22px",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.38)",
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
                  active ? "text-[#00FF41]" : "text-white/65 hover:text-white/85"
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