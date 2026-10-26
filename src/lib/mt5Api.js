/**
 * Flouba Elite — MT5 API Client
 * All calls go through the mt5Bridge backend function so the token stays server-side.
 */
import { base44 } from "@/api/base44Client";

// Read-only actions are shared: many widgets ask for the same account /
// positions / scanner data at once. Identical requests in flight share one
// call, and a result is reused for CACHE_MS. Each backend call costs credits
// and bursts of parallel calls get rejected (HTTP 500) by the platform.
// Trading actions (buy, sell, close, robot_start...) are NEVER cached.
const READ_ACTIONS = new Set([
  "account", "positions", "status", "robot_status", "symbols", "scanner_status",
  "indicators", "history", "detect", "rates", "tv_feed",
  "risk_get", "risk_status",
]);
const CACHE_MS = 60000;
const _inflight = new Map();
const _cache = new Map();

async function rawCall(action, params) {
  const res = await base44.functions.invoke("mt5Bridge", { action, ...params });
  return res.data; // { ok, status, data }
}

async function call(action, params = {}) {
  if (!READ_ACTIONS.has(action)) {
    _cache.clear(); // a trade changes account/positions: next reads are fresh
    return rawCall(action, params);
  }
  const key = action + "|" + JSON.stringify(params);
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.v;
  if (_inflight.has(key)) return _inflight.get(key);
  const p = rawCall(action, params)
    .then((v) => { _cache.set(key, { t: Date.now(), v }); return v; })
    .finally(() => _inflight.delete(key));
  _inflight.set(key, p);
  return p;
}

export const mt5Api = {
  /** Explicitly initiate MT5 terminal login with stored credentials */
  connect: () => call("connect"),

  /** Live account info: balance, equity, margin, etc. */
  account: () => call("account"),

  /** Auto-detect account info from the EA (broker, login, server) */
  detect: () => call("detect"),

  /** Open positions array */
  positions: () => call("positions"),

  /** Server/bridge status (no auth needed) */
  status: () => call("status"),

  /** Start the robot */
  robotStart: (symbol, settings = {}) => call("robot_start", { symbol, strategy: settings.strategy, ...settings }),

  /** Force-start: bypass autonomous robot (BASE44_ONLY) and trade directly */
  forceStart: (symbol, settings = {}) => call("force_start", { symbol, ...settings }),

  /** Reconcile a stale entry slot on the backend */
  reconcile: () => call("reconcile"),

  /** Stop the robot */
  robotStop: () => call("robot_stop"),

  /** Get robot current status */
  robotStatus: () => call("robot_status"),

  /** Open a BUY order */
  buy: (symbol, volume = 0.01, sl = null, tp = null) =>
    call("buy", { symbol, volume, ...(sl ? { sl } : {}), ...(tp ? { tp } : {}) }),

  /** Open a SELL order */
  sell: (symbol, volume = 0.01, sl = null, tp = null) =>
    call("sell", { symbol, volume, ...(sl ? { sl } : {}), ...(tp ? { tp } : {}) }),

  /** Close a specific position by ticket */
  close: (ticket, volume = null) =>
    call("close", { ticket, ...(volume ? { volume } : {}) }),

  /** Close all open positions */
  closeAll: () => call("close_all"),

  /** Trade history (closed trades from MT5) */
  history: (limit = 50) => call("history", { limit }),

  /** Live symbol quotes (bid/ask) from the MT5 terminal */
  quotes: () => call("symbols"),

  /** Scanner status */
  scannerStatus: () => call("scanner_status"),

  /** TradingView signal feed from the Replit server */
  tvFeed: () => call("tv_feed"),

  /** Risk & Kill Switch */
  riskGet: () => call("risk_get"),
  riskSet: (limits) => call("risk_set", limits),
  riskStatus: () => call("risk_status"),
  riskKill: () => call("risk_kill"),
  riskResume: () => call("risk_resume"),

  /** Telegram notifications */
  telegramSet: (chatId) => call("telegram_set", { chat_id: chatId }),
  telegramTest: () => call("telegram_test"),

  /** Re-provision the user's bridge key (auto-recovery on 401) */
  reprovision: () => rawCall("reprovision"),
};