import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Bot, Sparkles, User, ExternalLink, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function HelpChat() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm the CR8 Studio AI assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsTyping(true);

    // Simulate API call
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I'm currently unable to connect to the knowledge base. Please raise a support ticket for further assistance." 
      }]);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] pt-32 pb-8 px-6 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-grow flex flex-col h-[calc(100vh-140px)]">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors font-sans text-sm mb-2">
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mt-2 gap-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ AI Assistant</p>
              <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-1">CR8 Assistant</h1>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-sans text-white/50 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
                Online
              </p>
              <div className="w-8 h-8 rounded-full bg-[#FF3B30]/20 flex items-center justify-center text-[#FF3B30] border border-[#FF3B30]/30 shadow-[0_0_10px_rgba(255,59,48,0.2)]">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
          </div>

          <Link 
            to="/support" 
            className="hidden sm:flex items-center gap-2 px-4 py-2 border border-white/20 rounded-full hover:bg-white/10 transition-colors font-mono text-[10px] tracking-widest uppercase text-white/80 hover:text-white"
          >
            Create Support Ticket <ExternalLink className="w-3 h-3" />
          </Link>
        </motion.div>

        {/* Chat Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-grow bg-[#121216] border border-white/10 rounded-sm overflow-hidden flex flex-col shadow-2xl relative"
        >
          {/* Messages Area */}
          <div className="flex-grow p-6 overflow-y-auto space-y-6">
            {messages.map((msg, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                  msg.role === 'user' 
                    ? 'bg-white/10 text-white' 
                    : 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/30'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                
                <div className={`p-4 rounded-sm ${
                  msg.role === 'user' 
                    ? 'bg-[#FF3B30] text-white' 
                    : 'bg-white/[0.04] border border-white/10 text-white/90'
                }`}>
                  <p className="font-sans text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </motion.div>
            ))}
            
            {isTyping && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4 max-w-[85%]"
              >
                <div className="w-8 h-8 rounded-full bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/30 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-sm bg-white/[0.04] border border-white/10 text-white/90 flex flex-row items-center gap-1 w-16 justify-center">
                  <motion.div className="w-1.5 h-1.5 bg-[#FF3B30] rounded-full" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                  <motion.div className="w-1.5 h-1.5 bg-[#FF3B30] rounded-full" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                  <motion.div className="w-1.5 h-1.5 bg-[#FF3B30] rounded-full" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/10 bg-[#121216]">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-grow bg-white/[0.03] border border-white/10 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-[#FF3B30] transition-colors font-sans"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isTyping}
                className="bg-[#FF3B30] text-white px-6 py-3 rounded-sm hover:bg-[#ff5247] transition-colors flex items-center justify-center disabled:opacity-50 disabled:hover:bg-[#FF3B30]"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </motion.div>
        
        {/* Mobile quick action */}
        <div className="mt-4 flex justify-center sm:hidden">
          <Link 
            to="/support" 
            className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-full hover:bg-white/10 transition-colors font-mono text-[10px] tracking-widest uppercase text-white/80"
          >
            Create Support Ticket <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
