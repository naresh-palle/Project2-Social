import "@/App.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import RegisterSplash from "@/pages/RegisterSplash";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Feed from "@/pages/Feed";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Settings from "@/pages/Settings";
import SearchPage from "@/pages/SearchPage";
import Legal from "@/pages/Legal";
import PublicProfile from "@/pages/PublicProfile";
import Marketplace from "@/pages/Marketplace";
import Discover from "@/pages/Discover";
import CampaignDetail from "@/pages/CampaignDetail";
import CreatorDetail from "@/pages/CreatorDetail";
import NewCampaign from "@/pages/NewCampaign";
import ProfileEdit from "@/pages/ProfileEdit";
import ProfileView from "@/pages/ProfileView";
import Messages from "@/pages/Messages";
import Invitations from "@/pages/Invitations";
import Wallet from "@/pages/Wallet";
import Billing from "@/pages/Billing";
import InvoiceEditor from "@/pages/InvoiceEditor";
import BillingSettings from "@/pages/BillingSettings";
import { Navigate } from "react-router-dom";

import Onboarding from "@/pages/Onboarding";
import { RequireAuth } from "@/components/RequireAuth";
import SupportCenter from "@/pages/SupportCenter";
import SupportDashboard from "@/pages/SupportDashboard";
import SocialMediaAudit from "@/pages/SocialMediaAudit";
import HelpChat from "@/pages/HelpChat";
import Leaderboard from "@/pages/Leaderboard";
import Referrals from "@/pages/Referrals";
import RecentActivity from "@/pages/RecentActivity";
import InfluencersRedirect from "@/pages/InfluencersRedirect";
import Wishlist from "@/pages/Wishlist";
import BrandDetail from "@/pages/BrandDetail";
import ProductionDetail from "@/pages/ProductionDetail";
import HireRequests from "@/pages/HireRequests";

import { AppLayout } from "@/components/AppLayout";

function App() {
  return (
    <div className="App">
      <HashRouter>
        <AuthProvider>

          <Routes>
            {/* Public / Unauthenticated Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/legal/:doc" element={<Legal />} />
            <Route path="/privacy-policy" element={<Navigate to="/legal/privacy" replace />} />
            <Route path="/register" element={<RegisterSplash />} />
            <Route path="/register/:role" element={<Register />} />
            
            {/* Authenticated Routes wrapped in AppLayout (Sidebar + Main Grid) */}
            <Route element={<AppLayout />}>
              <Route path="/onboarding/:role" element={<RequireAuth><Onboarding /></RequireAuth>} />
              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/feed" element={<RequireAuth><Feed /></RequireAuth>} />
              <Route path="/search" element={<RequireAuth><SearchPage /></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
              <Route path="/u/:userId" element={<RequireAuth><PublicProfile /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><ProfileView /></RequireAuth>} />
              <Route path="/profile/edit" element={<RequireAuth><ProfileEdit /></RequireAuth>} />
              <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
              <Route path="/invitations" element={<RequireAuth><Invitations /></RequireAuth>} />
              <Route path="/wallet" element={<RequireAuth><Wallet /></RequireAuth>} />
              <Route path="/billing/settings" element={<RequireAuth><BillingSettings /></RequireAuth>} />
              <Route path="/billing/new" element={<RequireAuth><InvoiceEditor /></RequireAuth>} />
              <Route path="/billing/:id/edit" element={<RequireAuth><InvoiceEditor /></RequireAuth>} />
              <Route path="/billing/:id" element={<RequireAuth><InvoiceEditor /></RequireAuth>} />
              <Route path="/billing" element={<RequireAuth><Billing /></RequireAuth>} />
  
              <Route path="/marketplace" element={<RequireAuth><Marketplace /></RequireAuth>} />
              <Route path="/wishlist" element={<RequireAuth><Wishlist /></RequireAuth>} />
              <Route path="/brands/:id" element={<RequireAuth><BrandDetail /></RequireAuth>} />
              <Route path="/production/:id" element={<RequireAuth><ProductionDetail /></RequireAuth>} />
              <Route path="/hire-requests" element={<RequireAuth><HireRequests /></RequireAuth>} />
              <Route path="/influencers" element={<RequireAuth><InfluencersRedirect /></RequireAuth>} />
              <Route path="/activity" element={<RequireAuth><RecentActivity /></RequireAuth>} />
              <Route path="/discover" element={<RequireAuth roles={["owner", "agent", "admin"]}><Discover /></RequireAuth>} />
              <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
              <Route path="/referrals" element={<RequireAuth><Referrals /></RequireAuth>} />
              <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
              <Route path="/campaigns/new" element={<RequireAuth roles={["owner", "admin"]}><NewCampaign /></RequireAuth>} />
              <Route path="/campaigns/:id/edit" element={<RequireAuth roles={["owner", "admin"]}><NewCampaign isEdit /></RequireAuth>} />
              <Route path="/campaigns/:id" element={<RequireAuth><CampaignDetail /></RequireAuth>} />
              <Route path="/creators/:id" element={<RequireAuth><CreatorDetail /></RequireAuth>} />
              <Route path="/social-audit" element={<RequireAuth roles={["influencer", "owner", "agent"]}><SocialMediaAudit /></RequireAuth>} />
              <Route path="/support" element={<RequireAuth><SupportCenter /></RequireAuth>} />
              <Route path="/support/ops" element={<RequireAuth roles={["support", "support_agent", "support_lead", "support_admin"]}><SupportDashboard /></RequireAuth>} />
              <Route path="/help" element={<RequireAuth><HelpChat /></RequireAuth>} />
            </Route>
          </Routes>
        </AuthProvider>
      </HashRouter>
    </div>
  );
}

export default App;
