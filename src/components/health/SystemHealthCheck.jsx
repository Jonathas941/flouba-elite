import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Activity } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { mt5Api } from "@/lib/mt5Api";
import { base44 } from "@/api/base44Client";

const STATUS_STYLE = {
  ok:   { icon: CheckCircle,   color: "text-green-400",  bg: "bg-green-500/10 border-green-500/25" },
  warn: { icon: AlertTriangle, color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/25" },
  fail: { icon: XCircle,       color: "text-red-400",    bg: "bg-red-500/10 border-red-500/25" },
};

function CheckRow({ label, detail, status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.fail;
  const Icon = s.icon;
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${s.bg}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.color}`} />
      <div className="min-w-0">
        <p className="font-heading text-xs font-bold text-white">{label}</p>
        <p className="text-[10px] text-white/40 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

export default function SystemHealthCheck() {
  const [checks, setChecks] = useState(null);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  const runCheck = useCallback(async () => {
    setRunning(true);
    const results = [];

    // Bridge / EA connectivity
    try {
      const res = await mt5Api.status();
      const bridge = res?.data?.bridge;
      const connected = bridge ? bridge.connected === true : (res?.data?.connected ?? false);
      results.push(connected
        ? { label: "MT5 Bridge", status: "ok", detail: `Connected${bridge?.ea_version ? ` · EA v${bridge.ea_version}` : ""}` }
        : { label: "MT5 Bridge", status: "fail", detail: res?.error || "Bridge unreachable or EA offline" });
    } catch (e) {
      results.push({ label: "MT5 Bridge", status: "fail", detail: e.message });
    }

    // Account data
    try {
      const res = await mt5Api.account();
      if (res?.ok && res?.data) {
        const a = res.data;
        results.push({ label: "Account Data", status: "ok", detail: `Balance $${a.balance ?? "--"} · Equity $${a.equity ?? "--"}` });
      } else {
        results.push({ label: "Account Data", status: "fail", detail: res?.error || "No account data returned" });
      }
    } catch (e) {
      results.push({ label: "Account Data", status: "fail", detail: e.message });
    }

    // Positions endpoint
    try {
      const res = await mt5Api.positions();
      results.push(res?.ok
        ? { label: "Open Positions", status: "ok", detail: `${(res.data || []).length} open position(s)` }
        : { label: "Open Positions", status: "fail", detail: res?.error || "Could not fetch positions" });
    } catch (e) {
      results.push({ label: "Open Positions", status: "fail", detail: e.message });
    }

    // Scanner status
    try {
      const res = await mt5Api.scannerStatus();
      const s = res?.data?.scanner;
      if (res?.ok && s) {
        results.push(s.robot_running
          ? { label: "Scanner Engine", status: "ok", detail: `Scanning ${s.symbol} · Score ${s.signal_score ?? 0}/100` }
          : { label: "Scanner Engine", status: "warn", detail: "Robot paused — scanner idle" });
      } else {
        results.push({ label: "Scanner Engine", status: "fail", detail: res?.error || "Scanner unreachable" });
      }
    } catch (e) {
      results.push({ label: "Scanner Engine", status: "fail", detail: e.message });
    }

    // Risk / BotSettings configuration
    try {
      const records = await base44.entities.BotSettings.list();
      const s = records?.[0];
      if (!s) {
        results.push({ label: "Risk Configuration", status: "warn", detail: "No bot settings saved yet" });
      } else {
        const issues = [];
        if (!s.equity_guard_enabled) issues.push("Equity Guard disabled");
        if (!s.daily_loss_limit) issues.push("No daily loss limit set");
        if (!s.stop_loss) issues.push("No stop loss set");
        results.push(issues.length
          ? { label: "Risk Configuration", status: "warn", detail: issues.join(" · ") }
          : { label: "Risk Configuration", status: "ok", detail: `Equity Guard ${s.equity_guard_min_equity_pct}% · Daily Loss Limit $${s.daily_loss_limit}` });
      }
    } catch (e) {
      results.push({ label: "Risk Configuration", status: "fail", detail: e.message });
    }

    setChecks(results);
    setLastRun(new Date());
    setRunning(false);
  }, []);

  // Live auto-refresh — re-run all checks every 10s
  useEffect(() => {
    runCheck();
    const id = setInterval(runCheck, 10000);
    return () => clearInterval(id);
  }, [runCheck]);

  const failCount = checks?.filter((c) => c.status === "fail").length ?? 0;
  const warnCount = checks?.filter((c) => c.status === "warn").length ?? 0;
  const overall = !checks ? null : failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "ok";
  const overallLabel = overall === "ok" ? "ALL SYSTEMS OPERATIONAL" : overall === "warn" ? "MINOR ISSUES DETECTED" : "CRITICAL ISSUES DETECTED";
  const overallColor = overall === "ok" ? "text-green-400" : overall === "warn" ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-3">
      <GlassCard className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className={`font-heading text-xs font-black uppercase tracking-wider ${checks ? overallColor : "text-white/30"}`}>
              {checks ? overallLabel : "Running checks…"}
            </p>
            {lastRun && <p className="text-[9px] text-white/25">Last run {lastRun.toLocaleTimeString()}</p>}
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={runCheck}
          disabled={running}
          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-white/50 ${running ? "animate-spin" : ""}`} />
        </motion.button>
      </GlassCard>

      <div className="space-y-2">
        {(checks || []).map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
            <CheckRow {...c} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}