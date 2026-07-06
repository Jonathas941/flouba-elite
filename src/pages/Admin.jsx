import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/GlassCard";
import StatTile from "@/components/StatTile";
import { Button } from "@/components/ui/button";
import { Users, Activity, Crown, Shield, Plus } from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [subs, setSubs] = useState([]);
  const [acc, setAcc] = useState("");
  const [keyPlan, setKeyPlan] = useState("Starter");
  const [keyCount, setKeyCount] = useState(1);
  const [keyDays, setKeyDays] = useState(30);
  const [keyEmail, setKeyEmail] = useState("");
  const [genKeys, setGenKeys] = useState([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      setMe(u);
      if (u.role === "admin") {
        setUsers(await base44.entities.User.list());
        setAccounts(await base44.entities.MT5Account.list());
        setTrades(await base44.entities.Trade.list("-created_date", 50));
        setSubs(await base44.entities.Subscription.list());
      }
    })();
  }, []);

  const addAccount = async () => {
    if (!acc.trim()) return;
    const created = await base44.entities.MT5Account.create({ account_number: acc, type: "Live", broker: "Flouba Broker" });
    setAccounts((p) => [...p, created]);
    setAcc("");
    toast({ title: "MT5 account added" });
  };

  const generateKeys = async () => {
    setGenerating(true);
    setGenKeys([]);
    try {
      const res = await base44.functions.invoke("generateSerialKeys", {
        plan: keyPlan,
        count: keyCount,
        duration_days: keyDays,
        email: keyEmail.trim() || undefined,
      });
      const data = res?.data || {};
      if (data.success) {
        setGenKeys(data.keys || []);
        toast({ title: `${(data.keys || []).length} key(s) generated`, description: keyEmail.trim() ? `Emailed to ${keyEmail.trim()}` : "Copy and send to the client." });
      } else {
        toast({ title: "Generation failed", description: data.error || "Could not generate keys.", variant: "destructive" });
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Could not generate keys.";
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copyKey = (k) => {
    navigator.clipboard?.writeText(k).catch(() => {});
    toast({ title: "Copied", description: k, duration: 1500 });
  };

  if (!me) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" /></div>;

  if (me.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-3">
        <Shield className="w-12 h-12 text-red-500" />
        <h2 className="font-heading text-xl text-white">Admin Access Only</h2>
        <p className="text-sm text-muted-foreground">You don't have permission to view this panel.</p>
        <Button onClick={() => navigate("/")} className="rounded-xl bg-red-600 hover:bg-red-500 neon-red mt-2">Back to Dashboard</Button>
      </div>
    );
  }

  const activeSubs = subs.filter((s) => s.status === "Active").length;

  return (
    <div className="max-w-md sm:max-w-2xl lg:max-w-4xl mx-auto pb-12">
      <MobileHeader title="Admin Panel" subtitle="Manage users, accounts and platform activity." onBack={() => navigate("/")} />
      <div className="px-4 space-y-4">

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Users" value={users.length} icon={Users} />
        <StatTile label="Active Subs" value={activeSubs} icon={Crown} accent="text-red-400" />
        <StatTile label="MT5 Accounts" value={accounts.length} icon={Shield} />
        <StatTile label="Trades" value={trades.length} icon={Activity} />
      </div>

      <GlassCard>
        <h3 className="font-heading text-sm uppercase tracking-widest text-white mb-3">Add MT5 Account</h3>
        <div className="flex gap-2">
          <Input value={acc} onChange={(e) => setAcc(e.target.value)} placeholder="Account number" className="bg-white/5 border-red-500/20 rounded-xl h-11" />
          <Button onClick={addAccount} className="rounded-xl bg-red-600 hover:bg-red-500 neon-red h-11"><Plus className="w-4 h-4" /></Button>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="font-heading text-sm uppercase tracking-widest text-white mb-1">Issue Serial Keys</h3>
        <p className="text-[11px] text-muted-foreground mb-3">Generate keys for paid clients. Optionally email them directly.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Plan</label>
            <select value={keyPlan} onChange={(e) => setKeyPlan(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-white/5 border border-red-500/20 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/50">
              {["Starter", "Pro", "Elite"].map((p) => <option key={p} value={p} className="bg-[#0d1117]">{p}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Duration (days)</label>
            <Input type="number" min={1} value={keyDays} onChange={(e) => setKeyDays(Number(e.target.value))} className="bg-white/5 border-red-500/20 rounded-xl h-11" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Count</label>
            <Input type="number" min={1} max={50} value={keyCount} onChange={(e) => setKeyCount(Number(e.target.value))} className="bg-white/5 border-red-500/20 rounded-xl h-11" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Client Email (optional)</label>
            <Input type="email" value={keyEmail} onChange={(e) => setKeyEmail(e.target.value)} placeholder="client@email.com" className="bg-white/5 border-red-500/20 rounded-xl h-11" />
          </div>
        </div>
        <Button onClick={generateKeys} disabled={generating}
          className="w-full h-11 mt-4 rounded-xl bg-red-600 hover:bg-red-700 neon-red font-heading tracking-widest text-xs uppercase disabled:opacity-50">
          {generating ? "Generating…" : "Generate Keys"}
        </Button>
        {genKeys.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Generated Keys</p>
            {genKeys.map((k) => (
              <button key={k} onClick={() => copyKey(k)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-red-500/40 transition-colors">
                <span className="font-mono text-sm text-white tracking-[0.15em]">{k}</span>
                <span className="text-[10px] uppercase tracking-widest text-red-400">Copy</span>
              </button>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="font-heading text-sm uppercase tracking-widest text-white mb-3">Users</h3>
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <p className="text-sm font-semibold text-white">{u.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg ${u.role === "admin" ? "bg-red-500/15 text-red-400" : "bg-white/5 text-muted-foreground"}`}>{u.role}</span>
            </div>
          ))}
        </div>
      </GlassCard>
      </div>
    </div>
  );
}