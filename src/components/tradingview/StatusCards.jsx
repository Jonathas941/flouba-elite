import React from "react";
import { motion } from "framer-motion";
import { Copy, CheckCircle2, AlertCircle, Radio, Server, Activity, Zap } from "lucide-react";
import GlassCard from "@/components/GlassCard";

function StatusPill({ status, ok }) {
  const map = {
    connected: { label: "Connected", cls: "text-green-400 bg-green-500/10", icon: CheckCircle2 },
    waiting: { label: "Waiting for Signal", cls: "text-amber-400 bg-amber-500/10", icon: Radio },
    error: { label: "Error", cls: "text-red-400 bg-red-500/10", icon: AlertCircle },
    online: { label: "Online", cls: "text-green-400 bg-green-500/10", icon: CheckCircle2 },
    offline: { label: "Offline", cls: "text-red-400 bg-red-500/10", icon: AlertCircle },
  };
  const s = map[status] || map.waiting;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-heading font-bold ${s.cls}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-white/40 font-body">{label}</span>
      <span className="text-[11px] text-white/90 font-heading font-semibold text-right truncate max-w-[60%]">{value || "—"}</span>
    </div>
  );
}

export default function StatusCards({ data, onCopyWebhook }) {
  const st = data?.status || {};
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(data?.webhookUrl || "").catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    onCopyWebhook?.();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* 1. TradingView Webhook Status */}
      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-heading">TradingView Webhook</span>
          </div>
          <StatusPill status={st.webhook_status || (data?.connected ? "connected" : "waiting")} />
        </div>
        <div className="rounded-lg bg-black/30 border border-cyan-500/15 px-2.5 py-2">
          <p className="text-[9px] text-white/30 mb-0.5 font-body">Webhook Endpoint</p>
          <p className="text-[10px] text-cyan-300 font-mono break-all leading-snug">{data?.webhookUrl || "—"}</p>
        </div>
        <button onClick={handleCopy} className="w-full h-9 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-heading font-bold uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition-colors">
          {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy Webhook URL</>}
        </button>
        <p className="text-[9px] text-white/25 leading-relaxed">Use this endpoint in TradingView Alert Webhook URL.</p>
      </GlassCard>

      {/* 2. MT5 Bridge Status */}
      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-heading">MT5 Bridge</span>
          </div>
          <StatusPill status={st.bridge_status || (data?.connected ? "online" : "offline")} />
        </div>
        <Row label="Account" value={data?.account?.masked} />
        <Row label="Broker" value={data?.account?.broker} />
        <Row label="Server" value={data?.account?.server} />
        <Row label="Last Heartbeat" value={st.bridge_last_seen || st.last_heartbeat} />
        <Row label="Pending Commands" value={st.pending_commands} />
      </GlassCard>

      {/* 3. Signal Activity */}
      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-heading">Signal Activity</span>
          </div>
        </div>
        <Row label="Last Signal" value={st.last_signal?.received_at} />
        <Row label="Strategy" value={st.last_signal?.strategy} />
        <Row label="Symbol" value={st.last_signal?.symbol} />
        <Row label="Direction" value={st.last_signal?.action} />
        <Row label="Timeframe" value={st.last_signal?.timeframe} />
        <div className="pt-1">
          {st.last_signal?.validation === "Accepted" ? (
            <StatusPill status="connected" />
          ) : st.last_signal?.validation === "Rejected" ? (
            <div className="space-y-1">
              <StatusPill status="error" />
              {st.last_signal?.rejection_reason && <p className="text-[9px] text-red-300/70">{st.last_signal.rejection_reason}</p>}
            </div>
          ) : (
            <StatusPill status="waiting" />
          )}
        </div>
      </GlassCard>

      {/* 4. Execution Result */}
      <GlassCard className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-heading">Execution Result</span>
          </div>
        </div>
        <Row label="Command ID" value={st.execution?.command_id} />
        <Row label="MT5 Status" value={st.execution?.mt5_status} />
        <Row label="Entry Price" value={st.execution?.entry_price} />
        <Row label="Stop Loss" value={st.execution?.stop_loss} />
        <Row label="Take Profit" value={st.execution?.take_profit} />
        <Row label="Ticket" value={st.execution?.ticket} />
        {st.execution?.error_message && <p className="text-[9px] text-red-300/70">{st.execution.error_message}</p>}
      </GlassCard>
    </div>
  );
}