import React, { useEffect, useState } from "react";
import { Clock, Newspaper, CheckCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { getCurrentSession, isSessionAllowed } from "@/lib/marketAnalysis";

const SESSION_OPTIONS = ["All Sessions", "London", "New York", "London+NY", "Asian"];

// Upcoming high-impact news windows (hours UTC) — populated from economic calendar concept
// In production, this would come from a live economic calendar API via MT5.
const NEWS_WINDOWS = [
  { name: "NFP",  dayOfMonth: [1, 8, 15, 22], utcHour: 12, duration: 60 }, // Friday ~12:30 UTC
  { name: "CPI",  dayOfMonth: [10, 11, 12],    utcHour: 12, duration: 60 },
  { name: "FOMC", dayOfMonth: [15, 16],         utcHour: 18, duration: 60 },
];

function isNearNews() {
  const now = new Date();
  const dom = now.getDate();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const minuteOfDay = utcH * 60 + utcM;
  for (const nw of NEWS_WINDOWS) {
    if (nw.dayOfMonth.includes(dom)) {
      const start = nw.utcHour * 60 - 30;
      const end   = nw.utcHour * 60 + nw.duration + 30;
      if (minuteOfDay >= start && minuteOfDay <= end) return nw.name;
    }
  }
  return null;
}

export default function SessionNewsFilter({ onFilterChange }) {
  const [selectedSession, setSelectedSession] = useState("All Sessions");
  const [newsFilter, setNewsFilter] = useState(true);
  const [currentSession, setCurrentSession] = useState(getCurrentSession());
  const [newsEvent, setNewsEvent] = useState(null);

  // Update session every minute
  useEffect(() => {
    const tick = () => {
      setCurrentSession(getCurrentSession());
      setNewsEvent(isNearNews());
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  // Persist session preference to BotSettings
  useEffect(() => {
    (async () => {
      const list = await base44.entities.BotSettings.list();
      if (list[0]) {
        const s = list[0];
        setSelectedSession(
          s.london_session && s.new_york_session ? "London+NY"
          : s.london_session ? "London"
          : s.new_york_session ? "New York"
          : "All Sessions"
        );
        setNewsFilter(s.news_filter ?? true);
      }
    })();
  }, []);

  useEffect(() => {
    const sessionOk = isSessionAllowed(
      selectedSession === "All Sessions" ? "All" : selectedSession,
      currentSession
    );
    const newsBlocked = newsFilter && !!newsEvent;
    onFilterChange?.({ sessionAllowed: sessionOk, newsBlocked, newsEvent, currentSession });
  }, [selectedSession, newsFilter, newsEvent, currentSession]);

  const saveSession = async (val) => {
    setSelectedSession(val);
    const list = await base44.entities.BotSettings.list();
    if (list[0]) {
      await base44.entities.BotSettings.update(list[0].id, {
        london_session: val === "London" || val === "London+NY" || val === "All Sessions",
        new_york_session: val === "New York" || val === "London+NY" || val === "All Sessions",
        news_filter: newsFilter,
      });
    }
  };

  const toggleNews = async () => {
    const next = !newsFilter;
    setNewsFilter(next);
    const list = await base44.entities.BotSettings.list();
    if (list[0]) await base44.entities.BotSettings.update(list[0].id, { news_filter: next });
  };

  return (
    <div className="space-y-3">
      {/* Session selector */}
      <div>
        <p className="text-[9px] uppercase tracking-[0.25em] text-white/25 font-heading mb-2 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Trading Session
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SESSION_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => saveSession(s)}
              className={`px-3 py-1.5 rounded-xl font-heading font-bold text-[10px] uppercase tracking-wide transition-all ${
                selectedSession === s
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : "text-white/30 border border-white/8 bg-white/3"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <div className={`w-1.5 h-1.5 rounded-full ${currentSession === "Closed" ? "bg-red-400" : "bg-green-400"}`} />
          <span className="text-[10px] text-white/40 font-heading">Now: <span className="text-white/70">{currentSession}</span></span>
        </div>
      </div>

      {/* News filter */}
      <div className="flex items-center justify-between px-3 py-3 rounded-xl"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-amber-400" />
          <div>
            <p className="font-heading font-bold text-xs text-white/80">News Filter</p>
            <p className="text-[9px] text-white/30">Pause ±30 min around high-impact events</p>
          </div>
        </div>
        <button
          onClick={toggleNews}
          className={`w-10 h-5.5 rounded-full transition-all relative ${newsFilter ? "bg-red-500" : "bg-white/10"}`}
          style={{ minWidth: 40, height: 22 }}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${newsFilter ? "left-5" : "left-0.5"}`} />
        </button>
      </div>

      {newsEvent && newsFilter && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-[10px] font-heading text-amber-400">Trading blocked — {newsEvent} event window active</p>
        </div>
      )}
    </div>
  );
}