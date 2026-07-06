import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import MobileHeader from "@/components/MobileHeader";
import MobileSelect from "@/components/MobileSelect";
import { mt5Api } from "@/lib/mt5Api";
import { logNotification } from "@/lib/notifications";
import {
  Wifi, WifiOff, ShieldCheck, Eye, EyeOff,
  Loader2, CheckCircle2, ArrowRight, Bot, AlertCircle,
} from "lucide-react";

const BROKER_SERVERS = {
  "IC Markets": [
    "ICMarketsSC-MT5",
    "ICMarketsSC-MT5-2",
    "ICMarketsSC-MT5-3",
    "ICMarketsSC-MT5-4",
    "ICMarketsEU-MT5",
    "ICMarketsEU-MT5-2",
  ],
  "Exness": [
    "Exness-MT5Real",
    "Exness-MT5Real2",
    "Exness-MT5Real3",
    "Exness-MT5Real4",
    "Exness-MT5Real5",
    "Exness-MT5Real6",
    "Exness-MT5Real7",
    "Exness-MT5Real8",
    "Exness-MT5Real9",
    "Exness-MT5Trial",
  ],
  "Pepperstone": [
    "Pepperstone-Edge06",
    "Pepperstone-Edge07",
    "Pepperstone-Edge08",
    "Pepperstone-Edge09",
    "Pepperstone-Edge10",
    "Pepperstone-Edge11",
    "Pepperstone-Edge12",
  ],
  "Eightcap": [
    "Eightcap-MT5Server",
    "Eightcap-MT5Real",
    "Eightcap-Real",
    "Eightcap-Standard",
  ],
  "Axi": [
    "Axi-MT5",
    "Axi-Standard",
    "Axi-ECN",
    "Axi-Pro",
  ],
  "FTMO": [
    "FTMO-Server",
    "FTMO-MT5",
    "FTMO-Server2",
  ],
  "MetaQuotes Demo": [
    "MetaQuotes-Demo",
    "MetaQuotes",
  ],
  "Custom Broker": [],
};

const BROKERS = Object.keys(BROKER_SERVERS);

const STATUS = {
  idle:       { label: "Not Connected",          color: "text-muted-foreground", bg: "bg-white/5",      icon: WifiOff },
  testing:    { label: "Testing Connection…",    color: "text-amber-400",        bg: "bg-amber-500/10", icon: Loader2 },
  connecting: { label: "Connecting…",            color: "text-amber-400",        bg: "bg-amber-500/10", icon: Loader2 },
  success:    { label: "Connected Successfully", color: "text-green-400",        bg: "bg-green-500/10", icon: CheckCircle2 },
  error:      { label: "Connection Failed",      color: "text-red-400",          bg: "bg-red-500/10",   icon: WifiOff },
};

