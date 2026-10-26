import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Send, Bot, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "Summarize my trading performance today",
  "Which strategy has the best win rate?",
  "Why was my last trade filtered out?",
  "What's my current risk configuration?",
  "Show me my recent market structure signals",
];

export default function AIAnalyst() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello. I'm your Flouba Elite AI Analyst. I can analyze your trade history, explain why signals were filtered, and suggest improvements to your strategy configuration. What would you like to know?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const pollingRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);

    // Add user message immediately
    const userMsg = { role: "user", content: msg };
    const pendingId = `pending-${Date.now()}`;
    const placeholderMsg = { role: "assistant", content: "⏳ Analyzing your data… (request sent to AI server)", _pending: true, _id: pendingId };
    setMessages((prev) => [...prev, userMsg, placeholderMsg]);

    try {
      // Create an AnalysisRequest — the external Replit server polls these
      const req = await base44.entities.AnalysisRequest.create({
        request_type: "general",
        context: msg,
        status: "pending",
      });

      if (!req || !req.id) {
        setMessages((prev) => prev.map((m) => m._id === pendingId
          ? { ...m, content: "Failed to create analysis request. Please try again.", _pending: false }
          : m));
        setLoading(false);
        return;
      }

      // Poll for the result (every 5s, up to ~2 minutes)
      let attempts = 0;
      const maxAttempts = 24;

      const poll = async () => {
        attempts++;
        try {
          const record = await base44.entities.AnalysisRequest.get(req.id);
          if (!record) return;

          if (record.status === "done") {
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            setMessages((prev) => prev.map((m) => m._id === pendingId
              ? { ...m, content: record.result || "Analysis completed (no result text).", _pending: false }
              : m));
            setLoading(false);
          } else if (record.status === "error") {
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            setMessages((prev) => prev.map((m) => m._id === pendingId
              ? { ...m, content: `Analysis error: ${record.error_message || "Unknown error"}`, _pending: false }
              : m));
            setLoading(false);
          } else if (attempts >= maxAttempts) {
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
            setMessages((prev) => prev.map((m) => m._id === pendingId
              ? { ...m, content: "Analysis timed out — the AI server may be busy. Please try again in a moment.", _pending: false }
              : m));
            setLoading(false);
          }
        } catch (e) {
          // Network blip — keep polling
        }
      };

      await poll(); // immediate first check
      if (loading) {
        pollingRef.current = setInterval(poll, 5000);
      }
    } catch (e) {
      setMessages((prev) => prev.map((m) => m._id === pendingId
        ? { ...m, content: "Connection error — please try again.", _pending: false }
        : m));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3"
        style={{ background: "rgba(5,5,5,0.95)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(0,255,65,0.12)" }}>
        <button onClick={() => navigate("/")} className="text-white/40 hover:text-white/70 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(0,255,65,0.12)", border: "1px solid rgba(0,255,65,0.3)" }}>
          <Bot className="w-4 h-4 text-[#00FF41]" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-sm text-white tracking-wide">AI ANALYST</h1>
          <p className="text-[9px] font-mono text-[#00FF41]/50">Performance & Strategy Intelligence</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ paddingBottom: "140px" }}>
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div className={m.role === "user"
              ? "max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm"
              : "max-w-[90%] rounded-2xl rounded-tl-sm px-3.5 py-2.5"}
              style={m.role === "user"
                ? { background: "rgba(0,255,65,0.12)", border: "1px solid rgba(0,255,65,0.25)" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {m.role === "user"
                ? <p className="text-white/90 text-sm">{m.content}</p>
                : <ReactMarkdown className="text-sm text-white/80 prose prose-sm prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>li]:my-0.5">{m.content}</ReactMarkdown>}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-2"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <motion.span className="w-1.5 h-1.5 rounded-full bg-[#00FF41]"
                animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
              <span className="text-[10px] font-mono text-[#00FF41]/40">Waiting for AI server…</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)}
              className="text-[10px] font-mono text-[#00FF41]/70 px-2.5 py-1.5 rounded-lg transition hover:bg-[#00FF41]/10"
              style={{ border: "1px solid rgba(0,255,65,0.2)" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-3 pb-3 z-20">
        <div className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ background: "rgba(12,12,12,0.97)", border: "1px solid rgba(0,255,65,0.15)", backdropFilter: "blur(14px)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Ask about your performance…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 outline-none font-mono"
          />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-30 transition"
            style={{ background: "rgba(0,255,65,0.15)", border: "1px solid rgba(0,255,65,0.3)" }}>
            <Send className="w-3.5 h-3.5 text-[#00FF41]" />
          </button>
        </div>
      </div>
    </div>
  );
}