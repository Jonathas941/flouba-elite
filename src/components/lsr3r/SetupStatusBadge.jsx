import React from "react";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  "Waiting for anchor":       { bg: "rgba(255,204,66,0.10)", border: "rgba(255,204,66,0.30)", text: "#FFCC42" },
  "Waiting for sweep":        { bg: "rgba(255,204,66,0.10)", border: "rgba(255,204,66,0.30)", text: "#FFCC42" },
  "Sweep detected":           { bg: "rgba(0,229,255,0.10)",  border: "rgba(0,229,255,0.30)",  text: "#00E5FF" },
  "Waiting for CHOCH":        { bg: "rgba(0,229,255,0.10)",  border: "rgba(0,229,255,0.30)",  text: "#00E5FF" },
  "CHOCH confirmed":          { bg: "rgba(0,229,255,0.15)",  border: "rgba(0,229,255,0.35)",  text: "#00E5FF" },
  "FVG detected":             { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.35)", text: "#A855F7" },
  "Pending retest":           { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.35)", text: "#A855F7" },
  "Entry signal ready":       { bg: "rgba(0,255,65,0.12)",   border: "rgba(0,255,65,0.35)",   text: "#00FF41" },
  "Setup invalidated":        { bg: "rgba(255,49,49,0.12)",  border: "rgba(255,49,49,0.35)",  text: "#FF3131" },
  "Session completed":        { bg: "rgba(255,255,255,0.06)",border: "rgba(255,255,255,0.15)", text: "#999" },
  "Market feed disconnected": { bg: "rgba(255,49,49,0.12)",  border: "rgba(255,49,49,0.35)",  text: "#FF3131" },
};

export default function SetupStatusBadge({ status, direction, size = "md" }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS["Waiting for anchor"];
  const padding = size === "sm" ? "px-2 py-1" : "px-3 py-1.5";

  return (
    <div className="inline-flex items-center gap-2">
      <span className={cn("rounded-full font-heading font-bold tracking-wider uppercase", padding)}
        style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, fontSize: size === "sm" ? "9px" : "10px" }}>
        {status}
      </span>
      {direction && (status === "Entry signal ready" || status === "FVG detected") && (
        <span className={cn("rounded-full px-2.5 py-1 font-heading font-black tracking-wider", padding)}
          style={{
            background: direction === "BUY" ? "rgba(0,255,65,0.15)" : "rgba(255,49,49,0.15)",
            border: `1px solid ${direction === "BUY" ? "rgba(0,255,65,0.40)" : "rgba(255,49,49,0.40)"}`,
            color: direction === "BUY" ? "#00FF41" : "#FF3131",
            fontSize: size === "sm" ? "9px" : "10px",
          }}>
          {direction}
        </span>
      )}
    </div>
  );
}