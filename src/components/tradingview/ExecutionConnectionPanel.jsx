import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import { Shield, Eye, EyeOff, Plus, Check, Loader2, ExternalLink, AlertTriangle, Building2 } from "lucide-react";

export default function ExecutionConnectionPanel({ connection, onSaved }) {
  const { toast } = useToast();
  const [providerType, setProviderType] = useState(connection?.provider_type || "oanda");
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [ctraderAccounts, setCtraderAccounts] = useState([]);
  const [selectingAccount, setSelectingAccount] = useState(false);
  const [error, setError] = useState("");

  // OANDA form
  const [oandaForm, setOandaForm] = useState({
    provider_name: "",
    api_base_url: "",
    encrypted_api_key: "",
    encrypted_api_secret: "",
    account_id: "",
    environment: "test",
  });

  // cTrader form
  const [ctraderForm, setCtraderForm] = useState({
    provider_name: "IC Markets cTrader",
    environment: "demo",
    client_id: "",
    client_secret: "",
  });

  const redirectUri = `${window.location.origin}/tradingview`;

  // Sync from connection
  useEffect(() => {
    if (connection) {
      setProviderType(connection.provider_type || "oanda");
      if (connection.provider_type === "ctrader") {
        setCtraderForm({
          provider_name: connection.provider_name || "IC Markets cTrader",
          environment: connection.environment || "demo",
          client_id: connection.client_id || "",
          client_secret: "",
        });
      } else {
        setOandaForm({
          provider_name: connection.provider_name || "",
          api_base_url: connection.api_base_url || "",
          encrypted_api_key: connection.encrypted_api_key || "",
          encrypted_api_secret: connection.encrypted_api_secret || "",
          account_id: connection.account_id || "",
          environment: connection.environment || "test",
        });
      }
    }
  }, [connection]);

  // ── OAuth callback detection ──
  const handleCtraderCallback = useCallback(async (code) => {
    setOauthLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("ctraderOAuth", {
        action: "callback",
        code,
        redirect_uri: redirectUri,
      });
      if (res?.success) {
        setCtraderAccounts(res.accounts || []);
        setSelectingAccount(true);
        toast({ title: "Authorized", description: "Select your cTrader account." });
      } else {
        setError(res?.message || "OAuth callback failed");
        toast({ title: "OAuth failed", description: res?.message, variant: "destructive" });
      }
    } catch (err) {
      setError(err.message);
      toast({ title: "OAuth failed", description: err.message, variant: "destructive" });
    } finally {
      setOauthLoading(false);
    }
  }, [redirectUri, toast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthError = params.get("error");
    if (code) {
      handleCtraderCallback(code);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthError) {
      setError(`cTrader authorization error: ${oauthError}`);
    }
  }, [handleCtraderCallback]);

  // ── OANDA save ──
  const handleSaveOanda = async () => {
    if (!oandaForm.provider_name || !oandaForm.api_base_url || !oandaForm.encrypted_api_key) {
      toast({ title: "Missing fields", description: "Broker name, API base URL, and API key are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        provider_type: "oanda",
        provider_name: oandaForm.provider_name,
        api_base_url: oandaForm.api_base_url,
        encrypted_api_key: oandaForm.encrypted_api_key,
        encrypted_api_secret: oandaForm.encrypted_api_secret,
        account_id: oandaForm.account_id,
        environment: oandaForm.environment,
        connection_status: "Connected",
      };
      if (connection?.id) {
        await base44.entities.TradingExecutionConnection.update(connection.id, payload);
      } else {
        await base44.entities.TradingExecutionConnection.create(payload);
      }
      toast({ title: "Connected", description: `${oandaForm.provider_name} execution API is now ready.` });
      onSaved?.();
      setExpanded(false);
    } catch (err) {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── cTrader connect (start OAuth) ──
  const handleConnectCtrader = async () => {
    if (!ctraderForm.client_id || !ctraderForm.client_secret) {
      toast({ title: "Missing fields", description: "Client ID and Client Secret are required.", variant: "destructive" });
      return;
    }
    setOauthLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("ctraderOAuth", {
        action: "auth",
        client_id: ctraderForm.client_id,
        client_secret: ctraderForm.client_secret,
        redirect_uri: redirectUri,
        environment: ctraderForm.environment,
        provider_name: ctraderForm.provider_name,
      });
      if (res?.success && res.auth_url) {
        window.location.href = res.auth_url;
      } else {
        setError(res?.message || "Failed to start OAuth");
        toast({ title: "Failed", description: res?.message, variant: "destructive" });
      }
    } catch (err) {
      setError(err.message);
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setOauthLoading(false);
    }
  };

  // ── cTrader account selection ──
  const handleSelectAccount = async (accountId) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("ctraderOAuth", {
        action: "select_account",
        account_id: accountId,
      });
      if (res?.success) {
        toast({ title: "Connected", description: "cTrader account connected successfully." });
        setSelectingAccount(false);
        setCtraderAccounts([]);
        onSaved?.();
      } else {
        toast({ title: "Failed", description: res?.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Disconnect ──
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
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const connected = connection?.connection_status === "Connected";
  const statusLabel = connection?.connection_status === "Disconnected" ? "Not Connected" : (connection?.connection_status || "Not Connected");

  const statusColor = (status) => {
    if (status === "Connected") return "text-[#00FF41] bg-[#00FF41]/10";
    if (status === "Authorization Required") return "text-yellow-400 bg-yellow-400/10";
    if (status === "Token Expired") return "text-orange-400 bg-orange-400/10";
    if (status === "Account Not Found") return "text-blue-400 bg-blue-400/10";
    if (status === "Demo/Live Mismatch") return "text-purple-400 bg-purple-400/10";
    if (status === "Connection Error") return "text-[#FF3131] bg-[#FF3131]/10";
    return "text-[#FF3131] bg-[#FF3131]/10";
  };

  return (
    <GlassCard className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-heading font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" /> Execution API
        </h2>
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusColor(connection?.connection_status)}`}>
          {statusLabel}
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 bg-[#FF3131]/10 border border-[#FF3131]/30 rounded-lg p-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-[#FF3131] mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-white/80">{error}</p>
        </div>
      )}

      {/* OAuth loading */}
      {oauthLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-[#00FF41] animate-spin" />
          <span className="ml-2 text-[11px] text-white/60">Authenticating with cTrader…</span>
        </div>
      )}

      {/* Connected view */}
      {connected && !selectingAccount && !oauthLoading ? (
        <div className="space-y-2">
          <div className="bg-black/30 rounded-lg p-3 border border-white/5 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-white/30">Provider</span>
              <span className="text-white/80 font-bold uppercase">{connection.provider_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Broker</span>
              <span className="text-white/60">{connection.provider_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/30">Environment</span>
              <span className="text-white/60 uppercase">{connection.environment}</span>
            </div>
            {connection.provider_type === "ctrader" ? (
              <div className="flex justify-between">
                <span className="text-white/30">cTrader Account</span>
                <span className="text-white/60">{connection.ctrader_account_id}</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-white/30">Account</span>
                <span className="text-white/60">{connection.account_id || "—"}</span>
              </div>
            )}
          </div>
          <Button onClick={handleDisconnect} variant="outline" size="sm" className="w-full border-[#FF3131]/20 text-[#FF3131]/80 hover:bg-[#FF3131]/5">
            Disconnect
          </Button>
        </div>
      ) : !oauthLoading && !selectingAccount ? (
        <div className="space-y-3">
          {/* Provider selector */}
          {!connection && (
            <div>
              <Label className="text-[11px] text-white/70 mb-2 block">Provider</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setProviderType("oanda")}
                  className={`py-2 rounded-lg text-[11px] font-bold transition-all ${
                    providerType === "oanda"
                      ? "bg-[#00FF41]/15 text-[#00FF41] border border-[#00FF41]/40"
                      : "bg-black/30 text-white/40 border border-white/5"
                  }`}
                >
                  OANDA
                </button>
                <button
                  onClick={() => setProviderType("ctrader")}
                  className={`py-2 rounded-lg text-[11px] font-bold transition-all ${
                    providerType === "ctrader"
                      ? "bg-[#FF3131]/15 text-[#FF3131] border border-[#FF3131]/40"
                      : "bg-black/30 text-white/40 border border-white/5"
                  }`}
                >
                  cTrader
                </button>
              </div>
            </div>
          )}

          {/* OANDA form */}
          {providerType === "oanda" && (
            <div className="space-y-3">
              {!expanded && !connection ? (
                <Button onClick={() => setExpanded(true)} size="sm" className="w-full bg-[#FF3131]/10 border border-[#FF3131]/30 text-[#FF3131] hover:bg-[#FF3131]/20">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add OANDA Connection
                </Button>
              ) : (
                <>
                  <div>
                    <Label className="text-[11px] text-white/70 mb-1 block">Broker Name</Label>
                    <Input value={oandaForm.provider_name} onChange={(e) => setOandaForm(p => ({ ...p, provider_name: e.target.value }))} placeholder="OANDA" className="bg-black/40 border-white/10 text-white text-[11px] h-9" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-white/70 mb-1 block">API Base URL</Label>
                    <Input value={oandaForm.api_base_url} onChange={(e) => setOandaForm(p => ({ ...p, api_base_url: e.target.value }))} placeholder="https://api-fxtrade.oanda.com" className="bg-black/40 border-white/10 text-white text-[11px] h-9 font-mono" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-white/70 mb-1 block">API Key</Label>
                    <div className="relative">
                      <Input type={showKeys ? "text" : "password"} value={oandaForm.encrypted_api_key} onChange={(e) => setOandaForm(p => ({ ...p, encrypted_api_key: e.target.value }))} placeholder="API key" className="bg-black/40 border-white/10 text-white text-[11px] h-9 pr-8" />
                      <button type="button" onClick={() => setShowKeys(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60">
                        {showKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-white/70 mb-1 block">API Secret</Label>
                    <Input type={showKeys ? "text" : "password"} value={oandaForm.encrypted_api_secret} onChange={(e) => setOandaForm(p => ({ ...p, encrypted_api_secret: e.target.value }))} placeholder="API secret" className="bg-black/40 border-white/10 text-white text-[11px] h-9" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-white/70 mb-1 block">Account ID</Label>
                    <Input value={oandaForm.account_id} onChange={(e) => setOandaForm(p => ({ ...p, account_id: e.target.value }))} placeholder="001-001-123456-001" className="bg-black/40 border-white/10 text-white text-[11px] h-9" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-white/70 mb-2 block">Environment</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setOandaForm(p => ({ ...p, environment: "test" }))} className={`py-2 rounded-lg text-[11px] font-bold ${oandaForm.environment === "test" ? "bg-[#00FF41]/15 text-[#00FF41] border border-[#00FF41]/40" : "bg-black/30 text-white/40 border border-white/5"}`}>Test</button>
                      <button onClick={() => setOandaForm(p => ({ ...p, environment: "live" }))} className={`py-2 rounded-lg text-[11px] font-bold ${oandaForm.environment === "live" ? "bg-[#FF3131]/15 text-[#FF3131] border border-[#FF3131]/40" : "bg-black/30 text-white/40 border border-white/5"}`}>Live</button>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {expanded && !connection && (
                      <Button onClick={() => setExpanded(false)} variant="outline" size="sm" className="flex-1 border-white/10 text-white/50">Cancel</Button>
                    )}
                    <Button onClick={handleSaveOanda} disabled={saving} size="sm" className="flex-1 bg-[#FF3131] hover:bg-[#FF3131]/80 text-white">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />} Connect
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* cTrader form */}
          {providerType === "ctrader" && (
            <div className="space-y-3">
              <div>
                <Label className="text-[11px] text-white/70 mb-1 block">Broker Name</Label>
                <Input value={ctraderForm.provider_name} onChange={(e) => setCtraderForm(p => ({ ...p, provider_name: e.target.value }))} placeholder="IC Markets cTrader" className="bg-black/40 border-white/10 text-white text-[11px] h-9" />
              </div>
              <div>
                <Label className="text-[11px] text-white/70 mb-2 block">Environment</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setCtraderForm(p => ({ ...p, environment: "demo" }))} className={`py-2 rounded-lg text-[11px] font-bold ${ctraderForm.environment === "demo" ? "bg-[#00FF41]/15 text-[#00FF41] border border-[#00FF41]/40" : "bg-black/30 text-white/40 border border-white/5"}`}>Demo</button>
                  <button onClick={() => setCtraderForm(p => ({ ...p, environment: "live" }))} className={`py-2 rounded-lg text-[11px] font-bold ${ctraderForm.environment === "live" ? "bg-[#FF3131]/15 text-[#FF3131] border border-[#FF3131]/40" : "bg-black/30 text-white/40 border border-white/5"}`}>Live</button>
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-white/70 mb-1 block">cTrader Client ID</Label>
                <Input value={ctraderForm.client_id} onChange={(e) => setCtraderForm(p => ({ ...p, client_id: e.target.value }))} placeholder="Your cTrader Open API client ID" className="bg-black/40 border-white/10 text-white text-[11px] h-9" />
              </div>
              <div>
                <Label className="text-[11px] text-white/70 mb-1 block">cTrader Client Secret</Label>
                <Input type={showKeys ? "text" : "password"} value={ctraderForm.client_secret} onChange={(e) => setCtraderForm(p => ({ ...p, client_secret: e.target.value }))} placeholder="Your cTrader Open API client secret" className="bg-black/40 border-white/10 text-white text-[11px] h-9 pr-8" />
                <button type="button" onClick={() => setShowKeys(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60" style={{ marginTop: "8px" }}>
                  {showKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="bg-black/30 rounded-lg p-2.5 border border-white/5">
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">OAuth Redirect URL (auto-generated)</p>
                <p className="text-[10px] text-[#00FF41] font-mono break-all">{redirectUri}</p>
              </div>
              <Button onClick={handleConnectCtrader} disabled={oauthLoading} size="sm" className="w-full bg-[#FF3131] hover:bg-[#FF3131]/80 text-white">
                {oauthLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <ExternalLink className="w-3.5 h-3.5 mr-1" />} Connect cTrader Account
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {/* Account selection */}
      {selectingAccount && !oauthLoading && (
        <div className="space-y-2">
          <p className="text-[11px] text-white/60 mb-2">Select your IC Markets cTrader account:</p>
          {ctraderAccounts.length === 0 ? (
            <p className="text-[11px] text-white/40 text-center py-3">No accounts found. Please check your cTrader application.</p>
          ) : (
            ctraderAccounts.map((acct, i) => (
              <button
                key={i}
                onClick={() => handleSelectAccount(acct.accountId || acct.account_id || acct.id)}
                disabled={saving}
                className="w-full flex items-center justify-between bg-black/30 border border-white/5 rounded-lg p-3 hover:border-[#00FF41]/30 transition-all text-left"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-white/40" />
                  <div>
                    <p className="text-[11px] text-white/80 font-bold">{acct.brokerName || acct.broker_name || "cTrader Account"}</p>
                    <p className="text-[10px] text-white/40">Account #{acct.accountId || acct.account_id || acct.id}</p>
                  </div>
                </div>
                <Check className="w-3.5 h-3.5 text-white/20" />
              </button>
            ))
          )}
          <Button onClick={() => setSelectingAccount(false)} variant="outline" size="sm" className="w-full border-white/10 text-white/50 mt-2">
            Cancel
          </Button>
        </div>
      )}

      {/* Last error */}
      {connection?.last_connection_error && !connected && (
        <p className="text-[9px] text-[#FF3131]/60 italic">Error: {connection.last_connection_error}</p>
      )}
    </GlassCard>
  );
}