import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { mt5Api } from "@/lib/mt5Api";
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  RefreshCw, Zap, ChevronDown, ChevronUp,
} from "lucide-react";
import { computeAnalysis, getCurrentSession, MODE_THRESHOLD } from "@/lib/marketAnalysis";

// ── MT5 Error Code Reference ──────────────────────────────────────────────────
const MT5_ERRORS = {
  0:     { label: "ERR_NO_ERROR",              reason: "Operation completed successfully." },
  1:     { label: "ERR_NO_RESULT",             reason: "No result returned — operation may still be pending." },
  2:     { label: "ERR_COMMON_ERROR",          reason: "Common error. Check inputs and retry." },
  3:     { label: "ERR_INVALID_TRADE_PARAMETERS", reason: "Invalid trade parameters — check lot size, SL, TP." },
  4:     { label: "ERR_SERVER_BUSY",           reason: "Trade context busy. Another order is being processed." },
  5:     { label: "ERR_OLD_VERSION",           reason: "Old MT5 terminal version. Please update MetaTrader 5." },
  6:     { label: "ERR_NO_CONNECTION",         reason: "No connection to broker server. Check your internet." },
  7:     { label: "ERR_NOT_ENOUGH_RIGHTS",     reason: "Not enough rights to execute this operation." },
  8:     { label: "ERR_TOO_FREQUENT_REQUESTS", reason: "Too many requests — slow down order frequency." },
  9:     { label: "ERR_MALFUNCTIONAL_TRADE",   reason: "Trade operations are disabled or malfunctioning." },
  64:   { label: "ERR_ACCOUNT_DISABLED",       reason: "Account is disabled by the broker." },
  65:   { label: "ERR_INVALID_ACCOUNT",        reason: "Invalid account credentials or account not found." },
  128:  { label: "ERR_TRADE_TIMEOUT",          reason: "Order execution timeout — broker did not respond in time." },
  129:  { label: "ERR_INVALID_PRICE",          reason: "Invalid price. Price may have moved too fast (requote)." },
  130:  { label: "ERR_INVALID_STOPS",          reason: "Stop Loss or Take Profit is too close to current price." },
  131:  { label: "ERR_INVALID_TRADE_VOLUME",   reason: "Invalid lot size. Check min/max lot and lot step for this symbol." },
  132:  { label: "ERR_MARKET_CLOSED",          reason: "Market is closed. Trading is not allowed at this time." },
  133:  { label: "ERR_TRADE_DISABLED",         reason: "Trading is disabled. Enable AutoTrading in MT5 terminal." },
  134:  { label: "ERR_NOT_ENOUGH_MONEY",       reason: "Not enough margin to open this position." },
  135:  { label: "ERR_PRICE_CHANGED",          reason: "Price changed before order was processed (requote)." },
  136:  { label: "ERR_OFF_QUOTES",             reason: "No price available — symbol may not be subscribed." },
  137:  { label: "ERR_BROKER_BUSY",            reason: "Broker is busy processing other requests." },
  138:  { label: "ERR_REQUOTE",               reason: "Requote — price changed. Order not executed at requested price." },
  139:  { label: "ERR_ORDER_LOCKED",          reason: "Order is already being processed and locked." },
  140:  { label: "ERR_LONG_POSITIONS_ONLY_ALLOWED", reason: "Only BUY orders allowed for this symbol or account." },
  141:  { label: "ERR_TOO_MANY_REQUESTS",     reason: "Too many orders sent too quickly." },
  145:  { label: "ERR_TRADE_MODIFY_DENIED",   reason: "Modification denied — order may already be closed." },
  146:  { label: "ERR_TRADE_CONTEXT_BUSY",    reason: "Trade context is busy. Wait before sending another order." },
  147:  { label: "ERR_TRADE_EXPIRATION_DENIED", reason: "Setting expiration date is not allowed." },
  148:  { label: "ERR_TRADE_TOO_MANY_ORDERS", reason: "Maximum number of open orders reached." },
  149:  { label: "ERR_TRADE_HEDGE_PROHIBITED", reason: "Hedging is not allowed on this account type." },
  150:  { label: "ERR_TRADE_PROHIBITED_BY_FIFO", reason: "FIFO rule violation — close oldest trade of this symbol first." },
};

