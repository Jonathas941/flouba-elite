import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Check, Crown, Zap, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import MobileHeader from "@/components/MobileHeader";

const PLANS = [
  { plan: "Starter", price: 29, icon: Zap, features: ["1 MT5 account", "Normal mode", "Email support", "Daily limits"] },
  { plan: "Pro", price: 79, icon: Star, popular: true, features: ["3 MT5 accounts", "All trading modes", "Trailing stop", "Priority support", "News filter"] },
  { plan: "Elite", price: 149, icon: Crown, features: ["Unlimited accounts", "All strategies", "Advanced risk engine", "1-on-1 setup", "VIP support"] },
];

export default function Subscription() {
  const [current, setCurrent] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { (async () => setCurrent((await base44.entities.Subscription.list())[0]))(); }, []);

  const choose = async (plan) => {
    const data = { plan, status: "Active" };
    if (current) await base44.entities.Subscription.update(current.id, data);
    else setCurrent(await base44.entities.Subscription.create(data));
    setCurrent((p) => ({ ...(p || {}), ...data }));
    toast({ title: `${plan} selected`, description: "Subscription activated." });
  };

  return (
    <div className="space-y-4 pb-6">
      <MobileHeader title="Subscription" subtitle="Unlock the full power of Flouba Elite." />
      <div className="px-4 space-y-4">
        {PLANS.map((p) => {
          const active = current?.plan === p.plan && current?.status === "Active";
          return (
            <GlassCard key={p.plan} glow={p.popular} className={p.popular ? "border-red-500/40" : ""}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-red-500/15 flex items-center justify-center">
                    <p.icon className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg text-white">{p.plan}</h3>
                    {p.popular && <span className="text-[10px] uppercase tracking-widest text-red-400">Most Popular</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-heading text-2xl font-black text-white">${p.price}</p>
                  <p className="text-xs text-muted-foreground">/month</p>
                </div>
              </div>
              <ul className="space-y-1.5 mb-4">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-red-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => choose(p.plan)}
                disabled={active}
                className="w-full h-12 rounded-2xl bg-red-600 hover:bg-red-500 neon-red font-heading tracking-widest disabled:opacity-50"
              >
                {active ? "CURRENT PLAN" : "CHOOSE PLAN"}
              </Button>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}