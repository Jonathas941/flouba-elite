/**
 * Flouba Elite — MT5 API Client
 * All calls go through the mt5Bridge backend function so the token stays server-side.
 */
import { base44 } from "@/api/base44Client";

async function call(action, params = {}) {
  const res = await base44.functions.invoke("mt5Bridge", { action, ...params });
  return res.data; // { ok, status, data }
}

export const mt5Api = {
  /** Live account info: balance, equity, margin, etc. */
  account: () => call("account"),

  /** Open positions array */
  positions: () => call("positions"),

  /** Server/bridge status (no auth needed) */
  status: () => call("status"),

  /** Start the robot */
  robotStart: (symbol, settings = {}) => call("robot_start", { symbol, ...settings }),

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

  /** Scanner status */
  scannerStatus: () => call("scanner_status"),
};