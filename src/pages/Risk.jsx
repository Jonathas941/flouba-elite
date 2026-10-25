import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Shield, Skull, Play, AlertTriangle, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GlassCard from "@/components/GlassCard";
import MobileHeader from "@/components/MobileHeader";
import { setVisibleInterval } from "@/lib/visibleInterval";

export default function Risk() {
  const { toast } = useToast();
  const [limits, setLimits] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [killing, setKilling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("mt5Bridge", { action: "risk_status" });
      if (res?.data?.ok) setStatus(res.data.data);
    } catch {}
  }, []);

  const loadLimits = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("mt5Bridge", { action: "risk_get" });
      if (res?.data?.ok) setLimits(res.data.data);
      else setLimits(res?.data?.data || {});
    } catch {
      setLimits({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLimits();
    loadStatus();
    const stopStatus = setVisibleInterval(loadStatus, 30000);
    return () => stopStatus();
  }, [loadLimits, loadStatus]);

  const killed = status?.killed === true || status?.status === "killed";

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("mt5Bridge", { action: "risk_set", ...limits });
      if (res?.data?.ok) {
        toast({ title: "Risk limits saved", description: "Your risk configuration has been updated." });
      } else {
        toast({ title: "Save failed", description: res?.data?.error || "Unknown error", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleKill = async () => {
    setKilling(true);
    try {
      const res = await base44.functions.invoke("mt5Bridge", { action: "risk_kill" });
      if (res?.data?.ok) {
        toast({ title: "KILL SWITCH ACTIVATED", description: "All positions closed. Trading halted.", variant: "destructive", duration: 5000 });
        await loadStatus();
      } else {
        toast({ title: "Kill failed", description: res?.data?.error || "Unknown error", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Kill failed", description: e.message, variant: "destructive" });
    } finally {
      setKilling(false);
      setConfirmKill(false);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      const res = await base44.functions.invoke("mt5Bridge", { action: "risk_resume" });
      if (res?.data?.ok) {
        toast({ title: "Trading Resumed", description: "Risk kill switch deactivated." });
        await loadStatus();
      } else {
        toast({ title: "Resume failed", description: res?.data?.error || "Unknown error", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Resume failed", description: e.message, variant: "destructive" });
    } finally {
      setResuming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FF3131]/30 border-t-[#FF3131] rounded-full animate-spin" />
      </div>
    );
  }

  const num = (key, label) => (
    <div>
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={limits?.[key] ?? ""}
        onChange={(e) => setLimits((prev) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
        className="bg-white/5 border-red-500/20 rounded-xl h-11 mt-1"
      />
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      <MobileHeader title="Risk & Kill Switch" subtitle="Emergency controls and risk limits." />

      {killed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-2 rounded-xl p-4 flex items-center gap-3"
          style={{ background: "rgba(255,49,49,0.15)", border: "1px solid rgba(255,49,49,0.5)" }}
        >
          <Skull className="w-5 h-5 text-[#FF3131] flex-shrink-0" />
          <div>
            <p className="font-heading font-bold text-sm text-[#FF3131]">ACCOUNT KILLED</p>
            <p className="text-[10px] text-white/60">All trading is halted. Press Resume to reactivate.</p>
          </div>
        </motion.div>
      )}

      <div className="px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Today's Status */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-[#00FF41]" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Today's Risk Status</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 rounded-lg bg-white/5">
              <p className="text-[8px] uppercase tracking-widest text-white/40">Status</p>
              <p className={`text-sm font-bold ${killed ? "text-[#FF3131]" : "text-[#00FF41]"}`}>
                {killed ? "KILLED" : "ACTIVE"}
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/5">
              <p className="text-[8px] uppercase tracking-widest text-white/40">Daily P&L</p>
              <p className="text-sm font-bold text-white">
                {status?.daily_pnl != null ? `$${Number(status.daily_pnl).toFixed(2)}` : "--"}
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/5">
              <p className="text-[8px] uppercase tracking-widest text-white/40">Open Trades</p>
              <p className="text-sm font-bold text-white">{status?.open_trades ?? "--"}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/5">
              <p className="text-[8px] uppercase tracking-widest text-white/40">Trades Today</p>
              <p className="text-sm font-bold text-white">{status?.trades_today ?? "--"}</p>
            </div>
          </div>
        </GlassCard>

        {/* Risk Limits */}
        <GlassCard className="grid grid-cols-2 gap-3">
          <p className="col-span-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Risk Limits</p>
          {num("daily_loss_limit", "Daily Loss Limit ($)")}
          {num("daily_profit_target", "Daily Profit Target ($)")}
          {num("max_daily_drawdown", "Max Daily Drawdown (%)")}
          {num("max_daily_trades", "Max Daily Trades")}
          {num("stop_after_losses", "Stop After N Losses")}
          {num("max_concurrent_trades", "Max Concurrent Trades")}
        </GlassCard>

        <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-2xl bg-[#00FF41] hover:bg-[#00CC33] text-black font-heading tracking-widest">
          <Save className="w-4 h-4 mr-2" /> {saving ? "SAVING…" : "SAVE LIMITS"}
        </Button>

        {/* Kill Switch */}
        <GlassCard>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Emergency Controls</p>
          
          {!confirmKill ? (
            <Button
              onClick={() => setConfirmKill(true)}
              disabled={killing || killed}
              className="w-full h-14 rounded-2xl bg-[#FF3131] hover:bg-red-600 text-white font-heading tracking-widest disabled:opacity-40"
              style={{ boxShadow: "0 0 18px rgba(255,49,49,0.3)" }}
            >
              <Skull className="w-5 h-5 mr-2" /> KILL SWITCH
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FF3131]/10 border border-[#FF3131]/30">
                <AlertTriangle className="w-4 h-4 text-[#FF3131] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white/80">
                  This will immediately close ALL open positions and halt all trading. Are you sure?
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setConfirmKill(false)} variant="ghost" className="flex-1 h-11">
                  Cancel
                </Button>
                <Button onClick={handleKill} disabled={killing} className="flex-1 h-11 bg-[#FF3131] hover:bg-red-600 text-white font-bold">
                  {killing ? "KILLING…" : "CONFIRM KILL"}
                </Button>
              </div>
            </div>
          )}

          {killed && (
            <Button
              onClick={handleResume}
              disabled={resuming}
              className="w-full h-12 mt-3 rounded-2xl bg-[#00FF41] hover:bg-[#00CC33] text-black font-heading tracking-widest"
            >
              <Play className="w-4 h-4 mr-2" /> {resuming ? "RESUMING…" : "RESUME TRADING"}
            </Button>
          )}
        </GlassCard>
      </div>
    </div>
  );
}