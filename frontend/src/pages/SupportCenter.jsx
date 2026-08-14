import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ChevronDown, CheckCircle2, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const INFLUENCER_FAQ = [
  { question: "How do I get paid?", answer: "Payments are processed securely via Stripe. Once a campaign is completed and approved, funds are transferred to your connected bank account within 3-5 business days." },
  { question: "How does the matching algorithm work?", answer: "Our CR8 Studio algorithm pairs creators with brands based on alignment in aesthetic, audience demographics, past performance, and campaign requirements." },
  { question: "What are creator levels?", answer: "Creator levels (e.g., Rising Star, Pro, Elite) are determined by your track record, engagement rates, and successful campaign completions. Higher levels unlock premium campaigns." },
  { question: "Can I dispute a rejection?", answer: "Yes. If your deliverable was rejected unfairly, you can open a dispute ticket from the campaign page, and our team will review the brief requirements." },
  { question: "Do I need to pay a platform fee?", answer: "No, influencers do not pay an upfront fee to join or pitch. A standard platform commission is automatically deducted from the final payout, which is clearly shown before you accept." }
];

const BRAND_FAQ = [
  { question: "How do I fund my escrow?", answer: "You can fund your escrow using any major credit card or wire transfer via Stripe." },
  { question: "Can I rehire a creator?", answer: "Yes, you can easily rehire a creator from any completed campaign. A loyalty discount will be automatically applied." },
  { question: "How does the matching algorithm work?", answer: "We pair you with creators who align with your brand's aesthetic and target demographics." },
  { question: "What happens if a creator misses a deadline?", answer: "If the deadline passes without submission, the campaign is canceled and your escrowed funds are returned to your wallet instantly." },
  { question: "Can I request revisions?", answer: "Yes, brands can request up to two rounds of revisions on submitted deliverables before approving the final payout." }
];

const ADMIN_FAQ = [
  { question: "How do I resolve disputes?", answer: "Disputes can be managed from the admin dashboard under the 'Disputes' tab." },
  { question: "How do I manage payouts?", answer: "Payouts are automatically batched, but can be manually triggered in the 'Transactions' panel." },
  { question: "Where do I configure referral rewards?", answer: "You can adjust referral bonuses and platform fees in the Global Configuration settings." }
];

const ADMIN_MOCK_TICKETS = [
  { id: "T-1045", subject: "Brand escrow refund request", status: "open", date: "2026-08-09", user: "Nike Official" },
  { id: "T-1042", subject: "Profile verification pending", status: "open", date: "2026-08-08", user: "Alex Creator" },
  { id: "T-1038", subject: "Payment delay", status: "closed", date: "2026-08-05", user: "Sarah Styles" },
];

const USER_MOCK_TICKETS = [
  { id: "T-123", subject: "Payment delay", status: "open", date: "2026-08-01" },
  { id: "T-089", subject: "Profile not updating", status: "closed", date: "2026-07-28" }
];

