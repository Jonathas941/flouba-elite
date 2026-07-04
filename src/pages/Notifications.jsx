import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import MobileHeader from "@/components/MobileHeader";
import GlassCard from "@/components/GlassCard";
import { useToast } from "@/components/ui/use-toast";
import { logNotification } from "@/lib/notifications";
import {
  Bot, AlertTriangle, Wifi, WifiOff, Activity, Bell,
  CheckCheck, Trash2, Loader2, Inbox,
} from "lucide-react";

const TYPE_META = {
  bot_action:  { icon: Bot,           color: "#5fe8ff", bg: "rgba(95,232,255,0.10)", ring: "rgba(95,232,255,0.35)" },
  alert:       { icon: AlertTriangle, color: "#ffce4d", bg: "rgba(255,206,77,0.10)", ring: "rgba(255,206,77,0.35)" },
  connection:  { icon: Wifi,           color: "#00ff9d", bg: "rgba(0,255,157,0.10)",  ring: "rgba(0,255,157,0.35)" },
  trade:       { icon: Activity,       color: "#a78bfa", bg: "rgba(167,139,250,0.10)", ring: "rgba(167,139,250,0.35)" },
  system:      { icon: Bell,           color: "#94a3b8", bg: "rgba(148,163,184,0.10)", ring: "rgba(148,163,184,0.30)" },
};

const CAT_TONE = {
  info:    "#5fe8ff",
  success: "#00ff9d",
  warning: "#ffce4d",
  danger:  "#ff4d4d",
};

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function Notifications() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Notification.list("-created_date", 100);
      setItems(list || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    try {
      const unread = (items || []).filter((n) => !n.read);
      if (unread.length === 0) return;
      await base44.entities.Notification.bulkUpdate(unread.map((n) => ({ id: n.id, read: true })));
      setItems((prev) => (prev || []).map((n) => ({ ...n, read: true })));
      toast({ title: "All marked as read", duration: 1500 });
    } catch {
      toast({ title: "Failed to update", variant: "destructive", duration: 2000 });
    }
  };

  const clearAll = async () => {
    try {
      await base44.entities.Notification.deleteMany({});
      setItems([]);
      await logNotification({ type: "system", title: "History Cleared", message: "All notifications were removed.", category: "info" });
      load();
      toast({ title: "Notifications cleared", duration: 1500 });
    } catch {
      toast({ title: "Failed to clear", variant: "destructive", duration: 2000 });
    }
  };

  const filtered = (items || []).filter((n) => filter === "all" ? true : n.type === filter);
  const unreadCount = (items || []).filter((n) => !n.read).length;

  const FILTERS = [
    { key: "all", label: "All" },
    { key: "bot_action", label: "Bot" },
    { key: "alert", label: "Alerts" },
    { key: "connection", label: "Connection" },
    { key: "trade", label: "Trades" },
  ];

  return (
    <div className="min-h-screen pb-32 max-w-md sm:max-w-2xl lg:max-w-4xl mx-auto">
      <MobileHeader title="Notifications" subtitle={`${unreadCount} unread`} />

      <div className="px-4 space-y-4">
        {/* Action bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="px-3 py-1.5 rounded-full text-[10px] font-heading font-bold tracking-widest uppercase whitespace-nowrap transition-all"
                style={filter === f.key
                  ? { background: "linear-gradient(90deg, rgba(95,232,255,0.18), rgba(0,180,255,0.12))", color: "#5fe8ff", border: "1px solid rgba(95,232,255,0.45)" }
                  : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={markAllRead} disabled={unreadCount === 0}
              className="w-9 h-9 rounded-xl glass flex items-center justify-center disabled:opacity-30 active:scale-95 transition-transform">
              <CheckCheck className="w-4 h-4 text-cyan-300" />
            </button>
            <button onClick={clearAll} disabled={!items || items.length === 0}
              className="w-9 h-9 rounded-xl glass flex items-center justify-center disabled:opacity-30 active:scale-95 transition-transform">
              <Trash2 className="w-4 h-4 text-[#ff6b6b]" />
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center">
              <Inbox className="w-7 h-7 text-white/30" />
            </div>
            <p className="font-heading text-sm tracking-wider text-white/50">No notifications yet</p>
            <p className="text-[11px] text-white/30 text-center max-w-[220px]">
              Bot actions, alerts and connection events will appear here in real time.
            </p>
            <button onClick={() => navigate("/")}
              className="mt-2 px-4 py-2 rounded-xl text-[10px] font-heading tracking-widest text-[#021024]"
              style={{ background: "linear-gradient(90deg, #5fe8ff, #00b4ff)" }}>
              BACK TO DASHBOARD
            </button>
          </GlassCard>
        ) : (
          <motion.div className="space-y-2.5" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}>
            {filtered.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.system;
              const Icon = meta.icon;
              const tone = CAT_TONE[n.category] || meta.color;
              return (
                <motion.div key={n.id}
                  variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                  className="glass rounded-2xl p-3.5 flex items-start gap-3 relative overflow-hidden"
                  style={{ borderLeft: `2px solid ${tone}`, opacity: n.read ? 0.55 : 1 }}>
                  {!n.read && (
                    <span className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full" style={{ background: tone, boxShadow: `0 0 6px ${tone}` }} />
                  )}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: meta.bg, border: `1px solid ${meta.ring}` }}>
                    <Icon className="w-5 h-5" style={{ color: meta.color }} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-heading text-[12px] font-bold text-white tracking-wide leading-tight">{n.title}</p>
                    <p className="text-[11px] text-white/55 mt-0.5 leading-snug">{n.message}</p>
                    <p className="text-[9px] uppercase tracking-widest text-white/30 mt-1.5 font-heading">{timeAgo(n.created_date)}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}