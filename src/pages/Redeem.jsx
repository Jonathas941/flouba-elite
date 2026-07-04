import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import MobileHeader from "@/components/MobileHeader";
import { useToast } from "@/components/ui/use-toast";
import { useLocation } from "react-router-dom";
import { KeyRound, Loader2, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

const PLANS = ["Starter", "Pro", "Elite"];

export default function Redeem() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const handleRedeem = async () => {
    if (!code.trim()) {
      toast({ title: "Enter your serial key", variant: "destructive" });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("redeemSerialKey", { code: code.trim() });
      const data = res?.data || {};
      if (data.success) {
        setResult({ plan: data.plan, expires_date: data.expires_date });
        toast({ title: "Serial key redeemed", description: `${data.plan} plan activated.`, duration: 2500 });
      } else {
        toast({ title: "Redemption failed", description: data.error || "Invalid key.", variant: "destructive" });
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Redemption failed.";
      toast({ title: "Redemption failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen pb-32 max-w-md sm:max-w-2xl lg:max-w-4xl mx-auto">
      <MobileHeader title="Redeem Serial Key" subtitle="Activate your paid plan." />

      <div className="px-4 space-y-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
          <div className="w-16 h-16 glass rounded-2xl mx-auto flex items-center justify-center mb-2">
            <KeyRound className="w-8 h-8 text-red-400" strokeWidth={1.6} />
          </div>
          <h1 className="font-heading text-2xl font-black text-white">Enter Your Serial Key</h1>
          <p className="text-sm text-muted-foreground">
            Redeem the key you received after payment to activate your plan and receive your EA file.
          </p>
        </motion.div>

        {result ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <GlassCard className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-green-400" />
              </div>
              <div>
                <p className="font-heading text-lg font-bold text-white">{result.plan} Plan Activated</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Valid until {new Date(result.expires_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2 justify-center text-xs text-green-300/80 bg-green-500/5 rounded-xl py-2.5 px-3 border border-green-500/15">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Your EA file &amp; bridge credentials are being emailed to you now.</span>
              </div>
              <Button
                onClick={() => navigate("/connect-mt5")}
                className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-heading font-bold tracking-widest text-xs uppercase neon-red"
              >
                Connect MT5 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </GlassCard>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <GlassCard className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Serial Key</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="FE-XXXX-XXXX-XXXX"
                  className="w-full h-12 px-3 glass rounded-xl text-sm text-white font-mono tracking-[0.15em] placeholder:text-muted-foreground/40 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-1 focus:ring-red-500/50 bg-transparent"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <Button
                onClick={handleRedeem}
                disabled={busy || !code.trim()}
                className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-heading font-bold tracking-widest text-xs uppercase neon-red disabled:opacity-50"
              >
                {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Redeeming…</> : "Redeem Key"}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                Each key works once. Don't have a key yet? Contact Flouba Elite to purchase a plan.
              </p>
            </GlassCard>
          </motion.div>
        )}
      </div>
    </div>
  );
}