"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "ai";
  content: string;
}

const QUICK_QUESTIONS = [
  "Is this trip safe?",
  "How to reduce costs?",
  "Best local transport tips?",
  "What if my flight cancels?",
  "Best time to visit?",
];

export default function ChatAssistant({ tripContext }: { tripContext: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: "Hi! I am Bookaro Assistant. Ask anything about your trip: safety tips, cost savings, alternatives, or local advice." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async (text?: string) => {
    const message = text || input.trim();
    if (!message || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, tripContext }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: data.reply || data.error || "Sorry, I couldn't understand that. Please try again." },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "Connection error. Please check your internet and try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/40 flex items-center justify-center"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={22} />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageCircle size={22} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed bottom-24 right-6 z-50 w-[340px] md:w-[380px] glass-card-light flex flex-col overflow-hidden"
            style={{ height: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/08 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Bot size={15} />
              </div>
              <div>
                <div className="font-semibold text-white text-sm flex items-center gap-1.5">
                  Bookaro Assistant <Sparkles size={12} className="text-indigo-400" />
                </div>
                <div className="text-xs text-white/40">Smart travel support</div>
              </div>
              <div className="ml-auto flex items-center gap-1 text-xs text-green-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Online
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "ai" && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                      <Bot size={12} />
                    </div>
                  )}
                  <div className={msg.role === "user" ? "chat-bubble-user text-sm text-white" : "chat-bubble-ai text-sm text-white/80"}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Bot size={12} />
                  </div>
                  <div className="chat-bubble-ai flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Quick questions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2">
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/25 transition-colors whitespace-nowrap"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-white/08 flex gap-2">
              <input
                className="flex-1 form-input text-sm py-2.5"
                placeholder="Ask me anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white disabled:opacity-40 hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
              >
                <Send size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