export default function SupportCenter() {
  const { user } = useAuth();
  const role = user?.role || "influencer";
  
  const currentFaqs = role === "admin" ? ADMIN_FAQ : role === "owner" ? BRAND_FAQ : INFLUENCER_FAQ;

  const [activeFaq, setActiveFaq] = useState(null);
  const [form, setForm] = useState({ subject: "", category: "Payment", priority: "Low", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Mock Tickets
  const [tickets, setTickets] = useState(role === "admin" ? ADMIN_MOCK_TICKETS : USER_MOCK_TICKETS);

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
    <div className="flex flex-col h-full overflow-hidden w-full max-w-5xl mx-auto pb-4 px-6 pt-6">
      {/* Top Static Header */}
      <div className="shrink-0 space-y-4 mb-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6 mb-8 w-full">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> ⚡ Support Center
              </p>
              <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-2 mb-2">Help & Support</h1>
              <p className="font-sans text-white/60 max-w-2xl text-sm">
                Find answers to common questions or reach out to our team directly.
              </p>
            </div>
          </div>
        </motion.div>
      </div> {/* End Static Header */}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
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
              <h2 className="font-sans text-2xl font-bold tracking-tight mb-6">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {currentFaqs.map((faq, idx) => (
                  <div key={idx} className="border border-white/10 rounded-3xl overflow-hidden bg-white/[0.02]">
                    <button 
                      onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                      className="w-full flex items-center justify-between p-6 text-left hover:bg-white/[0.04] transition-colors gap-4"
                    >
                      <span className="font-sans text-base font-semibold text-[#F4F4F0]">{faq.question}</span>
                      <ChevronDown className={`w-5 h-5 text-white/40 transition-transform shrink-0 ${activeFaq === idx ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {activeFaq === idx && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-6 pb-6 text-[#F4F4F0]/60 font-sans text-sm leading-relaxed"
                        >
                          {faq.answer}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </section>

            {/* Tickets */}
            <section>
              <h2 className="font-sans text-xl font-bold tracking-tight mb-6">{role === "admin" ? "All User Tickets" : "My Tickets"}</h2>
              <div className="space-y-4">
                {tickets.map(ticket => (
                  <div key={ticket.id} className="p-5 border border-white/10 rounded-3xl flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div>
                      <div className="font-mono text-xs tracking-widest text-white/40 mb-1">{ticket.id} • {ticket.date} {ticket.user && `• ${ticket.user}`}</div>
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

          {/* Right Column: Ticket Form */}
          <div className="border border-white/10 bg-[#121212] rounded-3xl p-6 sticky top-32">
            <h2 className="font-sans text-2xl font-bold mb-6">Raise a Ticket</h2>
            {success ? (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-[#34C759]/10 border border-[#34C759]/30 text-[#34C759] p-6 rounded-3xl text-center space-y-3"
              >
                <CheckCircle2 className="w-10 h-10 mx-auto" />
                <p className="font-sans text-sm font-semibold tracking-wider uppercase">Ticket Submitted</p>
                <p className="text-xs opacity-80">Our team will get back to you shortly.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-widest opacity-50 mb-1.5">Subject</label>
                  <input 
                    type="text" 
                    required
                    value={form.subject}
                    onChange={(e) => setForm({...form, subject: e.target.value})}
                    placeholder="Brief description of the issue"
                    className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#FF3B30] transition-colors"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-widest opacity-50 mb-1.5">Category</label>
                    <select 
                      value={form.category}
                      onChange={(e) => setForm({...form, category: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#FF3B30] transition-colors appearance-none"
                    >
                      <option className="bg-[#121212]">Payment</option>
                      <option className="bg-[#121212]">Account</option>
                      <option className="bg-[#121212]">Technical Bug</option>
                      <option className="bg-[#121212]">Dispute</option>
                      <option className="bg-[#121212]">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-widest opacity-50 mb-1.5">Priority</label>
                    <select 
                      value={form.priority}
                      onChange={(e) => setForm({...form, priority: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#FF3B30] transition-colors appearance-none"
                    >
                      <option className="bg-[#121212]">Low</option>
                      <option className="bg-[#121212]">Medium</option>
                      <option className="bg-[#121212]">High</option>
                      <option className="bg-[#121212]">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-widest opacity-50 mb-1.5">Description</label>
                  <textarea 
                    required
                    value={form.description}
                    onChange={(e) => setForm({...form, description: e.target.value})}
                    rows={4}
                    placeholder="Please provide details about your issue..."
                    className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#FF3B30] transition-colors resize-none"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-[#FF3B30] text-white font-mono text-xs tracking-widest uppercase py-3 font-bold hover:bg-[#FF3B30]/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Ticket"}
                </button>
              </form>
            )}
          </div>
          
        </div>
      </div> {/* End Scrollable Area */}
    </div>
  );
}
