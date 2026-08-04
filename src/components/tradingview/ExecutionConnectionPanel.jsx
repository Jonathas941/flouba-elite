import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import GlassCard from "@/components/GlassCard";
import { Shield, Eye, EyeOff, Plus, Check, Loader2 } from "lucide-react";

export default function ExecutionConnectionPanel({ connection, onSaved }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [form, setForm] = useState({
    provider_name: "",
    api_base_url: "",
    encrypted_api_key: "",
    encrypted_api_secret: "",
    account_id: "",
    environment: "test",
    connection_status: "Disconnected",
  });

  useEffect(() => {
    if (connection) {
      setForm({
        provider_name: connection.provider_name || "",
        api_base_url: connection.api_base_url || "",
        encrypted_api_key: connection.encrypted_api_key || "",
        encrypted_api_secret: connection.encrypted_api_secret || "",
        account_id: connection.account_id || "",
        environment: connection.environment || "test",
        connection_status: connection.connection_status || "Disconnected",
      });
    }
  }, [connection]);

  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!form.provider_name || !form.api_base_url || !form.encrypted_api_key) {
      toast({
        title: "Missing fields",
        description: "Broker name, API base URL, and API key are required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        provider_name: form.provider_name,
        api_base_url: form.api_base_url,
        encrypted_api_key: form.encrypted_api_key,
        encrypted_api_secret: form.encrypted_api_secret,
        account_id: form.account_id,
        environment: form.environment,
        connection_status: "Connected",
      };

      if (connection?.id) {
        await base44.entities.TradingExecutionConnection.update(connection.id, payload);
      } else {
        await base44.entities.TradingExecutionConnection.create(payload);
      }

      toast({
        title: "Connected",
        description: `${form.provider_name} execution API is now ready.`,
      });
      onSaved?.();
      setExpanded(false);
    } catch (err) {
      toast({
        title: "Connection failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection?.id) return;
    setSaving(true);
    try {
      await base44.entities.TradingExecutionConnection.update(connection.id, {
        connection_status: "Disconnected",
      });
      toast({ title: "Disconnected", description: "Execution API disconnected." });
      onSaved?.();
    } catch (err) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const connected = connection?.connection_status === "Connected";

  return (
    <GlassCard className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" /> Execution API
        </h2>
        <span
          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
            connected
              ? "text-[#00FF41] bg-[#00FF41]/10"
              : "text-[#FF3131] bg-[#FF3131]/10"
          }`}
        >
          {connected ? "Connected" : "Not Connected"}
        </span>
      </div>

      {connected ? (
        <div className="space-y-2">
          <div className="bg-black/30 rounded-lg p-3 border border-white/5 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-white/30">Broker</span>
              <span className="text-white/80 font-bold">{connection.provider_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Environment</span>
              <span className="text-white/60 uppercase">{connection.environment}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Account</span>
              <span className="text-white/60">{connection.account_id || "—"}</span>
            </div>
          </div>
          <Button
            onClick={handleDisconnect}
            variant="outline"
            size="sm"
            className="w-full border-[#FF3131]/20 text-[#FF3131]/80 hover:bg-[#FF3131]/5"
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {!expanded ? (
            <Button
              onClick={() => setExpanded(true)}
              size="sm"
              className="w-full bg-[#FF3131]/10 border border-[#FF3131]/30 text-[#FF3131] hover:bg-[#FF3131]/20"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Broker Connection
            </Button>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-[11px] text-white/70 mb-1 block">Broker Name</Label>
                <Input
                  value={form.provider_name}
                  onChange={(e) => update("provider_name", e.target.value)}
                  placeholder="OANDA, Alpaca, Tradovate…"
                  className="bg-black/40 border-white/10 text-white text-[11px] h-9"
                />
              </div>
              <div>
                <Label className="text-[11px] text-white/70 mb-1 block">API Base URL</Label>
                <Input
                  value={form.api_base_url}
                  onChange={(e) => update("api_base_url", e.target.value)}
                  placeholder="https://api-fxtrade.oanda.com"
                  className="bg-black/40 border-white/10 text-white text-[11px] h-9 font-mono"
                />
              </div>
              <div>
                <Label className="text-[11px] text-white/70 mb-1 block">API Key</Label>
                <div className="relative">
                  <Input
                    type={showKeys ? "text" : "password"}
                    value={form.encrypted_api_key}
                    onChange={(e) => update("encrypted_api_key", e.target.value)}
                    placeholder="Your broker API key"
                    className="bg-black/40 border-white/10 text-white text-[11px] h-9 pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                  >
                    {showKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-white/70 mb-1 block">API Secret</Label>
                <Input
                  type={showKeys ? "text" : "password"}
                  value={form.encrypted_api_secret}
                  onChange={(e) => update("encrypted_api_secret", e.target.value)}
                  placeholder="Your broker API secret"
                  className="bg-black/40 border-white/10 text-white text-[11px] h-9"
                />
              </div>
              <div>
                <Label className="text-[11px] text-white/70 mb-1 block">Account ID</Label>
                <Input
                  value={form.account_id}
                  onChange={(e) => update("account_id", e.target.value)}
                  placeholder="001-001-123456-001"
                  className="bg-black/40 border-white/10 text-white text-[11px] h-9"
                />
              </div>
              <div>
                <Label className="text-[11px] text-white/70 mb-2 block">Environment</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => update("environment", "test")}
                    className={`py-2 rounded-lg text-[11px] font-bold transition-all ${
                      form.environment === "test"
                        ? "bg-[#00FF41]/15 text-[#00FF41] border border-[#00FF41]/40"
                        : "bg-black/30 text-white/40 border border-white/5"
                    }`}
                  >
                    Test
                  </button>
                  <button
                    onClick={() => update("environment", "live")}
                    className={`py-2 rounded-lg text-[11px] font-bold transition-all ${
                      form.environment === "live"
                        ? "bg-[#FF3131]/15 text-[#FF3131] border border-[#FF3131]/40"
                        : "bg-black/30 text-white/40 border border-white/5"
                    }`}
                  >
                    Live
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => setExpanded(false)}
                  variant="outline"
                  size="sm"
                  className="flex-1 border-white/10 text-white/50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  size="sm"
                  className="flex-1 bg-[#FF3131] hover:bg-[#FF3131]/80 text-white"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  )}
                  Connect
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}