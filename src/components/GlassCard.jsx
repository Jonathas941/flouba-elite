import React from "react";
import { cn } from "@/lib/utils";

export default function GlassCard({ className, children, glow = false, ...props }) {
  return (
    <div
      className={cn("glass rounded-2xl p-4", glow && "neon-green", className)}
      {...props}
    >
      {children}
    </div>
  );
}