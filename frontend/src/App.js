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
import CampaignDetail from "@/pages/CampaignDetail";
import CreatorDetail from "@/pages/CreatorDetail";
import NewCampaign from "@/pages/NewCampaign";
import ProfileEdit from "@/pages/ProfileEdit";
import ProfileView from "@/pages/ProfileView";
import Messages from "@/pages/Messages";
import Invitations from "@/pages/Invitations";
import Wallet from "@/pages/Wallet";
import { Navigate } from "react-router-dom";

import Onboarding from "@/pages/Onboarding";
import { RequireAuth } from "@/components/RequireAuth";

function App() {
  return (
    <div className="App">
      <HashRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/legal/:doc" element={<Legal />} />
            <Route path="/privacy-policy" element={<Navigate to="/legal/privacy" replace />} />
            <Route path="/register" element={<RegisterSplash />} />
            <Route path="/register/:role" element={<Register />} />
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

            <Route path="/marketplace" element={<RequireAuth><Marketplace /></RequireAuth>} />
            <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
            <Route path="/campaigns/new" element={<RequireAuth roles={["owner", "admin"]}><NewCampaign /></RequireAuth>} />
            <Route path="/campaigns/:id" element={<RequireAuth><CampaignDetail /></RequireAuth>} />
            <Route path="/creators/:id" element={<RequireAuth><CreatorDetail /></RequireAuth>} />
          </Routes>
        </AuthProvider>
      </HashRouter>
    </div>
  );
}

export default App;