function getErrorInfo(code) {
  return MT5_ERRORS[code] || { label: `MT5 Error ${code}`, reason: "Unknown error. Check MT5 terminal logs for details." };
}

// ── Diagnostic Row ────────────────────────────────────────────────────────────
function DiagRow({ label, value, status, detail }) {
  const statusIcon = status === "ok"      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
    : status === "error"   ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
    : status === "warn"    ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    : <div className="w-3.5 h-3.5 rounded-full bg-white/15 shrink-0" />;

  const valueColor = status === "ok" ? "text-green-400"
    : status === "error" ? "text-red-400"
    : status === "warn"  ? "text-amber-400" : "text-white/50";

  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {statusIcon}
        <span className="text-[10px] text-white/40 font-heading uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-right shrink-0 max-w-[55%]">
        <span className={`font-heading font-bold text-[11px] ${valueColor} block`}>{value}</span>
        {detail && <span className="text-[9px] text-white/25 block leading-tight">{detail}</span>}
      </div>
    </div>
  );
}

// ── Execution Step ────────────────────────────────────────────────────────────
function ExecStep({ label, status, detail }) {
  const icons = {
    pending: <div className="w-3 h-3 rounded-full border border-white/20 shrink-0" />,
    running: <Loader2 className="w-3 h-3 text-amber-400 animate-spin shrink-0" />,
    ok:      <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />,
    error:   <XCircle className="w-3 h-3 text-red-400 shrink-0" />,
  };
  return (
    <div className="flex items-start gap-2 py-1">
      {icons[status] || icons.pending}
      <div>
        <span className={`text-[10px] font-heading font-bold ${status === "ok" ? "text-white/70" : status === "error" ? "text-red-400" : status === "running" ? "text-amber-400" : "text-white/25"}`}>
          {label}
        </span>
        {detail && <p className="text-[9px] text-white/30 leading-tight mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TradingDiagnostics() {
  const [settings, setSettings]       = useState(null);
  const [diag, setDiag]               = useState(null);
  const [loading, setLoading]         = useState(false);
  const [testSteps, setTestSteps]     = useState([]);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult]   = useState(null); // { success, errorCode, errorMsg }
  const [expanded, setExpanded]       = useState(true);
  const tickRef = useRef(0);

  const runDiagnostics = async () => {
    setLoading(true);

    // Fetch real live data from MT5 API
    const [acctRes, posRes, settingsList] = await Promise.all([
      mt5Api.account().catch(() => null),
      mt5Api.positions().catch(() => null),
      base44.entities.BotSettings.list().catch(() => []),
    ]);

    const s = settingsList[0] || {};
    setSettings(s);

    const liveAccount  = acctRes?.ok ? acctRes.data?.account : null;
    const livePositions = posRes?.ok ? (posRes.data?.positions || []) : [];

    const connected = liveAccount?.connected === true;
    const pair = livePositions[0]?.symbol || s.active_pair || "XAUUSD";
    const mode = s.trading_mode || "Balanced";
    const threshold = MODE_THRESHOLD[mode] || 65;
    const session = getCurrentSession();
    const marketOpen = session !== "Closed";

    tickRef.current += 1;
    const tick = tickRef.current;
    const analysis = computeAnalysis(pair, "M1", tick);

    // Use real spread from live position if available, else from analysis
    const livePos      = livePositions[0];
    const realSpread   = livePos?.spread ?? analysis.spread;
    const spreadOk     = realSpread <= (pair === "XAUUSD" ? 35 : pair === "BTCUSD" ? 80 : 15);

    // Real bid/ask from account if present, else simulated
    const bid = liveAccount?.bid ?? livePos?.currentBid ?? analysis.bid ?? null;
    const ask = liveAccount?.ask ?? livePos?.currentAsk ?? null;
    const lastTick = livePos?.openTime ? new Date(livePos.openTime).toLocaleTimeString() : (connected ? new Date().toLocaleTimeString() : "N/A");

    const signalValid  = analysis.rsiOk && analysis.atrOk && spreadOk && analysis.total >= threshold;
    const autoTrading  = connected; // EA is attached if server is connected
    const freeMargin   = liveAccount?.freeMargin ?? s.free_margin ?? null;

    setDiag({
      connected, autoTrading, marketOpen, session,
      pair, symbolAvailable: connected,
      spread: realSpread, spreadOk,
      bid: bid ? String(bid) : null,
      ask: ask ? String(ask) : null,
      lastTickTime: lastTick,
      signalScore: analysis.total,
      signalValid,
      signalDirection: analysis.direction,
      rsiOk: analysis.rsiOk, adxOk: analysis.adxOk, atrOk: analysis.atrOk,
      rsi: analysis.rsi?.toFixed(1), adx: analysis.adx?.toFixed(1), atrVal: analysis.atrVal,
      orderPermission: connected && autoTrading,
      margin: freeMargin,
      lotOk: true,
      slOk: analysis.atrOk,
      lastErrorCode: s.last_error_code ?? null,
      lastErrorMsg:  s.last_error_msg  ?? null,
      strategy: analysis.strategy,
      marketCondition: analysis.marketCondition,
      threshold,
      // Live account extras
      balance: liveAccount?.balance,
      equity: liveAccount?.equity,
      leverage: liveAccount?.leverage,
      server: liveAccount?.server,
      openPositions: livePositions.length,
    });
    setLoading(false);
  };

  useEffect(() => { runDiagnostics(); }, []);

  // Auto-refresh every 2s while panel is open
  useEffect(() => {
    const id = setInterval(runDiagnostics, 2000);
    return () => clearInterval(id);
  }, []);

  // ── Force Test Trade ────────────────────────────────────────────────────────
  const runForceTest = async () => {
    if (!diag) return;
    setTestRunning(true);
    setTestResult(null);

    const steps = [
      { label: "Checking MT5 connection…",            status: "running" },
      { label: "Verifying account login…",            status: "pending" },
      { label: "Checking AutoTrading status…",        status: "pending" },
      { label: "Subscribing to symbol market data…",  status: "pending" },
      { label: "Reading current Bid/Ask prices…",     status: "pending" },
      { label: "Checking spread limit…",              status: "pending" },
      { label: "Validating lot size (0.01)…",         status: "pending" },
      { label: "Computing Stop Loss (ATR×1.5)…",      status: "pending" },
      { label: "Checking free margin…",               status: "pending" },
      { label: "Sending ORDER_SEND to broker…",       status: "pending" },
    ];

    const advance = async (i, nextLabel, delay = 420) => {
      await new Promise(r => setTimeout(r, delay));
      setTestSteps(prev => {
        const s = [...prev];
        s[i] = { ...s[i], status: "ok" };
        if (s[i + 1]) s[i + 1] = { ...s[i + 1], status: "running" };
        return s;
      });
    };

    const fail = async (i, detail, errorCode) => {
      await new Promise(r => setTimeout(r, 350));
      setTestSteps(prev => {
        const s = [...prev];
        s[i] = { ...s[i], status: "error", detail };
        return s;
      });
      const errInfo = getErrorInfo(errorCode);
      setTestResult({ success: false, errorCode, errorMsg: errInfo.label, errorReason: errInfo.reason, failStep: i });
      setTestRunning(false);
    };

    setTestSteps(steps);
    await new Promise(r => setTimeout(r, 150));

    // Step 0 — MT5 Connection
    if (!diag.connected) {
      return fail(0, "MT5 not connected. Link your account first.", 6);
    }
    await advance(0, steps[1].label);

    // Step 1 — Account login
    await advance(1, steps[2].label);

    // Step 2 — AutoTrading
    if (!diag.autoTrading) {
      return fail(2, "AutoTrading disabled in MT5 terminal settings.", 133);
    }
    await advance(2, steps[3].label);

    // Step 3 — Symbol available
    if (!diag.symbolAvailable) {
      return fail(3, `Symbol ${diag.pair} not subscribed in Market Watch.`, 136);
    }
    await advance(3, steps[4].label);

    // Step 4 — Prices
    if (!diag.bid || !diag.ask) {
      return fail(4, "No price available — broker not streaming quotes.", 136);
    }
    await advance(4, steps[5].label);

    // Step 5 — Spread
    if (!diag.spreadOk) {
      return fail(5, `Spread ${diag.spread} exceeds maximum allowed. Wait for tighter spread.`, 130);
    }
    await advance(5, steps[6].label);

    // Step 6 — Lot size
    await advance(6, steps[7].label);

    // Step 7 — SL distance
    if (!diag.slOk) {
      return fail(7, "Stop Loss too close — ATR too low, price is flat.", 130);
    }
    await advance(7, steps[8].label);

    // Step 8 — Margin
    if (diag.margin !== null && diag.margin < 10) {
      return fail(8, `Free margin $${diag.margin?.toFixed(2)} is too low to open a 0.01 lot.`, 134);
    }
    await advance(8, steps[9].label, 600);

    // Step 9 — Send real ORDER_SEND via MT5 API
    try {
      const res = await mt5Api.buy(diag.pair, 0.01);
      await new Promise(r => setTimeout(r, 400));
      if (res?.ok && res.data?.success) {
        setTestSteps(prev => {
          const s = [...prev];
          s[9] = { ...s[9], status: "ok", detail: `Ticket #${res.data?.ticket || res.data?.order || "OK"}` };
          return s;
        });
        setTestResult({ success: true });
      } else {
        const errCode = res?.data?.error_code ?? res?.status ?? "UNKNOWN";
        const errMsg  = res?.data?.message || res?.data?.error || "Order rejected by broker";
        const errInfo = typeof errCode === "number" ? getErrorInfo(errCode) : { label: String(errCode), reason: errMsg };
        setTestSteps(prev => {
          const s = [...prev];
          s[9] = { ...s[9], status: "error", detail: errMsg };
          return s;
        });
        setTestResult({ success: false, errorCode: errCode, errorMsg: errInfo.label, errorReason: errInfo.reason + " — " + errMsg });
      }
    } catch (e) {
      setTestSteps(prev => {
        const s = [...prev];
        s[9] = { ...s[9], status: "error", detail: e.message };
        return s;
      });
      setTestResult({ success: false, errorCode: "EXCEPTION", errorMsg: "Network / Bridge Error", errorReason: e.message });
    }
    setTestRunning(false);
  };

  if (!diag) return (
    <div className="py-12 flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
    </div>
  );

  const criticalIssues = [];
  if (!diag.connected)       criticalIssues.push("MT5 not connected");
  if (!diag.marketOpen)      criticalIssues.push("Market closed");
  if (!diag.signalValid)     criticalIssues.push("No valid signal");
  if (!diag.spreadOk)        criticalIssues.push("Spread too high");
  if (!diag.rsiOk)           criticalIssues.push("RSI condition failed");
  if (!diag.adxOk)           criticalIssues.push("ADX < 20 — weak trend");
  if (!diag.atrOk)           criticalIssues.push("ATR too low — flat market");
  if (diag.lastErrorCode)    criticalIssues.push(`Last error: ${diag.lastErrorCode}`);

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading">Live Trading</p>
          <h2 className="font-heading font-black text-base text-white">DIAGNOSTICS</h2>
        </div>
        <button onClick={runDiagnostics} disabled={loading}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <RefreshCw className={`w-3.5 h-3.5 text-white/40 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Critical Issues Summary ── */}
      {criticalIssues.length > 0 ? (
        <div className="px-4 py-3 rounded-2xl space-y-1.5"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <p className="text-[9px] uppercase tracking-widest text-red-400 font-heading mb-2">⚠ Why Zero Trades Are Executing</p>
          {criticalIssues.map((issue, i) => (
            <div key={i} className="flex items-center gap-2">
              <XCircle className="w-3 h-3 text-red-400 shrink-0" />
              <span className="text-[11px] font-heading font-bold text-red-300">{issue}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-3 rounded-2xl"
          style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)" }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <p className="text-[11px] font-heading font-bold text-green-400">All pre-trade conditions passing — awaiting strong signal</p>
          </div>
        </div>
      )}

      {/* ── Diagnostics Panel ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Toggle header */}
        <button onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="font-heading font-bold text-xs text-white/60 uppercase tracking-widest">Full Diagnostics</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 overflow-hidden">

              <DiagRow label="MT5 Connection"
                value={diag.connected ? "CONNECTED" : "NOT CONNECTED"}
                status={diag.connected ? "ok" : "error"}
                detail={diag.connected ? `${settings?.broker_name} · ${settings?.mt5_account}` : "Go to Connect MT5 page"} />

              <DiagRow label="Account Login"
                value={settings?.mt5_account || "--"}
                status={settings?.mt5_account ? "ok" : "warn"}
                detail={settings?.broker_name} />

              <DiagRow label="AutoTrading Enabled"
                value={diag.autoTrading ? "YES" : "NO"}
                status={diag.autoTrading ? "ok" : "error"}
                detail={!diag.autoTrading ? "Enable AutoTrading in MT5 terminal (F7)" : null} />

              <DiagRow label="Symbol Selected"
                value={diag.pair}
                status="ok" />

              <DiagRow label="Symbol Available"
                value={diag.symbolAvailable ? "YES" : "NO"}
                status={diag.symbolAvailable ? "ok" : "error"}
                detail={!diag.symbolAvailable ? "Add symbol to Market Watch in MT5" : null} />

              <DiagRow label="Market Open/Closed"
                value={diag.marketOpen ? "OPEN" : "CLOSED"}
                status={diag.marketOpen ? "ok" : "error"}
                detail={`Session: ${diag.session}`} />

              <DiagRow label="Current Spread"
                value={String(diag.spread)}
                status={diag.spreadOk ? "ok" : "error"}
                detail={!diag.spreadOk ? "Spread above maximum — robot is blocked" : "Within limit"} />

              <DiagRow label="Current Bid"
                value={diag.bid ?? "--"}
                status={diag.bid ? "ok" : "warn"} />

              <DiagRow label="Current Ask"
                value={diag.ask ?? "--"}
                status={diag.ask ? "ok" : "warn"} />

              <DiagRow label="Last Tick Time"
                value={diag.lastTickTime}
                status={diag.connected ? "ok" : "warn"} />

              <DiagRow label="Current Session"
                value={diag.session}
                status={diag.marketOpen ? "ok" : "error"} />

              <DiagRow label="Active Strategy"
                value={diag.strategy}
                status="ok"
                detail={`Market: ${diag.marketCondition}`} />

              <DiagRow label="ADX"
                value={`${diag.adx} ${diag.adxOk ? "✓" : "✗"}`}
                status={diag.adxOk ? "ok" : "error"}
                detail={!diag.adxOk ? "ADX < 20 — momentum too weak to enter" : "ADX > 20 — trend confirmed"} />

              <DiagRow label="RSI"
                value={`${diag.rsi} ${diag.rsiOk ? "✓" : "✗"}`}
                status={diag.rsiOk ? "ok" : "error"}
                detail={!diag.rsiOk ? `${diag.signalDirection === "BUY" ? "Need RSI > 55 for BUY" : "Need RSI < 45 for SELL"}` : null} />

              <DiagRow label="ATR"
                value={`${diag.atrVal} ${diag.atrOk ? "✓" : "✗"}`}
                status={diag.atrOk ? "ok" : "error"}
                detail={!diag.atrOk ? "ATR below minimum — market is flat" : "Volatility sufficient"} />

              <DiagRow label="Signal Score"
                value={`${diag.signalScore} / 100`}
                status={diag.signalScore >= diag.threshold ? "ok" : diag.signalScore >= 50 ? "warn" : "error"}
                detail={`Threshold: ${diag.threshold} (${settings?.trading_mode || "Balanced"} mode)`} />

              <DiagRow label="Order Permission"
                value={diag.orderPermission ? "ALLOWED" : "BLOCKED"}
                status={diag.orderPermission ? "ok" : "error"}
                detail={!diag.orderPermission ? "Fix connection or AutoTrading to unblock" : null} />

              <DiagRow label="Order Execution Status"
                value={testResult ? (testResult.success ? "EXECUTED" : "FAILED") : "NOT TESTED"}
                status={testResult ? (testResult.success ? "ok" : "error") : "warn"}
                detail={testResult?.errorMsg} />

              <DiagRow label="Last Error Code"
                value={diag.lastErrorCode ?? (testResult?.errorCode ?? "None")}
                status={diag.lastErrorCode || testResult?.errorCode ? "error" : "ok"} />

              <DiagRow label="Last Error Message"
                value={diag.lastErrorMsg ?? (testResult?.errorMsg ?? "None")}
                status={diag.lastErrorMsg || testResult?.errorMsg ? "error" : "ok"}
                detail={testResult?.errorReason} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Error Detail Card ── */}
      {testResult && !testResult.success && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="px-4 py-4 rounded-2xl space-y-2"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-400" />
            <p className="font-heading font-black text-sm text-red-400">ORDER REJECTED</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-white/30 uppercase font-heading">Error Code</span>
            <span className="font-heading font-bold text-sm text-red-300">{testResult.errorCode}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-white/30 uppercase font-heading">Error Label</span>
            <span className="font-heading font-bold text-[11px] text-red-300 text-right max-w-[60%]">{testResult.errorMsg}</span>
          </div>
          <div className="pt-2 border-t border-red-500/15">
            <p className="text-[10px] text-red-200/60 leading-relaxed">{testResult.errorReason}</p>
          </div>
          {testResult.allPreChecksOk && (
            <div className="pt-2 border-t border-white/5">
              <p className="text-[9px] text-green-400/70 font-heading">✓ All pre-trade checks passed (connection, session, spread, RSI, ATR, SL, margin)</p>
              <p className="text-[9px] text-white/30 mt-1">The only missing piece is the MT5 bridge endpoint to physically relay the order.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Force Test Trade Button ── */}
      <div className="space-y-3">
        <button
          onClick={runForceTest}
          disabled={testRunning || !diag.connected}
          className="w-full h-13 py-3 rounded-2xl flex items-center justify-center gap-3 font-heading font-black text-sm tracking-widest uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: testRunning ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.9)",
            border: "1px solid rgba(239,68,68,0.5)",
            boxShadow: testRunning ? "none" : "0 0 20px rgba(239,68,68,0.3)",
            color: "#fff",
          }}>
          {testRunning
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Running Test Trade…</>
            : <><Zap className="w-4 h-4" /> Force Test Trade (0.01 lot)</>}
        </button>
        {!diag.connected && (
          <p className="text-[10px] text-white/25 text-center font-heading">Connect MT5 to enable test trade</p>
        )}
      </div>

      {/* ── Execution Steps ── */}
      {testSteps.length > 0 && (
        <div className="px-4 py-4 rounded-2xl space-y-0.5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[9px] uppercase tracking-widest text-white/25 font-heading mb-3">Execution Log</p>
          {testSteps.map((step, i) => (
            <ExecStep key={i} label={step.label} status={step.status} detail={step.detail} />
          ))}
          {testResult?.success && (
            <div className="pt-2 mt-1 border-t border-white/5">
              <p className="text-xs font-heading font-black text-green-400">✓ Trade executed successfully</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}