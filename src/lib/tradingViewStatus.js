// Status mapping for TradingView signals.
// Old statuses (set by the webhook) are mapped to the new display labels.
// "Accepted" = signal validated/queued but trade NOT yet open.
// "Open" = trade is actually open on MT5.

const STATUS_COLORS = {
  Accepted: "text-[#00FF41] bg-[#00FF41]/10",
  Queued: "text-blue-400 bg-blue-400/10",
  Executing: "text-cyan-400 bg-cyan-400/10",
  Open: "text-[#00FF41] bg-[#00FF41]/10",
  "Partially Open": "text-amber-400 bg-amber-400/10",
  Rejected: "text-orange-400 bg-orange-400/10",
  "Reconciliation Required": "text-[#FF3131] bg-[#FF3131]/10",
};

// Map old webhook statuses to the new display labels.
const STATUS_MAP = {
  Received: "Queued",
  Validated: "Accepted",
  Simulated: "Accepted",
  Executed: "Open",
  Partial: "Partially Open",
  Error: "Rejected",
  Rejected: "Rejected",
  // New statuses pass through
  Accepted: "Accepted",
  Queued: "Queued",
  Executing: "Executing",
  Open: "Open",
  "Partially Open": "Partially Open",
  "Reconciliation Required": "Reconciliation Required",
};

export function mapStatus(rawStatus) {
  return STATUS_MAP[rawStatus] || "Queued";
}

export function statusColor(rawStatus) {
  const mapped = mapStatus(rawStatus);
  return STATUS_COLORS[mapped] || "text-white/40 bg-white/5";
}

// "Accepted" means the signal was accepted but the trade is NOT open yet.
// Only "Open" and "Partially Open" mean a trade is actually live.
export function isTradeOpen(rawStatus) {
  const mapped = mapStatus(rawStatus);
  return mapped === "Open" || mapped === "Partially Open";
}

export function isAccepted(rawStatus) {
  return mapStatus(rawStatus) === "Accepted";
}

export function isRejected(rawStatus) {
  return mapStatus(rawStatus) === "Rejected";
}

// Count today's accepted signals (Accepted, Queued, Executing, Open, Partially Open)
// but NOT "trade opened" — Accepted is a pre-execution state.
export function isAcceptedToday(rawStatus) {
  const mapped = mapStatus(rawStatus);
  return ["Accepted", "Queued", "Executing", "Open", "Partially Open"].includes(mapped);
}