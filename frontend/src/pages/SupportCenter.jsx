import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ChevronDown, CheckCircle2, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

const FAQ_DATA = [
  {
    question: "How do I get paid?",
    answer: "Payments are processed securely via Stripe. Once a campaign is completed and approved, funds are transferred to your connected bank account within 3-5 business days."
  },
  {
    question: "How does the matching algorithm work?",
    answer: "Our CR8 Studio algorithm pairs creators with brands based on alignment in aesthetic, audience demographics, past performance, and campaign requirements."
  },
  {
    question: "What are creator levels?",
    answer: "Creator levels (e.g., Rising Star, Pro, Elite) are determined by your track record, engagement rates, and successful campaign completions. Higher levels unlock premium campaigns."
  }
];

export default function SupportCenter() {
  const [activeFaq, setActiveFaq] = useState(null);
  const [form, setForm] = useState({ subject: "", category: "Payment", priority: "Low", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Mock Tickets
  const [tickets, setTickets] = useState([
    { id: "T-123", subject: "Payment delay", status: "open", date: "2026-08-01" },
    { id: "T-089", subject: "Profile not updating", status: "closed", date: "2026-07-28" }
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setTickets([{
        id: `T-${Math.floor(Math.random() * 1000)}`,
        subject: form.subject,
        status: "open",
        date: new Date().toISOString().split("T")[0]
      }, ...tickets]);
      setSuccess(true);
      setIsSubmitting(false);
      setForm({ subject: "", category: "Payment", priority: "Low", description: "" });
      
      setTimeout(() => setSuccess(false), 3000);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] pt-32 pb-20 px-6">
      <div className="max-w-6xl mx-auto space-y-16">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 relative"
        >
          <Link to="/dashboard" className="absolute left-0 top-2 flex items-center gap-2 text-white/50 hover:text-white transition-colors font-sans text-sm">
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
          <h1 className="font-editorial text-5xl md:text-7xl font-bold tracking-tight">Help & Support</h1>
          <p className="font-sans text-white/60 max-w-2xl mx-auto text-lg">
            We're here to help you navigate CR8 Studio. Find answers below or raise a ticket.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          {/* Left Column: FAQ & My Tickets */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-12"
          >
            {/* FAQ Section */}
            <section>
              <h2 className="font-editorial text-3xl mb-6">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {FAQ_DATA.map((faq, idx) => (
                  <div key={idx} className="border border-white/10 rounded-sm overflow-hidden bg-white/[0.02]">
                    <button 
                      onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="font-sans font-medium text-lg">{faq.question}</span>
                      <ChevronDown className={`w-5 h-5 text-white/40 transition-transform ${activeFaq === idx ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {activeFaq === idx && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-5 pb-5 text-white/60 font-sans leading-relaxed"
                        >
                          {faq.answer}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </section>

            {/* My Tickets */}
            <section>
              <h2 className="font-editorial text-3xl mb-6">My Tickets</h2>
              <div className="space-y-4">
                {tickets.map(ticket => (
                  <div key={ticket.id} className="p-5 border border-white/10 rounded-sm flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div>
                      <div className="font-mono text-xs tracking-widest text-white/40 mb-1">{ticket.id} • {ticket.date}</div>
                      <div className="font-sans font-medium text-lg">{ticket.subject}</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider ${
                      ticket.status === 'open' ? 'bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/30' : 'bg-white/10 text-white/40 border border-white/10'
                    }`}>
                      {ticket.status}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </motion.div>

          {/* Right Column: Raise a Ticket Form */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="bg-[#121216] border border-white/10 rounded-sm p-8 sticky top-32 shadow-2xl">
              <h2 className="font-editorial text-3xl mb-8">Raise a Ticket</h2>
              
              {success ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[#34C759]/10 border border-[#34C759]/30 p-6 rounded-sm flex flex-col items-center justify-center text-center space-y-4"
                >
                  <div className="w-12 h-12 bg-[#34C759]/20 rounded-full flex items-center justify-center text-[#34C759]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-sans font-semibold text-lg text-[#34C759]">Ticket Submitted</h3>
                    <p className="text-white/60 mt-1">Our support team will get back to you shortly.</p>
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block font-mono text-[11px] tracking-widest uppercase text-white/60 mb-2">Subject</label>
                    <input 
                      type="text" 
                      required
                      value={form.subject}
                      onChange={e => setForm({...form, subject: e.target.value})}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-[#FF3B30] transition-colors"
                      placeholder="Brief description of the issue"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono text-[11px] tracking-widest uppercase text-white/60 mb-2">Category</label>
                      <select 
                        value={form.category}
                        onChange={e => setForm({...form, category: e.target.value})}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-[#FF3B30] transition-colors appearance-none"
                      >
                        <option value="Payment">Payment</option>
                        <option value="Campaign">Campaign</option>
                        <option value="Account">Account</option>
                        <option value="Technical">Technical</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-[11px] tracking-widest uppercase text-white/60 mb-2">Priority</label>
                      <select 
                        value={form.priority}
                        onChange={e => setForm({...form, priority: e.target.value})}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-[#FF3B30] transition-colors appearance-none"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] tracking-widest uppercase text-white/60 mb-2">Description</label>
                    <textarea 
                      required
                      rows={5}
                      value={form.description}
                      onChange={e => setForm({...form, description: e.target.value})}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-[#FF3B30] transition-colors resize-none"
                      placeholder="Please provide details about your issue..."
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-[#FF3B30] text-white font-mono text-[11px] tracking-widest uppercase py-4 rounded-sm hover:bg-[#ff5247] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Ticket"}
                    {!isSubmitting && <Plus className="w-4 h-4" />}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
          
        </div>
      </div>
    </div>
  );
}
