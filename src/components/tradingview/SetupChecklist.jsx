import React from "react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import { BookOpen, Copy } from "lucide-react";

const JSON_EXAMPLE = `{
  "secret": "your-webhook-secret",
  "alert_id": "unique-id",
  "action": "BUY",
  "symbol": "XAUUSD",
  "sl": 2340.00,
  "tp1": 2348.00,
  "tp2": 2351.00,
  "tp3": 2355.00
}`;

export default function SetupChecklist() {
  const { toast } = useToast();

  const copy = () => {
    navigator.clipboard.writeText(JSON_EXAMPLE).then(() => {
      toast({ title: "Copied", description: "JSON example copied to clipboard." });
    });
  };

  return (
    <GlassCard className="p-4 space-y-3">
      <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
        <BookOpen className="w-3.5 h-3.5" /> Setup Checklist
      </h2>
      <ol className="text-[11px] text-white/50 space-y-2 list-decimal list-inside">
        <li>
          In TradingView, open <span className="text-white/70">FLOUBA Gold Scalper V4</span> → Settings → Inputs:
          Alert format = <span className="text-white/70">"JSON (for a bot)"</span>, paste the webhook secret into
          <span className="text-white/70"> "Base44 webhook secret"</span>.
        </li>
        <li>
          Create the alert <span className="text-white/70">after</span> saving the script: Condition =
          FLOUBA Gold Scalper V4 → <span className="text-white/70">"Any alert() function call"</span>;
          Notifications → Webhook URL = the URL above; leave Message empty.
        </li>
        <li>
          If the script or the secret changes, <span className="text-white/70">delete and recreate</span> the alert
          (TradingView keeps the old script version).
        </li>
      </ol>

      <div className="bg-black/40 rounded-lg p-3 border border-white/5">
        <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Expected JSON</p>
        <pre className="text-[10px] text-[#00FF41] font-mono whitespace-pre-wrap break-all leading-relaxed">{JSON_EXAMPLE}</pre>
      </div>
      <Button
        onClick={copy}
        variant="outline"
        size="sm"
        className="w-full border-[#00FF41]/20 text-[#00FF41]/80 hover:bg-[#00FF41]/5"
      >
        <Copy className="w-3.5 h-3.5 mr-2" /> Copy JSON Example
      </Button>
    </GlassCard>
  );
}