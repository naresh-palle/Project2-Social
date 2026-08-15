import { useState, useRef, useEffect } from "react";
import { Sparkles, ChevronDown, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "ai",
      content: "Hi! I'm your AI Assistant. How can I help you today?",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = { id: Date.now(), role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          content: "I've received your request. I am a mock AI assistant in this preview environment, so I cannot perform real actions yet.",
        },
      ]);
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderSuggestedPrompts = () => (
    <div className="flex flex-wrap gap-2 mt-4 px-4">
      {["Summarize this page", "Help me edit my profile", "What should I do next?"].map((prompt, i) => (
        <button
          key={i}
          onClick={() => setInput(prompt)}
          className="font-sans text-[10px] bg-white/[0.05] border border-white/10 hover:bg-white/10 text-white/70 hover:text-white px-3 py-1.5 rounded-3xl transition-colors truncate max-w-[200px]"
        >
          {prompt}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="fixed bottom-[5.5rem] right-[1.5rem] z-[999999] w-[380px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-[#0B0B0E] border border-white/15 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#FF3B30]/20 flex items-center justify-center border border-[#FF3B30]/30 text-[#FF3B30]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-sans text-sm font-bold tracking-wide flex items-center gap-2">
                    AI Assistant
                    <span className="w-2 h-2 rounded-full bg-[#34C759] shadow-[0_0_8px_#34C759]"></span>
                  </h3>
                  <p className="font-sans text-[10px] text-white/50">Online and ready to help</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 ${
                      m.role === "user"
                        ? "bg-[#FF3B30] text-white rounded-tr-sm"
                        : "bg-white/[0.05] border border-white/10 text-white/90 rounded-tl-sm"
                    }`}
                  >
                    <p className="font-sans text-xs leading-relaxed">{m.content}</p>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.05] border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Prompts */}
            {!isTyping && renderSuggestedPrompts()}

            {/* Input Area */}
            <div className="p-4 bg-white/[0.02] border-t border-white/10 mt-2">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask AI anything..."
                  className="w-full bg-[#121212] border border-white/10 focus:border-[#FF3B30] focus:ring-1 focus:ring-[#FF3B30] rounded-3xl pl-4 pr-12 py-3 font-sans text-xs outline-none transition-all"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="absolute right-2 w-8 h-8 flex items-center justify-center bg-[#FF3B30] text-white rounded-full hover:bg-[#e03126] disabled:opacity-50 disabled:hover:bg-[#FF3B30] transition-colors"
                >
                  <Send className="w-3.5 h-3.5 -ml-0.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-[1.5rem] right-[5.5rem] z-[999999] flex items-center justify-center gap-2 px-5 h-14 rounded-full bg-white text-black shadow-[0_8px_30px_rgb(255,255,255,0.2)] hover:shadow-[0_8px_40px_rgb(255,255,255,0.4)] hover:-translate-y-1 transition-all duration-300 group"
          >
            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="font-sans text-xs font-bold uppercase tracking-wider">Ask AI</span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
