import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "How do I start trading with Flouba Elite?",
    a: "Connect your MT5 account via the Connect MT5 page, then press INITIATE ROBOT on the dashboard. The start modal lets you choose your strategy, lot size, risk, and all execution settings before launch.",
  },
  {
    q: "What is the Trade Decision Engine?",
    a: "A 9-pillar confluence gatekeeper that analyzes market structure, trend alignment, pullbacks, liquidity sweeps, ADX strength, RSI momentum, volatility, spread cost, and news safety before any trade is allowed. It outputs TRADE or NO_TRADE with a confidence score.",
  },
  {
    q: "Why does the robot sometimes refuse to trade?",
    a: "Capital protection first. If any pillar fails, spread is too wide, news is imminent, or market conditions are choppy, the robot enters NO_TRADE mode and waits for a high-quality setup. This is by design — trade less, but better.",
  },
  {
    q: "What is Danger Mode (HFT)?",
    a: "An aggressive mode that bypasses all safety limits including daily loss caps. It scalps for any profit and multiplies lot size on every profitable close. Use with extreme caution — it trades live with no waiting.",
  },
  {
    q: "How does the Dynamic Daily Target work?",
    a: "A tiered profit system. After Target 1, risk is reduced by 50% and only A+ setups are taken. After Target 2, trading continues only with strategy scores ≥85. At the final target, all new entries stop immediately.",
  },
  {
    q: "Can the bot trade multiple pairs at once?",
    a: "Yes. Enable Multi-Pair Auto-Select in the start modal and the AI scans all available pairs, auto-selects the best N for concurrent trading based on live spread and volatility data.",
  },
  {
    q: "What is the LSR-3R Scanner?",
    a: "A specialized module that detects Liquidity Sweep, CHOCH (Change of Character), and Fair Value Gap setups on M1/M5 charts with a fixed 1:3 risk-reward ratio. Access it from the dashboard.",
  },
  {
    q: "Does the bot ever increase lot size after a loss?",
    a: "Never. The bot does not chase the market with martingale logic. Lot size only increases after confirmed wins (Win Compounding) or during controlled recovery positions with hard caps.",
  },
  {
    q: "What happens if I lose connection to MT5?",
    a: "The dashboard auto-reconnects after consecutive heartbeat failures. A RECONNECTING banner appears while the link is being restored, and a toast confirms when the connection is back.",
  },
  {
    q: "How do I get a subscription / serial key?",
    a: "Subscriptions are activated via serial keys (Starter, Pro, Elite). Redeem a key on the /redeem page. Only admins can generate new keys from the Admin panel.",
  },
  {
    q: "Where can I see my full trade history?",
    a: "Open the Trade Journal from the dashboard — it shows every closed trade with date, time, pair, direction, and P&L. Detailed statistics are on the Statistics page.",
  },
  {
    q: "What are all the available strategies?",
    a: "10 core strategies: Swing Trend Pullback, SMC Liquidity Sweep, EMA Trend Progressive Recovery, Hybrid Confluence, NQ London Kill Zone, Market Structure BOS Retest, Orderflow Opening Range, Gold Morning Range, Gold Daily Breakout, and Hedge Scalper — plus Auto (AI Select) which picks the best for the current regime.",
  },
];

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div className="hud-clip" style={{ background: "rgba(255,204,66,0.04)", border: "1px solid rgba(255,204,66,0.18)", backdropFilter: "blur(12px)" }}>
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#FFCC42]/10">
        <div className="w-10 h-10 hud-clip-sm flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,204,66,0.1)", border: "1px solid rgba(255,204,66,0.3)" }}>
          <HelpCircle className="w-5 h-5" style={{ color: "#FFCC42" }} />
        </div>
        <div className="flex-1">
          <p className="font-mono font-bold text-sm text-white tracking-[0.1em]">FAQ</p>
          <p className="text-[9px] font-mono text-white/35">Frequently asked questions — tap to expand</p>
        </div>
      </div>

      <div className="divide-y divide-[#FFCC42]/8">
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div key={idx}>
              <button
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FFCC42]/5"
              >
                <span className="font-mono text-[11px] text-white/80 leading-snug">{item.q}</span>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
                  <ChevronDown className="w-3.5 h-3.5 text-[#FFCC42]/60" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 pb-3 text-[10px] font-mono text-white/50 leading-relaxed">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}