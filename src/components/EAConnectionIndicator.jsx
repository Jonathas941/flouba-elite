import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cpu } from "lucide-react";
import { mt5Api } from "@/lib/mt5Api";

export default function EAConnectionIndicator() {
  const [status, setStatus] = useState(null); // null=loading, true=ok, false=error
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await mt5Api.status();
        if (cancelled) return;
        if (res?.ok && res?.data) {
          const d = res.data;
          const connected = d.connected ?? d.ea_connected ?? d.status === "ok" ?? res.ok;
          setStatus(connected);
          setDetail(d.version ? `v${d.version}` : d.message || "");
        } else {
          setStatus(false);
          setDetail(res?.error || "Bridge offline");
        }
      } catch (e) {
        if (!cancelled) { setStatus(false); setDetail("Unreachable"); }
      }
    };
    check();
    const iv = setInterval(check, 10000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const color = status === null ? "text-white/30" : status ? "text-green-400" : "text-red-400";
  const dotColor = status === null ? "bg-white/20" : status ? "bg-green-400" : "bg-red-400";
  const label = status === null ? "CHECKING EA" : status ? "EA CONNECTED" : "EA OFFLINE";

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-heading font-bold uppercase tracking-wider border ${status ? "border-green-500/25 bg-green-500/8" : "border-white/10 bg-white/3"}`}>
      <Cpu className={`w-2.5 h-2.5 ${color}`} />
      <motion.div
        className={`w-1 h-1 rounded-full ${dotColor}`}
        animate={status ? { scale: [1, 1.8, 1], opacity: [1, 0.3, 1] } : {}}
        transition={{ duration: 1.6, repeat: Infinity }}
      />
      <span className={color}>{label}{detail ? ` · ${detail}` : ""}</span>
    </div>
  );
}