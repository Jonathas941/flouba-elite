import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import { Send, CheckCircle, XCircle } from "lucide-react";

export default function TestSignalButton({ settings }) {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    if (!settings?.webhook_secret) {
      toast({ title: "No Secret", description: "Webhook secret is not set.", variant: "destructive" });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      // Get current XAUUSD price from MT5 bridge
      const statusRes = await base44.functions.invoke("mt5Bridge", { action: "status" });
      const statusData = statusRes?.data || {};
      const price = statusData.ask || statusData.bid || statusData.data?.ask || statusData.data?.bid;

      if (!price) {
        setResult({ error: "Cannot get current XAUUSD price — MT5 bridge not connected." });
        return;
      }

      const entry = price;
      const sl = +(entry - 5).toFixed(2);
      const tp1 = +(entry + 3).toFixed(2);
      const tp2 = +(entry + 6).toFixed(2);
      const tp3 = +(entry + 10).toFixed(2);
      const alertId = `TEST-${Date.now()}`;

      const res = await base44.functions.invoke("tradingViewWebhook", {
        secret: settings.webhook_secret,
        alert_id: alertId,
        action: "BUY",
        symbol: "XAUUSD",
        price: entry,
        sl,
        tp1,
        tp2,
        tp3,
        test: true,
      });

      setResult(res);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <GlassCard className="p-4 space-y-3">
      <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider">Test Signal</h2>
      <p className="text-[10px] text-white/40">
        Sends a BUY on XAUUSD with computed SL/TP around the current price. Treated as test mode — validated, lot-calculated, and saved, but never sent to Replit.
      </p>
      <Button
        onClick={handleTest}
        disabled={testing}
        className="w-full bg-[#00FF41] hover:bg-[#00FF41]/80 text-black font-bold"
      >
        {testing ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2" />
            Sending...
          </>
        ) : (
          <>
            <Send className="w-3.5 h-3.5 mr-2" /> Send Test Signal (test mode)
          </>
        )}
      </Button>

      {result && (
        <div className="bg-black/40 rounded-lg p-3 border border-white/5 space-y-1.5">
          {result.error ? (
            <div className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-[#FF3131] mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-[#FF3131]">{result.error}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="w-4 h-4 text-[#00FF41]" />
                ) : (
                  <XCircle className="w-4 h-4 text-[#FF3131]" />
                )}
                <span className="text-xs text-white/80 font-bold">
                  {result.success ? "Test Signal Accepted" : "Test Signal Rejected"}
                </span>
              </div>
              {result.alert_id && (
                <p className="text-[10px] text-white/40">Alert ID: <span className="font-mono">{result.alert_id}</span></p>
              )}
              {result.symbol && (
                <p className="text-[10px] text-white/40">{result.action} {result.symbol}</p>
              )}
              {result.total_lot != null && (
                <p className="text-[10px] text-white/40">Total lot: {result.total_lot}</p>
              )}
              {result.legs && Array.isArray(result.legs) && (
                <p className="text-[10px] text-white/40">
                  Legs: {result.legs.map(l => `${l.label} (${l.lot})`).join(", ")}
                </p>
              )}
              {result.message && (
                <p className="text-[10px] text-white/30 italic">{result.message}</p>
              )}
            </>
          )}
        </div>
      )}
    </GlassCard>
  );
}