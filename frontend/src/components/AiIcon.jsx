/**
 * Shared solid icon glyphs — Lucide strokes (opaque dark ink on light paper).
 * Replaces soft white PNGs that washed out / looked transparent.
 */
import {
  LayoutDashboard,
  Newspaper,
  Users,
  Trophy,
  Gift,
  UserCog,
  Mail,
  Wallet,
  Receipt,
  User,
  Settings,
  Ticket,
  BookOpen,
  Bot,
  BarChart3,
  ClipboardList,
  Search,
  LogOut,
  Bell,
  LifeBuoy,
  Sparkles,
  Plus,
  RefreshCw,
  ExternalLink,
  Pencil,
  Eye,
  Copy,
  Download,
  Send,
  Ban,
  Trash2,
  Save,
  FlaskConical,
  FileSearch,
  Wand2,
} from "lucide-react";

const ICONS = {
  dashboard: LayoutDashboard,
  feed: Newspaper,
  directory: Users,
  leaderboard: Trophy,
  referrals: Gift,
  users: Users,
  staff: UserCog,
  invitations: Mail,
  wallet: Wallet,
  billing: Receipt,
  profile: User,
  settings: Settings,
  tickets: Ticket,
  knowledge: BookOpen,
  ai: Bot,
  analytics: BarChart3,
  audit: ClipboardList,
  search: Search,
  logout: LogOut,
  bell: Bell,
  notifications: Bell,
  support: LifeBuoy,
  sparkles: Sparkles,
  create: Plus,
  refresh: RefreshCw,
  "view-public": ExternalLink,
  edit: Pencil,
  "edit-profile": Pencil,
  view: Eye,
  copy: Copy,
  download: Download,
  send: Send,
  cancel: Ban,
  trash: Trash2,
  save: Save,
  demo: FlaskConical,
  review: FileSearch,
  generate: Wand2,
};

const TONE_CLASS = {
  // Espresso ink on cream paper
  ink: "text-[#2A201A]",
  muted: "text-[#6B5D50]",
  brand: "text-[#A9824A]",
  soft: "text-[#2A201A]",
  // Cream glyphs on espresso fills
  white: "text-[#F6F0E6]",
};

export function aiIconSrc(name) {
  // Legacy helper kept for any callers; Lucide replaces PNG assets.
  const file = {
    sparkles: "action-sparkles.png",
  }[name] || "action-sparkles.png";
  const base = process.env.PUBLIC_URL || "";
  return `${base}/icons/${file}?v=6`;
}

export function AiIcon({
  name,
  alt = "",
  className = "w-4 h-4",
  tone = "ink",
  title,
  strokeWidth = 2.35,
  ...rest
}) {
  const Icon = ICONS[name] || Sparkles;
  const toneClass = TONE_CLASS[tone] || TONE_CLASS.ink;
  return (
    <Icon
      aria-hidden={alt ? undefined : true}
      aria-label={alt || undefined}
      title={title}
      strokeWidth={strokeWidth}
      className={`ai-icon inline-block shrink-0 ${toneClass} ${className}`}
      {...rest}
    />
  );
}

export default AiIcon;
