import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Circle, Download, Link2, Zap, RefreshCw, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import MobileHeader from "@/components/MobileHeader";

const WEBHOOK_BASE = "https://flouba-elite-trade.base44.app/functions/tradingViewWebhook";

export default function Onboarding() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);
  const [botSettings, setBotSettings] = useState(null);
  const [tvSettings, setTvSettings] = useState(null);
  const [eaData, setEaData] = useState(null);
  const [eaConnected, setEaConnected] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me().catch(() => null);
      setUser(me);
      const bsList = await base44.entities.BotSettings.list("-created_date", 1).catch(() => []);
      setBotSettings(bsList?.[0] || null);
      const tvList = await base44.entities.TradingViewSettings.list("-created_date", 1).catch(() => []);
      setTvSettings(tvList?.[0] || null);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const provisioned = !!user?.mt5_api_key;
  const eaDownloaded = !!eaData;
  const tvConfigured = !!tvSettings?.webhook_secret;

  // Determine current step
  useEffect(() => {
    if (!provisioned) setStep(0);
    else if (!eaDownloaded) setStep(1);
    else if (!tvConfigured) setStep(2);
    else if (!eaConnected) setStep(3);
    else setStep(4);
  }, [provisioned, eaDownloaded, tvConfigured, eaConnected]);

  const reprovision = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("mt5Bridge", { action: "reprovision" });
      if (res?.data?.ok) {
        const me = await base44.auth.me().catch(() => null);
        setUser(me);
        toast({ title: "Account re-provisioned", description: "Your bridge key has been refreshed." });
        return true;
      }
      toast({ title: "Re-provision failed", description: res?.data?.error || "Unknown error", variant: "destructive" });
      return false;
    } catch (e) {
      toast({ title: "Re-provision failed", description: e.message, variant: "destructive" });
      return false;
    }
  }, [toast]);

  const handleDownloadEa = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("getEaDownload", {});
      if (res?.data?.ok || res?.data?.ea_url) {
        setEaData(res.data);
        // Download the EA file
        if (res.data.ea_url) window.open(res.data.ea_url, "_blank");
        // Download the .set preset
        if (res.data.set_content) {
          const blob = new Blob([res.data.set_content], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = res.data.set_filename || "FloubaElite_EA.set";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        toast({ title: "EA downloaded", description: "Install the EA file and load the preset in MT5." });
      } else {
        // Check for 401 — try re-provision once
        if (String(res?.data?.error || "").includes("401") || String(res?.data?.error || "").includes("Invalid")) {
          toast({ title: "Key invalid — re-provisioning…", description: "Refreshing your bridge key.", duration: 4000 });
          const ok = await reprovision();
          if (ok) {
            const retry = await base44.functions.invoke("getEaDownload", {});
            if (retry?.data?.ok || retry?.data?.ea_url) {
              setEaData(retry.data);
              if (retry.data.ea_url) window.open(retry.data.ea_url, "_blank");
              toast({ title: "EA downloaded", description: "Install the EA file and load the preset in MT5." });
            }
          }
        } else {
          toast({ title: "Download failed", description: res?.data?.error || "No active subscription.", variant: "destructive" });
        }
      }
    } catch (e) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateWebhook = async () => {
    setBusy(true);
    try {
      const secret = crypto.randomUUID().replace(/-/g, "");
      let tv = tvSettings;
      if (tv?.id) {
        tv = await base44.entities.TradingViewSettings.update(tv.id, {
          webhook_secret: secret,
          auto_trading_enabled: false,
          trading_mode: "test",
          allow_buy: true,
          allow_sell: true,
        });
      } else {
        tv = await base44.entities.TradingViewSettings.create({
          webhook_secret: secret,
          auto_trading_enabled: false,
          trading_mode: "test",
          use_alert_quantity: true,
          fixed_order_size: 0.01,
          allowed_symbols: "XAUUSD",
          max_order_size: 0.1,
          max_open_positions: 3,
          allow_buy: true,
          allow_sell: true,
          allow_close: true,
        });
      }
      setTvSettings(tv);
      toast({ title: "Webhook secret generated", description: "Copy the URL and configure your TradingView alert." });
    } catch (e) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleCheckEa = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("mt5Bridge", { action: "detect" });
      if (res?.data?.ok && res?.data?.data?.connected) {
        setEaConnected(true);
        toast({ title: "EA Connected!", description: "Your MT5 terminal is live and reporting.", duration: 4000 });
      } else {
        // Try re-provision on 401
        if (String(res?.data?.error || "").includes("401") || String(res?.data?.error || "").includes("Invalid")) {
          toast({ title: "Key invalid — re-provisioning…", duration: 4000 });
          const ok = await reprovision();
          if (ok) {
            const retry = await base44.functions.invoke("mt5Bridge", { action: "detect" });
            if (retry?.data?.ok && retry?.data?.data?.connected) {
              setEaConnected(true);
              toast({ title: "EA Connected!", description: "Your MT5 terminal is live and reporting.", duration: 4000 });
              return;
            }
          }
        }
        toast({ title: "EA not connected yet", description: "Make sure MT5 is running with the EA attached.", variant: "destructive", duration: 5000 });
      }
    } catch (e) {
      toast({ title: "Check failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied!", description: "Pasted to your clipboard." });
    }).catch(() => {
      toast({ title: "Copy failed", variant: "destructive" });
    });
  };

  const webhookUrl = tvSettings?.webhook_secret
    ? `${WEBHOOK_BASE}?secret=${tvSettings.webhook_secret}`
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00FF41]/30 border-t-[#00FF41] rounded-full animate-spin" />
      </div>
    );
  }

  const steps = [
    { label: "Account Provisioned", done: provisioned },
    { label: "Download EA Preset", done: eaDownloaded },
    { label: "Generate Webhook Secret", done: tvConfigured },
    { label: "EA Connected", done: eaConnected },
  ];

  const StepIcon = ({ done, active }) => done
    ? <CheckCircle className="w-5 h-5 text-[#00FF41]" />
    : active
      ? <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <Circle className="w-5 h-5 text-amber-400 fill-amber-400/20" />
        </motion.div>
      : <Circle className="w-5 h-5 text-white/20" />;

  return (
    <div className="space-y-4 pb-4">
      <MobileHeader title="Onboarding" subtitle="Get your trading bot running in 4 steps." />

      <div className="px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Progress Steps */}
        <GlassCard>
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <StepIcon done={s.done} active={i === step} />
                <span className={`text-sm ${s.done ? "text-[#00FF41]" : i === step ? "text-white" : "text-white/30"}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Step 0: Account Provisioned */}
        {step === 0 && (
          <GlassCard>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-[#00FF41]" />
              <p className="text-sm font-bold text-white">Step 1: Account Provisioning</p>
            </div>
            <p className="text-xs text-white/60 mb-3">
              Your bridge account is being provisioned automatically. This happens on first login and takes a few seconds.
            </p>
            <Button onClick={loadData} className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/15">
              <RefreshCw className="w-4 h-4 mr-2" /> Check Again
            </Button>
          </GlassCard>
        )}

        {/* Step 1: Download EA */}
        {step === 1 && (
          <GlassCard>
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-[#00FF41]" />
              <p className="text-sm font-bold text-white">Step 2: Download Your EA Preset</p>
            </div>
            <p className="text-xs text-white/60 mb-3">
              Download the Flouba Elite EA file and your pre-configured .set preset. Install both in MT5.
            </p>
            <Button onClick={handleDownloadEa} disabled={busy} className="w-full h-12 rounded-xl bg-[#00FF41] hover:bg-[#00CC33] text-black font-bold">
              <Download className="w-4 h-4 mr-2" /> {busy ? "DOWNLOADING…" : "DOWNLOAD EA & PRESET"}
            </Button>
          </GlassCard>
        )}

        {/* Step 2: Generate Webhook */}
        {step === 2 && (
          <GlassCard>
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-4 h-4 text-[#00FF41]" />
              <p className="text-sm font-bold text-white">Step 3: Generate Your Webhook Secret</p>
            </div>
            <p className="text-xs text-white/60 mb-3">
              Create your unique TradingView webhook URL and configure your Gold Scalper alert.
            </p>
            <Button onClick={handleGenerateWebhook} disabled={busy} className="w-full h-12 rounded-xl bg-[#00FF41] hover:bg-[#00CC33] text-black font-bold">
              <Link2 className="w-4 h-4 mr-2" /> {busy ? "GENERATING…" : "GENERATE WEBHOOK SECRET"}
            </Button>
          </GlassCard>
        )}

        {/* Step 3: Copy Webhook URL + Instructions */}
        {step === 3 && webhookUrl && (
          <GlassCard>
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-4 h-4 text-[#00FF41]" />
              <p className="text-sm font-bold text-white">Step 4: Configure TradingView Alert</p>
            </div>
            <p className="text-xs text-white/60 mb-2">Copy this webhook URL into your TradingView alert:</p>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 text-[10px] text-[#00FF41] bg-black/40 p-2 rounded-lg break-all border border-white/10">
                {webhookUrl}
              </code>
              <Button size="sm" onClick={() => copyToClipboard(webhookUrl)} className="flex-shrink-0">Copy</Button>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
              <p className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Gold Scalper Alert Message:</p>
              <pre className="text-[9px] text-[#00FF41]/80 whitespace-pre-wrap leading-relaxed">
{`{
  "secret": "${tvSettings?.webhook_secret?.slice(0, 8)}...",
  "action": "{{strategy.order.action}}",
  "symbol": "{{ticker}}",
  "price": "{{close}}",
  "sl": "{{plot("SL")}}",
  "tp1": "{{plot("TP1")}}",
  "tp2": "{{plot("TP2")}}",
  "tp3": "{{plot("TP3")}}",
  "alert_id": "{{timenow}}"
}`}
              </pre>
            </div>
            <Button onClick={handleCheckEa} disabled={busy} className="w-full h-12 mt-3 rounded-xl bg-[#00FF41] hover:bg-[#00CC33] text-black font-bold">
              {busy ? "CHECKING…" : "CHECK EA CONNECTION"}
            </Button>
          </GlassCard>
        )}

        {/* Step 3 (no webhook): show generate first */}
        {step === 3 && !webhookUrl && (
          <GlassCard>
            <p className="text-xs text-white/60">Generate your webhook secret first.</p>
          </GlassCard>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <GlassCard>
            <div className="text-center py-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
                <CheckCircle className="w-12 h-12 text-[#00FF41] mx-auto mb-3" style={{ filter: "drop-shadow(0 0 12px rgba(0,255,65,0.5))" }} />
              </motion.div>
              <p className="text-sm font-bold text-white mb-1">Setup Complete!</p>
              <p className="text-xs text-white/60 mb-4">Your trading bot is ready to go.</p>
              <Button onClick={() => navigate("/")} className="w-full h-12 rounded-xl bg-[#00FF41] hover:bg-[#00CC33] text-black font-bold">
                Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}