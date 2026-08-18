import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Bot, Sparkles, User, ExternalLink, X, Ticket } from "lucide-react";
import { AiIcon } from "@/components/AiIcon";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isSupportOpsRole, supportHomePath } from "@/lib/supportOps";

export default function HelpChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm the flugr AI assistant. Ask about payments, escrow, matching, disputes, or account setup." },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [lastEscalate, setLastEscalate] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  if (isSupportOpsRole(user?.role)) {
    return <Navigate to={supportHomePath()} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput("");
    const nextHistory = [...messages, { role: "user", content: userMsg }];
    setMessages(nextHistory);
    setIsTyping(true);
    setLastEscalate(false);

    try {
      const { data } = await api.post("/support/ai/chat", {
        message: userMsg,
        history: nextHistory.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        create_ticket_if_needed: false,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Sorry — I couldn't answer that." }]);
      setLastEscalate(Boolean(data.escalate));
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm having trouble reaching the knowledge base. Please raise a support ticket and our team will help.",
        },
      ]);
      setLastEscalate(true);
    } finally {
      setIsTyping(false);
    }
  };

  const escalateNow = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      toast.message("Ask a question first, then escalate.");
      return;
    }
    setIsTyping(true);
    try {
      const { data } = await api.post("/support/ai/chat", {
        message: lastUser.content,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
        create_ticket_if_needed: true,
      });
      if (data.ticket) {
        toast.success(`Ticket ${data.ticket.number} created`);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `I've opened support ticket ${data.ticket.number} for you. You can track it in Support Center.`,
          },
        ]);
      } else {
        toast.message("Open Support Center to file a ticket.");
      }
    } catch {
      toast.error("Could not create ticket automatically");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-1.5rem)] bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
              <AiIcon name="sparkles" className="w-3.5 h-3.5" /> flugr Help
            </p>
            <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-1.5">flugr Assistant</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-sans text-white/50 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
              Online
            </p>
            <Link
              to="/support"
              className="hidden sm:flex items-center gap-2 px-4 py-2 border border-white/20 rounded-full hover:bg-white/10 transition-colors font-mono text-[10px] tracking-widest uppercase text-white/80 hover:text-white"
            >
              Create Support Ticket <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5 opacity-60 hover:opacity-100" />
            </button>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 min-h-0 bg-[#121216] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="flex-1 min-h-0 p-6 overflow-y-auto no-scrollbar space-y-6">
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-4 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                  msg.role === "user"
                    ? "bg-white/10 text-white"
                    : "bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/30"
                }`}
              >
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`p-4 rounded-3xl ${
                  msg.role === "user"
                    ? "bg-[#FF3B30] text-white"
                    : "bg-white/[0.04] border border-white/10 text-white/90"
                }`}
              >
                <p className="font-sans text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </motion.div>
          ))}

          {isTyping && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/30 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-3xl bg-white/[0.04] border border-white/10 text-white/90 flex flex-row items-center gap-1 w-16 justify-center">
                <motion.div className="w-1.5 h-1.5 bg-[#FF3B30] rounded-full" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                <motion.div className="w-1.5 h-1.5 bg-[#FF3B30] rounded-full" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                <motion.div className="w-1.5 h-1.5 bg-[#FF3B30] rounded-full" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {lastEscalate && (
          <div className="px-6 pb-2">
            <button
              type="button"
              onClick={escalateNow}
              disabled={isTyping}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#FF3B30]/40 text-[#FF3B30] text-xs font-mono uppercase tracking-widest hover:bg-[#FF3B30]/10 disabled:opacity-50"
            >
              <Ticket className="w-3.5 h-3.5" /> Create support ticket from this chat
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about payments, disputes, matching…"
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-3 text-sm outline-none focus:border-[#FF3B30]"
          />
          <button
            type="submit"
            disabled={isTyping || !input.trim()}
            className="w-12 h-12 rounded-full bg-[#FF3B30] text-white flex items-center justify-center disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </motion.div>

      <p className="mt-3 text-center text-[11px] text-white/35">
        Still stuck?{" "}
        <Link to="/support" className="text-[#FF3B30] hover:underline">
          Open Support Center
        </Link>
      </p>
    </div>
  );
}
