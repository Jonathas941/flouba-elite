import React, { useState, useEffect } from "react";
import { Download, FileDown } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function EADownloadCard() {
  const [eaUrl, setEaUrl] = useState(null);

  useEffect(() => {
    base44.auth.me().then((u) => setEaUrl(u?.ea_download_url || null)).catch(() => {});
  }, []);

  if (!eaUrl) return null;

  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
        <FileDown className="w-5 h-5 text-orange-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-heading font-bold text-white">MT5 Expert Advisor</p>
        <p className="text-[9px] text-white/40 font-body">Download and attach to your MetaTrader 5 chart.</p>
      </div>
      <a href={eaUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-heading font-bold uppercase tracking-wider bg-orange-500/15 border border-orange-500/40 text-orange-300 hover:bg-orange-500/25 transition-colors shrink-0">
        <Download className="w-3.5 h-3.5" /> Download
      </a>
    </div>
  );
}