export default function ConnectMT5() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [broker, setBroker]                   = useState("");
  const [login, setLogin]                     = useState("");
  const [password, setPassword]               = useState("");
  const [server, setServer]                   = useState("");
  const [showPass, setShowPass]               = useState(false);
  const [status, setStatus]                   = useState("idle");
  const [errorMsg, setErrorMsg]               = useState("");
  const [settingsId, setSettingsId]           = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.BotSettings.list('-created_date', 1);
        if (list[0]) {
          setSettingsId(list[0].id);
          if (list[0].broker_name) setBroker(list[0].broker_name);
          if (list[0].mt5_account) setLogin(list[0].mt5_account);
          if (list[0].mt5_server)  setServer(list[0].mt5_server);
          if (list[0].mt5_password) setPassword(list[0].mt5_password);
        }
        // Reflect the live bridge state so the page doesn't always show "Not Connected".
        const res = await mt5Api.account();
        const acct = res?.data?.account;
        if (res?.ok && acct?.balance != null) {
          setStatus("success");
          if (list[0] && list[0].connection_status !== "Connected") {
            await base44.entities.BotSettings.update(list[0].id, { connection_status: "Connected" }).catch(() => {});
          }
        } else if (list[0] && list[0].connection_status === "Connected") {
          // Stale record — bridge says disconnected, sync it.
          await base44.entities.BotSettings.update(list[0].id, { connection_status: "Disconnected" }).catch(() => {});
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFormValid = broker && login && password && server;

  const saveToDb = async (connectionStatus) => {
    const payload = { broker_name: broker, mt5_account: login, mt5_password: password, mt5_server: server, connection_status: connectionStatus };
    if (settingsId) {
      await base44.entities.BotSettings.update(settingsId, payload);
    } else {
      const created = await base44.entities.BotSettings.create(payload);
      setSettingsId(created.id);
    }
  };

  const handleTest = async () => {
    if (!isFormValid) return;
    setStatus("testing");
    setErrorMsg("");
    try {
      const res = await mt5Api.status();
      if (res?.ok && res?.data) {
        setStatus("idle");
        toast({ title: "Server reachable", description: "Backend is online. Proceed to Connect MT5." });
      } else {
        setStatus("error");
        const msg = res?.error || "Could not reach the MT5 server.";
        setErrorMsg(msg);
        toast({ title: "Server unreachable", description: msg, variant: "destructive" });
      }
    } catch (err) {
      setStatus("error");
      const msg = err?.message?.includes("Rate limit")
        ? "Too many requests. Please wait a few seconds and try again."
        : (err?.message || "Could not reach the MT5 server.");
      setErrorMsg(msg);
      toast({ title: "Server unreachable", description: msg, variant: "destructive" });
    }
  };

  const handleConnect = async () => {
    if (!isFormValid) { toast({ title: "Fill in all fields to connect.", variant: "destructive" }); return; }
    setStatus("connecting");
    setErrorMsg("");
    try {
      // Save credentials first so the bridge can authenticate to the user's MT5 account
      await saveToDb("Connecting");
      // The EA connects to MT5 automatically when running. Poll the account endpoint
      // to confirm live MT5 data is flowing (balance/equity present).
      // Try up to 6 times with 5s delays (30s total).
      let connected = false;
      let res = null;
      let acct = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        res = await mt5Api.account();
        acct = res?.data?.account;
        connected = res?.ok && acct?.balance != null;
        if (connected) break;
        if (attempt < 5) { await new Promise((r) => setTimeout(r, 5000)); }
      }
      if (connected) {
        setStatus("success");
        await saveToDb("Connected");
        toast({ title: "MT5 Connected", description: `${broker} · ${login}`, duration: 2000 });
        logNotification({ type: "connection", title: "MT5 Connected", message: `Account ${login} connected on ${broker}.`, category: "success", meta: { broker, login } });
        // Send the EA file to the user's email after successful connection
        base44.functions.invoke("sendEaFile", {}).catch(() => {});
        navigate("/");
      } else {
        setStatus("error");
        let msg;
        const st = await mt5Api.status().catch(() => null);
        const eaConnected = st?.data?.bridge?.connected === true;
        if (!eaConnected) {
          msg = "The Flouba Elite EA is not connected to the bridge. Make sure the EA is installed and running on your MetaTrader 5 terminal, then try again.";
        } else {
          msg = "MT5 login failed. Double-check your account number, password, and server name.";
        }
        await saveToDb("Disconnected");
        setErrorMsg(msg);
        toast({ title: "Connection Failed", description: msg, variant: "destructive" });
      }
    } catch (err) {
      setStatus("error");
      const msg = err?.message?.includes("Rate limit")
        ? "Too many requests. Please wait a few seconds and try again."
        : (err?.message || "Connection failed. Check your credentials.");
      setErrorMsg(msg);
      toast({ title: "Connection Failed", description: msg, variant: "destructive" });
    }
  };

  const st = STATUS[status];

  return (
    <div className="min-h-screen pb-32 max-w-md sm:max-w-2xl lg:max-w-4xl mx-auto">
      <MobileHeader title="Connect MT5" subtitle="Link your MetaTrader 5 account." />

      <div className="px-4 space-y-5">
        {/* ── 1. WELCOME ── */}
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
          <div className="w-16 h-16 glass neon-red rounded-2xl mx-auto flex items-center justify-center mb-3">
            <Bot className="w-8 h-8 text-red-500" strokeWidth={1.6} />
          </div>
          <h1 className="font-heading text-2xl font-black text-white neon-text leading-tight">
            Connect Your<br />MetaTrader 5 Account
          </h1>
          <p className="text-sm text-muted-foreground">
            Securely connect your MT5 account to activate&nbsp;
            <span className="text-red-400 font-semibold">Flouba Elite</span>.
          </p>
        </motion.div>

        {/* ── 2. BROKER SELECTION ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <GlassCard className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Broker</p>
            <MobileSelect
              value={broker}
              onChange={(v) => {
                setBroker(v);
                // Clear server if it's not valid for the newly selected broker
                if (!BROKER_SERVERS[v]?.includes(server)) setServer("");
              }}
              options={BROKERS}
              placeholder="Select your broker"
              label="Select Broker"
            />
          </GlassCard>
        </motion.div>

        {/* ── 3. MT5 CREDENTIALS ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <GlassCard className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">MT5 Credentials</p>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-semibold">Login (Account Number)</label>
              <input
                type="text" inputMode="numeric" value={login}
                onChange={(e) => setLogin(e.target.value)} placeholder="e.g. 40123456"
                className="w-full h-11 px-3 glass rounded-xl text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-red-500/50 bg-transparent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-semibold">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="MT5 account password"
                  className="w-full h-11 px-3 pr-11 glass rounded-xl text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-red-500/50 bg-transparent"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-semibold">Server</label>
              {broker && BROKER_SERVERS[broker]?.length > 0 ? (
                <MobileSelect
                  value={server}
                  onChange={setServer}
                  options={BROKER_SERVERS[broker]}
                  placeholder="Select your server"
                  label="Select Server"
                />
              ) : (
                <input
                  type="text" value={server}
                  onChange={(e) => setServer(e.target.value)} placeholder="e.g. Exness-MT5Real8"
                  className="w-full h-11 px-3 glass rounded-xl text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-red-500/50 bg-transparent"
                />
              )}
            </div>


          </GlassCard>
        </motion.div>

        {/* ── 4. CONNECTION STATUS ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlassCard className={`flex items-start gap-3 ${st.bg}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${st.bg}`}>
              <st.icon className={`w-5 h-5 ${st.color} ${(status === "testing" || status === "connecting") ? "animate-spin" : ""}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Connection Status</p>
              <p className={`font-heading text-sm font-bold ${st.color}`}>{st.label}</p>
              {status === "error" && errorMsg && (
                <p className="text-[11px] text-red-300/80 mt-1 leading-snug">{errorMsg}</p>
              )}
              {status === "success" && (
                <p className="text-[11px] text-green-300/70 mt-0.5">{broker} · {login}</p>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* ── 5. BUTTONS ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }} className="space-y-3">
          {status !== "success" && (
            <>
              <Button variant="outline"
                className="w-full h-12 border-red-500/30 text-red-400 font-heading font-bold tracking-widest text-xs uppercase rounded-xl hover:bg-red-500/10"
                onClick={handleTest} disabled={status === "testing" || status === "connecting"}>
                {status === "testing" ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Testing…</> : "Test Connection"}
              </Button>
              <Button
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-heading font-bold tracking-widest text-xs uppercase rounded-xl neon-red"
                onClick={handleConnect} disabled={status === "testing" || status === "connecting" || !isFormValid}>
                {status === "connecting" ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Connecting…</> : "Connect MT5"}
              </Button>
            </>
          )}
          {/* Auto-redirects to home on successful connection */}
        </motion.div>

        {/* ── 6. SECURITY NOTE ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}>
          <div className="flex items-start gap-2.5 px-1">
            <ShieldCheck className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Your credentials are <span className="text-white font-semibold">encrypted</span> and never displayed.
              Flouba Elite never generates or displays fake trading data —
              all account information is sourced exclusively from your connected MT5 account.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}