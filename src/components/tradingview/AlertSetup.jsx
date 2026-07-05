import React, { useState } from "react";
import { motion } from "framer-motion";
import { Copy, CheckCircle2, Send, Loader2 } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { STRATEGY_LIBRARY, ALERT_TEMPLATE } from "@/lib/tradingviewStrategies";

function Step({ num, title, children }) {
  return (
    <GlassCard className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-[10px] font-heading font-black text-cyan-300">{num}</span>
        <span className="text-[11px] font-heading font-bold text-white uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </GlassCard>
  );
}

function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={handle} className="w-full h-9 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-heading font-bold uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition-colors">
      {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> {label}</>}
    </button>
  );
}

export default function AlertSetup({ webhookUrl, onTest, testResult, testing }) {
  return (
    <div>
      <h2 className="font-heading font-black text-sm text-white uppercase tracking-widest mb-3">Alert Setup</h2>
      <div className="space-y-3">
        <Step num={1} title="Select Strategy">
          <p className="text-[10px] text-white/40 leading-relaxed">Activate your strategy in the library above. Only one strategy per symbol can be active at a time.</p>
          <div className="flex flex-wrap gap-1.5">
            {STRATEGY_LIBRARY.map(s => (
              <span key={s.key} className="px-2 py-1 rounded-md bg-black/20 border border-white/10 text-[9px] text-white/50 font-heading">{s.name}</span>
            ))}
          </div>
        </Step>

        <Step num={2} title="Copy Webhook URL">
          <p className="text-[10px] text-white/40 leading-relaxed">Paste this into TradingView → Alert → Webhook URL.</p>
          <div className="rounded-lg bg-black/30 border border-cyan-500/15 px-2.5 py-2 mb-2">
            <p className="text-[9px] text-cyan-300 font-mono break-all leading-snug">{webhookUrl}</p>
          </div>
          <CopyBtn text={webhookUrl} label="Copy Webhook URL" />
        </Step>

        <Step num={3} title="Copy Alert Message Template">
          <p className="text-[10px] text-white/40 leading-relaxed">Replace <code className="text-amber-300">{`{{WEBHOOK_SECRET}}`}</code> with your secret inside TradingView only — never store it in Base44.</p>
          <pre className="rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 mb-2 text-[9px] text-cyan-200 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">{ALERT_TEMPLATE}</pre>
          <CopyBtn text={ALERT_TEMPLATE} label="Copy Template" />
          <p className="text-[9px] text-white/25 leading-relaxed mt-2">SL and TP = 0 → the Replit risk engine calculates them from your strategy settings.</p>
        </Step>

        <Step num={4} title="Test Connection">
          <p className="text-[10px] text-white/40 leading-relaxed">Sends a safe TEST command to Replit. This never creates a real trade.</p>
          <button onClick={onTest} disabled={testing} className="w-full h-10 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-heading font-black uppercase tracking-widest bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50 transition-colors neon-cyan">
            {testing ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing…</> : <><Send className="w-4 h-4" /> Send Safe Test Signal</>}
          </button>
          {testResult && (
            <div className={`rounded-lg px-3 py-2 ${testResult.ok ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
              <p className={`text-[10px] font-heading font-bold ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                {testResult.ok ? "Test signal accepted by Replit." : "Test failed."}
              </p>
              {testResult.error && <p className="text-[9px] text-red-300/70 mt-0.5">{testResult.error}</p>}
              {testResult.data?.message && <p className="text-[9px] text-white/50 mt-0.5">{testResult.data.message}</p>}
            </div>
          )}
        </Step>
      </div>
    </div>
  );
}