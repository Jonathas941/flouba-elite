import React from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RobotControls({ status, onStart, onStop, disabled }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        onClick={onStart}
        disabled={disabled || status === "Running"}
        className="h-14 rounded-2xl bg-red-600 hover:bg-red-500 neon-red font-heading tracking-wider text-base disabled:opacity-40"
      >
        <Play className="w-5 h-5 mr-2 fill-current" /> START
      </Button>
      <Button
        onClick={onStop}
        disabled={disabled || status !== "Running"}
        variant="outline"
        className="h-14 rounded-2xl border-red-500/40 bg-white/5 hover:bg-white/10 font-heading tracking-wider text-base disabled:opacity-40"
      >
        <Square className="w-5 h-5 mr-2 fill-current" /> STOP
      </Button>
    </div>
  );
}