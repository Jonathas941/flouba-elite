import React from "react";
import { Menu, Bell } from "lucide-react";
import FloubaLogo from "@/components/dashboard/FloubaLogo";

export default function FloubaHeader({ onMenu, onBell, unread = 0 }) {
  return (
    <header
      className="sticky top-0 z-40 px-4 flex items-center justify-between"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom: 12,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(0,255,65,0.18)",
      }}
    >
      <button
        onClick={onMenu}
        className="w-10 h-10 rounded-xl glass flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Menu"
      >
        <Menu className="w-5 h-5 text-[#00FF41]" strokeWidth={2} />
      </button>

      <div className="flex items-center gap-2.5">
        <FloubaLogo size={30} />
        <div className="text-center leading-none">
          <h1 className="font-heading font-black tracking-wider text-[15px] text-white">
            FLOUBA <span style={{ color: "#00FF41" }}>ELITE</span>
          </h1>
          <p className="text-[9px] uppercase tracking-[0.28em] text-[#00FF41]/70 mt-0.5 font-heading">
            AI-Driven Trading Control
          </p>
        </div>
      </div>

      <button
        onClick={onBell}
        className="relative w-10 h-10 rounded-xl glass flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-[#00FF41]" strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-heading font-bold text-[#050505]"
            style={{ background: "#FF3131", boxShadow: "0 0 8px rgba(255,49,49,0.9)" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </header>
  );
}