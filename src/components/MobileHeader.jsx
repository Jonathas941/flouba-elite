import React from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Unified top header for sub-pages.
 * Handles safe-area-inset-top automatically.
 */
export default function MobileHeader({ title, subtitle, onBack, className, children }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header
      className={cn("flex items-center gap-3 px-4 pb-3", className)}
      style={{ paddingTop: "calc(16px + env(safe-area-inset-top))" }}
    >
      <button
        onClick={handleBack}
        className="w-9 h-9 rounded-xl glass flex items-center justify-center shrink-0 transition-opacity active:opacity-60"
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="font-heading text-xl font-black text-white neon-text leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}