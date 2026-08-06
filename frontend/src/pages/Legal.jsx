import { useParams, Link } from "react-router-dom";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

const DOCS = {
  terms: {
    title: "Terms of Service",
    updated: "August 1, 2026",
    sections: [
      {
        h: "1. Agreement",
        p: "By accessing CR8 Studio (\"the Platform\"), operated by CR8 Studio Ltd., you agree to these Terms of Service. If you do not agree, do not use the Platform.",
      },
      {
        h: "2. Eligibility",
        p: "You must be at least 16 years old (or the minimum age in your jurisdiction) to use CR8 Studio. Brands and agencies must provide accurate business registration information where required.",
      },
      {
        h: "3. Accounts & Security",
        p: "You are responsible for safeguarding your credentials. Notify us immediately of unauthorized access. We may suspend accounts that violate these terms or applicable law.",
      },
      {
        h: "4. Creator & Brand Content",
        p: "You retain ownership of content you upload. You grant CR8 Studio a non-exclusive, worldwide license to host, display, and distribute your content solely to operate the Platform. You warrant that you have all rights necessary for content you post.",
      },
      {
        h: "5. Campaigns & Escrow",
        p: "Campaign agreements between brands and creators are facilitated through the Platform. Payment terms, deliverables, and dispute resolution are governed by campaign-specific agreements and our Escrow Policy.",
      },
      {
        h: "6. Prohibited Conduct",
        p: "You may not harass others, post illegal content, manipulate metrics, impersonate others, scrape the Platform without permission, or circumvent security measures.",
      },
      {
        h: "7. Termination",
        p: "We may terminate or suspend access at our discretion. You may delete your account at any time via Settings. Provisions that by nature should survive termination will remain in effect.",
      },
      {
        h: "8. Limitation of Liability",
        p: "To the maximum extent permitted by law, CR8 Studio is not liable for indirect, incidental, or consequential damages arising from your use of the Platform.",
      },
      {
        h: "9. Governing Law",
        p: "These terms are governed by the laws of India, without regard to conflict-of-law principles. EU/UK users retain mandatory consumer protections under applicable local law.",
      },
      {
        h: "10. Contact",
        p: "Legal inquiries: legal@cr8.studio",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "August 1, 2026",
    sections: [
      {
        h: "1. Data Controller",
        p: "CR8 Studio Ltd. (\"we\", \"us\") is the data controller for personal data processed through the Platform. Contact: privacy@cr8.studio.",
      },
      {
        h: "2. Data We Collect",
        p: "We collect account data (name, email, phone, profile), usage data (posts, messages, interactions), device data (IP, browser, session identifiers), payment metadata (processed by PCI-compliant partners—we do not store full card numbers), and optional analytics with your consent.",
      },
      {
        h: "3. Legal Bases (GDPR)",
        p: "We process data based on: (a) contract performance (providing the service); (b) legitimate interests (security, fraud prevention, product improvement); (c) consent (marketing, non-essential cookies); and (d) legal obligations.",
      },
      {
        h: "4. How We Use Data",
        p: "To operate accounts, facilitate creator-brand collaborations, process payments, send service notifications, improve the Platform, comply with law, and—with consent—send marketing communications.",
      },
      {
        h: "5. Sharing",
        p: "We share data with payment processors, cloud hosting providers, email/SMS vendors, and analytics tools under data processing agreements. We do not sell personal data.",
      },
      {
        h: "6. International Transfers",
        p: "Data may be processed outside your country. We use Standard Contractual Clauses and equivalent safeguards for EEA/UK transfers.",
      },
      {
        h: "7. Retention",
        p: "We retain account data while your account is active and for a limited period thereafter for legal and backup purposes. You may request deletion via Settings or privacy@cr8.studio.",
      },
      {
        h: "8. Your Rights",
        p: "Depending on your location, you may have rights to access, rectify, erase, restrict, port, and object to processing. EU/UK users may lodge complaints with their supervisory authority. Submit requests via privacy@cr8.studio—we respond within 30 days.",
      },
      {
        h: "9. Security",
        p: "We implement encryption in transit, access controls, and regular security reviews. No method of transmission is 100% secure.",
      },
      {
        h: "10. Children",
        p: "The Platform is not directed at children under 16. We delete accounts of underage users upon discovery.",
      },
      {
        h: "11. Third-Party Social Media Integrations & API Usage",
        p: "When you connect your social media accounts (e.g., YouTube, Instagram, Facebook, X), we access your data via their official APIs to display your analytics and metrics. We do not store your passwords. Your data is not sold to third parties. By connecting YouTube, you agree to the Google Privacy Policy (https://policies.google.com/privacy) and YouTube Terms of Service (https://www.youtube.com/t/terms). You may revoke access to your data at any time via the Google Security Settings page (https://security.google.com/settings/security/permissions). Similar revocations can be managed directly on Meta and X platform settings.",
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    updated: "August 1, 2026",
    sections: [
      {
        h: "1. What Are Cookies",
        p: "Cookies are small text files stored on your device. We also use local storage and similar technologies for session management and preferences.",
      },
      {
        h: "2. Essential Cookies",
        p: "Required for authentication, security, and core functionality. These cannot be disabled without breaking the service.",
      },
      {
        h: "3. Functional Cookies",
        p: "Remember your theme, language, and accessibility preferences (e.g., font scale, high contrast).",
      },
      {
        h: "4. Analytics Cookies",
        p: "Help us understand usage patterns. We use privacy-respecting analytics where possible. You may opt out via browser settings or our cookie banner where shown.",
      },
      {
        h: "5. Third-Party Cookies",
        p: "OAuth providers (Google, Apple) and payment partners may set cookies during sign-in or checkout. Refer to their respective policies.",
      },
      {
        h: "6. Managing Cookies",
        p: "Adjust browser settings to block or delete cookies. Note that blocking essential cookies may prevent login. For GDPR jurisdictions, non-essential cookies require consent.",
      },
      {
        h: "7. Contact",
        p: "Cookie questions: privacy@cr8.studio",
      },
    ],
  },
  ftc: {
    title: "FTC Disclosure Guidelines",
    updated: "August 1, 2026",
    sections: [
      {
        h: "1. Purpose",
        p: "CR8 Studio requires creators and brands to comply with FTC endorsement guidelines and equivalent regulations (ASA UK, ASCI India, EU UCPD) when posting sponsored or incentivized content.",
      },
      {
        h: "2. Clear Disclosure",
        p: "Material connections (payment, free products, affiliate links, employment) must be clearly and conspicuously disclosed. Use unambiguous labels such as #ad, #sponsored, or \"Paid partnership with [Brand]\" at the beginning of captions where platform limits allow.",
      },
      {
        h: "3. Platform Tools",
        p: "Use built-in branded content tools on Instagram, YouTube, TikTok, and other platforms in addition to in-caption disclosures.",
      },
      {
        h: "4. Honest Opinions",
        p: "Endorsements must reflect honest opinions, beliefs, and experiences. Do not make unsubstantiated claims about products or health benefits.",
      },
      {
        h: "5. CR8 Studio Campaigns",
        p: "Campaign briefs on CR8 Studio include disclosure requirements. Failure to comply may result in withheld payment, account warnings, or removal from the Platform.",
      },
      {
        h: "6. Resources",
        p: "FTC Endorsement Guides: ftc.gov/business-guidance/resources/endorsements-influencers-and-creators-what-people-are-asking",
      },
      {
        h: "7. Reporting",
        p: "Report undisclosed sponsored content via in-app reporting or compliance@cr8.studio.",
      },
    ],
  },
};

export default function Legal() {
  const { doc } = useParams();
  const content = DOCS[doc] || null;

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      <Nav />
      <div className="pt-28 max-w-3xl mx-auto px-6 md:px-10 pb-24 flex-1">
        {!content ? (
          <div className="text-center py-20">
            <h1 className="font-editorial text-4xl">Document not found</h1>
            <div className="mt-6 flex flex-wrap justify-center gap-4 font-mono text-xs uppercase tracking-widest">
              {Object.keys(DOCS).map((k) => (
                <Link key={k} to={`/legal/${k}`} className="text-[#FF3B30] hover:underline">{k}</Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Legal</p>
            <h1 className="font-sans text-4xl md:text-6xl font-bold tracking-tight mt-2 leading-[1.15]">{content.title}</h1>
            <p className="font-mono text-xs opacity-50 mt-2">Last updated: {content.updated}</p>
            <div className="mt-12 space-y-8">
              {content.sections.map((s, i) => (
                <section key={i}>
                  <h2 className="font-editorial text-2xl text-[#FF3B30] mb-2">{s.h}</h2>
                  <p className="font-mono text-sm leading-relaxed text-white/80">{s.p}</p>
                </section>
              ))}
            </div>
            <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-4 font-mono text-xs uppercase tracking-widest">
              {Object.keys(DOCS).filter((k) => k !== doc).map((k) => (
                <Link key={k} to={`/legal/${k}`} className="opacity-60 hover:text-[#FF3B30]">{DOCS[k].title}</Link>
              ))}
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
