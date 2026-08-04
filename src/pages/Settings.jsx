import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import GlassCard from "@/components/GlassCard";
import { ToggleRow, SegmentRow } from "@/components/settings/SettingRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Save, Radar, FileText, BookOpen, Download, ChevronRight } from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import AutoStartButton from "@/components/dashboard/AutoStartButton";
import HftModeButton from "@/components/dashboard/HftModeButton";
import SignalAssistantPanel from "@/components/dashboard/SignalAssistantPanel";
import DynamicDailyTargetPanel from "@/components/dashboard/DynamicDailyTargetPanel";
import EmaIndicatorPanel from "@/components/dashboard/EmaIndicatorPanel";
import StrategyControlCard from "@/components/dashboard/StrategyControlCard";
import StrategyTimeframePanel from "@/components/dashboard/StrategyTimeframePanel";
import AdaptiveStrategyPanel from "@/components/dashboard/AdaptiveStrategyPanel";
import CooldownBanner from "@/components/dashboard/CooldownBanner";
import AccountSwitcher from "@/components/dashboard/AccountSwitcher";

export default function Settings() {
  const [s, setS] = useState(null);
  const [connected, setConnected] = useState(false);
  const [botSettings, setBotSettings] = useState(null);
  const [downloadingDocs, setDownloadingDocs] = useState(false);
  const [downloadingExport, setDownloadingExport] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleDownloadDocs = async () => {
    setDownloadingDocs(true);
    try {
      const response = await base44.functions.fetch("/generateSystemDocumentation");
      if (!response.ok) throw new Error("Generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "FloubaElite-System-Documentation.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Documentation Downloaded", description: "Flouba Elite system reference PDF saved.", duration: 3000 });
    } catch (e) {
      toast({ title: "Download Failed", description: e.message || "Could not generate PDF.", variant: "destructive", duration: 4000 });
    }
    setDownloadingDocs(false);
  };

  const handleDownloadExport = async () => {
    setDownloadingExport(true);
    try {
      const response = await base44.functions.fetch("/exportCodebase");
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "FloubaElite-Codebase-Export.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Codebase Exported", description: "Full replication bundle downloaded.", duration: 3000 });
    } catch (e) {
      toast({ title: "Export Failed", description: e.message || "Could not generate export.", variant: "destructive", duration: 4000 });
    }
    setDownloadingExport(false);
  };

  useEffect(() => {
    (async () => {
      const list = await base44.entities.BotSettings.list();
      const rec = list[0] || (await base44.entities.BotSettings.create({}));
      setS(rec);
      setBotSettings(rec);
      setConnected(rec?.mt5_account != null);
    })();
  }, []);

  const set = (k, v) => setS((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    await base44.entities.BotSettings.update(s.id, s);
    toast({ title: "Settings saved", description: "Your bot configuration has been updated." });
  };

  const reload = useCallback(async () => {
    const list = await base44.entities.BotSettings.list();
    if (list?.length) { setS(list[0]); setBotSettings(list[0]); }
  }, []);

  if (!s) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>;

  const num = (key, label) => (
    <div>
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={s[key] ?? ""}
        onChange={(e) => set(key, parseFloat(e.target.value) || 0)}
        className="bg-white/5 border-red-500/20 rounded-xl h-11 mt-1"
      />
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      <MobileHeader title="Bot Settings" subtitle="Tune your robot's behavior and risk." />
      <div className="px-4 sm:px-6 lg:px-8 space-y-4">

        {/* Trading Mode */}
        <GlassCard>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Trading Mode</p>
          <SegmentRow
            label="Mode"
            options={["Conservative", "Balanced", "Aggressive"]}
            value={s.trading_mode || "Balanced"}
            onChange={(v) => set("trading_mode", v)}
          />
          <div className="mt-3 p-3 rounded-xl bg-white/3 border border-white/5">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <span className="text-white font-bold">Conservative</span>: Signal ≥ 85 pts &nbsp;·&nbsp;
              <span className="text-white font-bold">Balanced</span>: Signal ≥ 70 pts &nbsp;·&nbsp;
              <span className="text-white font-bold">Aggressive</span>: Signal ≥ 60 pts
            </p>
          </div>
        </GlassCard>

        {/* Signal Score Breakdown */}
        <GlassCard>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Signal Score Weights</p>
          <div className="space-y-2">
            {[
              { label: "EMA Trend Confirmation", points: 30, color: "bg-green-500" },
              { label: "RSI Confirmation",        points: 25, color: "bg-blue-500" },
              { label: "ATR Volatility",          points: 20, color: "bg-amber-500" },
              { label: "Market Direction",        points: 25, color: "bg-red-500" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground flex-1">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.points}%` }} />
                  </div>
                  <span className="text-xs font-bold text-white w-8 text-right">{item.points}pt</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Lot Size Mode */}
        <GlassCard>
          <SegmentRow label="Lot Size Mode" options={["Fixed", "Auto Risk"]} value={s.lot_size_mode} onChange={(v) => set("lot_size_mode", v)} />
        </GlassCard>

        {/* Risk Controls */}
        <GlassCard className="grid grid-cols-2 gap-3">
          {num("lot_size", "Lot Size")}
          {num("risk_percentage", "Risk %")}
          {num("stop_loss", "Stop Loss (pts)")}
          {num("take_profit", "Take Profit (pts)")}
          {num("stop_after_losses", "Stop After N Losses")}
          {num("daily_profit_target", "Profit Target $")}
          {num("daily_loss_limit", "Loss Limit $")}
        </GlassCard>

        {/* Risk Management Toggles */}
        <GlassCard>
          <ToggleRow label="Break Even" desc="Move SL to entry once in profit" checked={s.break_even} onChange={(v) => set("break_even", v)} />
          <ToggleRow label="Trailing Stop" desc="Lock profits as price moves" checked={s.trailing_stop} onChange={(v) => set("trailing_stop", v)} />
          <ToggleRow label="News Filter" desc="Pause around high-impact news" checked={s.news_filter} onChange={(v) => set("news_filter", v)} />
          <ToggleRow label="London Session" checked={s.london_session} onChange={(v) => set("london_session", v)} />
          <ToggleRow label="New York Session" checked={s.new_york_session} onChange={(v) => set("new_york_session", v)} />
        </GlassCard>

        {/* ── Advanced Panels (moved from dashboard) ── */}

        {/* Account Switcher */}
        <AccountSwitcher botSettings={botSettings} onSwitched={reload} />

        {/* Auto-Start Schedule */}
        <AutoStartButton settings={botSettings} onUpdate={(ns) => { setBotSettings(ns); setS(ns); }} />

        {/* HFT / Danger Mode */}
        <HftModeButton settings={botSettings} onUpdate={(ns) => setBotSettings(ns)} onAutoStart={async () => {
          toast({ title: "Use dashboard", description: "Start HFT mode from the dashboard.", duration: 3000 });
        }} />

        {/* Cooldown Banner */}
        <CooldownBanner settings={botSettings} />

        {/* EMA Indicator */}
        <EmaIndicatorPanel />

        {/* Signal Assistant */}
        <SignalAssistantPanel connected={connected} />

        {/* Dynamic Daily Target */}
        <DynamicDailyTargetPanel />

        {/* Strategy Control */}
        <StrategyControlCard />

        {/* Strategy Timeframe Engine */}
        <StrategyTimeframePanel />

        {/* Adaptive Strategy Manager */}
        <AdaptiveStrategyPanel connected={connected} />

        {/* ── Tools & Resources (moved from Home) ── */}
        <GlassCard className="p-0 overflow-hidden">
          <button onClick={() => navigate("/lsr3r")}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors border-b border-white/5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Radar className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-white">LSR-3R Scanner</p>
              <p className="text-[10px] text-muted-foreground">Liquidity Sweep · CHOCH · FVG</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => navigate("/trade-journal")}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors border-b border-white/5">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-white">Trade Journal</p>
              <p className="text-[10px] text-muted-foreground">Every win &amp; loss with date &amp; time</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={handleDownloadDocs} disabled={downloadingDocs}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors border-b border-white/5 disabled:opacity-60">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
              {downloadingDocs
                ? <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
                : <BookOpen className="w-4 h-4 text-green-400" />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-white">System Docs</p>
              <p className="text-[10px] text-muted-foreground">{downloadingDocs ? "Generating PDF…" : "Full reference — functions, strategies"}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={handleDownloadExport} disabled={downloadingExport}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors disabled:opacity-60">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              {downloadingExport
                ? <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                : <Download className="w-4 h-4 text-cyan-400" />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-white">Code Export</p>
              <p className="text-[10px] text-muted-foreground">{downloadingExport ? "Generating bundle…" : "Schemas, manifest, deploy guide"}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </GlassCard>

        <Button onClick={save} className="w-full h-12 py-3 rounded-2xl bg-red-600 hover:bg-red-500 neon-red font-heading tracking-widest mb-24">
          <Save className="w-4 h-4 mr-2" /> SAVE SETTINGS
        </Button>
      </div>
    </div>
  );
}