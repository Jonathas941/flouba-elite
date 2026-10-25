import React, { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import { Webhook, Copy, Eye, EyeOff, RefreshCw, AlertTriangle, Zap, WifiOff } from "lucide-react";

const WEBHOOK_URL = "https://flouba-elite-trade.base44.app/api/apps/6a437ad84dc8721fedd64296/functions/tradingViewWebhook";

export default function WebhookSetupCard({ settings, onUpdateField, onSave, saving, onRegenerateSecret }) {
  const { toast } = useToast();
  const [showSecret, setShowSecret] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showLiveWarning, setShowLiveWarning] = useState(false);

  const secret = settings.webhook_secret || "";
  const maskedSecret = secret ? "••••••••••••••••" : "Not set";

  const copy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    });
  };

  const handleLiveMode = () => {
    if (settings.trading_mode === "live") {
      onUpdateField("trading_mode", "test");
    } else {
      setShowLiveWarning(true);
    }
  };

  const confirmRegenerate = async () => {
    setShowRegenConfirm(false);
    await onRegenerateSecret();
  };

  return (
    <GlassCard className="p-4 space-y-4">
      <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
        <Webhook className="w-3.5 h-3.5" /> Webhook Setup
      </h2>

      {/* Webhook URL */}
      <div className="space-y-2">
        <p className="text-[10px] text-white/30 uppercase tracking-wider">Live Webhook URL</p>
        <div className="bg-black/40 rounded-lg p-3 border border-white/5">
          <p className="text-[11px] text-[#00FF41] font-mono break-all leading-relaxed">{WEBHOOK_URL}</p>
        </div>
        <Button
          onClick={() => copy(WEBHOOK_URL, "Webhook URL")}
          className="w-full bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
          size="sm"
        >
          <Copy className="w-3.5 h-3.5 mr-2" /> Copy URL
        </Button>
        <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-yellow-400/80">
            Do not use the preview-sandbox URL for live trading. Always use the URL above.
          </p>
        </div>
      </div>

      {/* Webhook Secret */}
      <div className="space-y-2">
        <p className="text-[10px] text-white/30 uppercase tracking-wider">Webhook Secret</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-black/40 rounded-lg px-3 py-2 border border-white/5">
            <p className="text-[11px] text-white/70 font-mono">{showSecret ? secret : maskedSecret}</p>
          </div>
          <Button
            onClick={() => setShowSecret(!showSecret)}
            variant="outline"
            size="sm"
            className="border-white/10 text-white/60"
          >
            {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
          <Button
            onClick={() => copy(secret, "Webhook secret")}
            variant="outline"
            size="sm"
            className="border-white/10 text-white/60"
            disabled={!secret}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            onClick={() => setShowRegenConfirm(true)}
            variant="outline"
            size="sm"
            className="border-white/10 text-white/60"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Regenerate Confirmation */}
      {showRegenConfirm && (
        <div className="bg-[#FF3131]/10 border border-[#FF3131]/30 rounded-lg p-3 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#FF3131] mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-white/80">
              Regenerating the secret will invalidate the current one. The secret in your Gold Scalper inputs must be updated, then the TradingView alert recreated.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowRegenConfirm(false)}
              variant="outline"
              size="sm"
              className="flex-1 border-white/10 text-white/60"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRegenerate}
              size="sm"
              className="flex-1 bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
            >
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {/* Auto Trading */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm text-white">Auto Trading</Label>
          <p className="text-[10px] text-white/30">Enable to execute alerts as trades</p>
        </div>
        <Switch
          checked={settings.auto_trading_enabled}
          onCheckedChange={(v) => onUpdateField("auto_trading_enabled", v)}
        />
      </div>

      {/* Trading Mode */}
      <div>
        <Label className="text-sm text-white mb-2 block">Trading Mode</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onUpdateField("trading_mode", "test")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all ${
              settings.trading_mode === "test"
                ? "bg-[#00FF41]/15 text-[#00FF41] border border-[#00FF41]/40"
                : "bg-black/30 text-white/40 border border-white/5"
            }`}
          >
            <WifiOff className="w-3 h-3" /> Test Mode
          </button>
          <button
            onClick={handleLiveMode}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all ${
              settings.trading_mode === "live"
                ? "bg-[#FF3131]/15 text-[#FF3131] border border-[#FF3131]/40"
                : "bg-black/30 text-white/40 border border-white/5"
            }`}
          >
            <Zap className="w-3 h-3" /> Live Mode
          </button>
        </div>
        {showLiveWarning && (
          <div className="mt-2 bg-[#FF3131]/10 border border-[#FF3131]/30 rounded-lg p-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FF3131] mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-white/80">
                Live Mode will execute real orders received from TradingView. In test mode, signals are validated and saved but never sent to Replit.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowLiveWarning(false)}
                variant="outline"
                size="sm"
                className="flex-1 border-white/10 text-white/60"
              >
                Cancel
              </Button>
              <Button
                onClick={() => { onUpdateField("trading_mode", "live"); setShowLiveWarning(false); }}
                size="sm"
                className="flex-1 bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
              >
                Activate Live
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Action Permissions */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "BUY", field: "allow_buy" },
          { label: "SELL", field: "allow_sell" },
          { label: "CLOSE", field: "allow_close" },
        ].map(({ label, field }) => (
          <div key={field} className="bg-black/30 rounded-lg p-2.5 border border-white/5 flex flex-col items-center gap-1.5">
            <p className="text-[9px] text-white/30 uppercase tracking-wider">{label}</p>
            <Switch
              checked={settings[field] ?? true}
              onCheckedChange={(v) => onUpdateField(field, v)}
            />
          </div>
        ))}
      </div>

      {/* Allowed Symbols */}
      <div>
        <Label className="text-sm text-white mb-1 block">Allowed Symbols</Label>
        <Input
          value={settings.allowed_symbols || "XAUUSD"}
          onChange={(e) => onUpdateField("allowed_symbols", e.target.value)}
          className="bg-black/40 border-white/10 text-white"
          placeholder="XAUUSD, EURUSD"
        />
      </div>

      <Button
        onClick={onSave}
        disabled={saving}
        className="w-full bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
      >
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </GlassCard>
  );
}