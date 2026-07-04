import React from "react";
import { Menu, Bell } from "lucide-react";
import FloubaLogo from "@/components/dashboard/FloubaLogo";

export default function FloubaHeader({ onMenu, onBell }) {
  return (
    <header
      className="sticky top-0 z-40 px-4 flex items-center justify-between"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom: 12,
        background: "rgba(8,16,32,0.72)",
        backdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(0,229,255,0.18)",
      }}
    >
      <button
        onClick={onMenu}
        className="w-10 h-10 rounded-xl glass flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Menu"
      >
        <Menu className="w-5 h-5 text-cyan-300" strokeWidth={2} />
      </button>

      <div className="flex items-center gap-2.5">
        <FloubaLogo size={30} />
        <div className="text-center leading-none">
          <h1 className="font-heading font-black tracking-wider text-[15px] text-white">
            FLOUBA <span style={{ color: "#ffce4d" }}>ELITE</span>
          </h1>
          <p className="text-[9px] uppercase tracking-[0.28em] text-cyan-300/70 mt-0.5 font-heading">
            AI-Driven Trading Control
          </p>
        </div>
      </div>

      <button
        onClick={onBell}
        className="relative w-10 h-10 rounded-xl glass flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-cyan-300" strokeWidth={2} />
        <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full bg-[#ffce4d]" style={{ boxShadow: "0 0 6px rgba(255,206,77,0.9)" }} />
      </button>
    </header>
  );
}