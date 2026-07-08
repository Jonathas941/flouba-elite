import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Plus, Check, Wallet, Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function AccountSwitcher({ botSettings, onSwitched }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);

  const loadAccounts = useCallback(async () => {
    try {
      const list = await base44.entities.TradingAccount.list("-created_date");
      // ── Migration: if the user already has credentials in BotSettings but no
      // TradingAccount records yet, seed one automatically so the switcher works. ──
      if (!list?.length && botSettings?.mt5_account) {
        const migrated = await base44.entities.TradingAccount.create({
          account_number: botSettings.mt5_account,
          broker_name: botSettings.broker_name || "Custom Broker",
          server: botSettings.mt5_server || "",
          password: botSettings.mt5_password || "",
          nickname: "",
          is_active: true,
        }).catch(() => null);
        if (migrated) { setAccounts([migrated]); }
        else { setAccounts([]); }
      } else {
        setAccounts(list || []);
      }
    } catch {
      setAccounts([]);
    }
    setLoading(false);
  }, [botSettings]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentAccountNumber = botSettings?.mt5_account;
  const activeAccount =
    accounts.find((a) => a.account_number === currentAccountNumber) ||
    accounts.find((a) => a.is_active) ||
    accounts[0];

  const handleSwitch = async (account) => {
    if (switching) return;
    if (account.account_number === currentAccountNumber) { setOpen(false); return; }
    setSwitching(true);
    try {
      // Mark selected as active, all others inactive
      await base44.entities.TradingAccount.bulkUpdate(
        accounts.map((a) => ({ id: a.id, is_active: a.id === account.id }))
      );
      // Push credentials into BotSettings so the bridge uses the new account
      const settings = await base44.entities.BotSettings.list("-created_date", 1);
      if (settings?.length) {
        await base44.entities.BotSettings.update(settings[0].id, {
          mt5_account: account.account_number,
          mt5_password: account.password,
          mt5_server: account.server,
          broker_name: account.broker_name,
          connection_status: "Disconnected",
        });
      }
      setAccounts((prev) => prev.map((a) => ({ ...a, is_active: a.id === account.id })));
      setOpen(false);
      toast({
        title: "Account Switched",
        description: `${account.nickname || account.broker_name || "Account"} · ${account.account_number}`,
        duration: 2500,
      });
      onSwitched?.();
    } catch (e) {
      toast({ title: "Switch Failed", description: e.message, variant: "destructive" });
    }
    setSwitching(false);
  };

  const handleDelete = async (e, account) => {
    e.stopPropagation();
    if (accounts.length <= 1) {
      toast({ title: "Cannot Delete", description: "You need at least one linked account.", variant: "destructive" });
      return;
    }
    if (account.account_number === currentAccountNumber) {
      toast({ title: "Cannot Delete Active", description: "Switch to another account first.", variant: "destructive" });
      return;
    }
    try {
      await base44.entities.TradingAccount.delete(account.id);
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      toast({ title: "Account Removed", description: account.account_number, duration: 2000 });
    } catch (err) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  };

  const label = (a) => a.nickname || a.broker_name || "Account";
  const shortNum = (a) => {
    const n = String(a.account_number || "");
    return n.length > 6 ? `…${n.slice(-6)}` : n;
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger bar */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full hud-clip flex items-center gap-3 px-4 py-3.5 transition-all active:scale-[0.98]"
        style={{
          background: "rgba(0,255,65,0.04)",
          border: "1px solid rgba(0,255,65,0.18)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="w-9 h-9 hud-clip-sm flex items-center justify-center shrink-0"
          style={{ background: "rgba(0,255,65,0.1)", border: "1px solid rgba(0,255,65,0.25)" }}>
          <Wallet className="w-4 h-4" style={{ color: "#00FF41" }} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[8px] font-mono uppercase tracking-[0.15em] text-[#00FF41]/40">ACTIVE ACCOUNT</p>
          {loading ? (
            <p className="font-mono text-sm text-white/30">Loading…</p>
          ) : activeAccount ? (
            <p className="font-mono font-bold text-sm text-white truncate">
              {label(activeAccount)} <span className="text-white/40">· {shortNum(activeAccount)}</span>
            </p>
          ) : (
            <p className="font-mono text-sm text-white/30">No account linked</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {accounts.length > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "rgba(0,255,65,0.1)", color: "#00FF41" }}>
              {accounts.length}
            </span>
          )}
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-[#00FF41]/50" />
          </motion.div>
        </div>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute z-30 left-0 right-0 top-full mt-1.5 overflow-hidden"
          >
            <div className="hud-clip hud-glass border border-[#00FF41]/20 shadow-2xl"
              style={{ background: "rgba(8,12,10,0.95)" }}>
              {accounts.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[11px] font-mono text-white/40 mb-3">No accounts linked yet.</p>
                  <button
                    onClick={() => { setOpen(false); navigate("/connect-mt5"); }}
                    className="hud-clip-sm px-4 py-2 font-mono font-bold text-[11px] tracking-wider"
                    style={{ background: "rgba(0,255,65,0.1)", color: "#00FF41", border: "1px solid rgba(0,255,65,0.3)" }}
                  >
                    <Plus className="w-3 h-3 inline mr-1" /> LINK ACCOUNT
                  </button>
                </div>
              ) : (
                <>
                  {accounts.map((a) => {
                    const isActive = a.account_number === currentAccountNumber;
                    return (
                      <button
                        key={a.id}
                        onClick={() => handleSwitch(a)}
                        disabled={switching}
                        className="w-full flex items-center gap-3 px-4 py-3 transition-all hover:bg-[#00FF41]/5 text-left border-b border-white/5 last:border-0 disabled:opacity-50"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-mono font-bold"
                          style={{
                            background: isActive ? "rgba(0,255,65,0.15)" : "rgba(255,255,255,0.04)",
                            color: isActive ? "#00FF41" : "rgba(255,255,255,0.4)",
                            border: `1px solid ${isActive ? "rgba(0,255,65,0.3)" : "rgba(255,255,255,0.08)"}`,
                          }}>
                          {(a.broker_name || "A").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono font-bold text-sm text-white truncate">
                            {label(a)}
                            {a.nickname && a.broker_name && (
                              <span className="text-white/30 font-normal"> · {a.broker_name}</span>
                            )}
                          </p>
                          <p className="text-[10px] font-mono text-white/35 truncate">
                            {a.account_number} · {a.server}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isActive ? (
                            <Check className="w-4 h-4" style={{ color: "#00FF41" }} />
                          ) : switching ? (
                            <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />
                          ) : null}
                          {!isActive && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => handleDelete(e, a)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleDelete(e, a); }}
                              className="opacity-0 hover:opacity-100 group-hover:opacity-60 transition-opacity cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#FF3131]/60" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {/* Add account */}
                  <button
                    onClick={() => { setOpen(false); navigate("/connect-mt5"); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 font-mono font-bold text-[11px] tracking-wider text-[#00FF41] transition-all hover:bg-[#00FF41]/8"
                    style={{ borderTop: "1px solid rgba(0,255,65,0.12)" }}
                  >
                    <Plus className="w-3.5 h-3.5" /> ADD NEW ACCOUNT
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}