import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import GlassCard from "@/components/GlassCard";
import { User, Crown, Shield, LogOut, ChevronRight, Settings, Bell, Lock, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MobileHeader from "@/components/MobileHeader";

export default function Account() {
  const [me, setMe] = useState(null);
  const [sub, setSub] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setMe(await base44.auth.me());
      const subs = await base44.entities.Subscription.list();
      setSub(subs[0] || null);
    })();
  }, []);

  const planColor = sub?.plan === "Elite" ? "text-red-400" : sub?.plan === "Pro" ? "text-amber-400" : "text-sky-400";

  const menuItems = [
    { icon: Settings, label: "Bot Settings", action: () => navigate("/settings") },
    { icon: Bell,     label: "Notifications", action: () => {} },
    { icon: Lock,     label: "Security", action: () => {} },
    { icon: Shield,   label: "Admin Panel", action: () => navigate("/admin"), admin: true },
  ];

  return (
    <div className="space-y-4 pb-6">
      <MobileHeader title="Account" />
      <div className="px-4 space-y-4">

      <GlassCard className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
          <User className="w-8 h-8 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading text-lg font-bold text-white truncate">{me?.full_name || "Trader"}</p>
          <p className="text-sm text-muted-foreground truncate">{me?.email || "—"}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Crown className="w-3 h-3 text-red-500" />
            <span className={`text-xs font-semibold ${planColor}`}>{sub?.plan || "Starter"} Plan</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        {menuItems.filter(m => !m.admin || me?.role === "admin").map((item, i, arr) => (
          <button key={item.label} onClick={item.action}
            className={`w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors ${i < arr.length - 1 ? "border-b border-white/5" : ""}`}>
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
              <item.icon className="w-4 h-4 text-red-400" />
            </div>
            <span className="flex-1 text-sm font-semibold text-white text-left">{item.label}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </GlassCard>

      <GlassCard>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Subscription</p>
        <div className="flex items-center justify-between">
          <div>
            <p className={`font-heading text-xl font-black ${planColor}`}>{sub?.plan || "Starter"}</p>
            <p className="text-xs text-muted-foreground">{sub?.status === "Active" ? `Active · expires ${sub?.expires_date || "—"}` : "No active plan"}</p>
          </div>
          <button onClick={() => navigate("/subscription")}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 neon-red text-xs font-heading tracking-widest text-white transition-colors">
            UPGRADE
          </button>
        </div>
      </GlassCard>

      <button
        onClick={() => base44.auth.logout("/")}
        className="w-full h-12 glass rounded-2xl flex items-center justify-center gap-2 text-red-400 font-heading tracking-widest text-sm hover:bg-red-500/10 transition-colors"
      >
        <LogOut className="w-4 h-4" /> LOGOUT
      </button>

      {!deleteConfirm ? (
        <button
          onClick={() => setDeleteConfirm(true)}
          className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-white/25 font-heading tracking-widest text-xs hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> DELETE ACCOUNT
        </button>
      ) : (
        <GlassCard className="border border-red-500/40 space-y-3">
          <p className="text-sm text-white font-semibold text-center">Are you sure you want to delete your account?</p>
          <p className="text-xs text-muted-foreground text-center">This action is permanent and cannot be undone.</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setDeleteConfirm(false)}
              className="h-11 rounded-2xl border border-white/10 text-white/60 font-heading text-xs tracking-widest hover:bg-white/5 transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={() => base44.auth.logout("/")}
              className="h-11 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-heading text-xs tracking-widest transition-colors"
            >
              CONFIRM
            </button>
          </div>
        </GlassCard>
      )}
      </div>
    </div>
  );
}