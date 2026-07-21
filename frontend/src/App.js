import "@/App.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import RegisterSplash from "@/pages/RegisterSplash";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Marketplace from "@/pages/Marketplace";
import CampaignDetail from "@/pages/CampaignDetail";
import CreatorDetail from "@/pages/CreatorDetail";
import NewCampaign from "@/pages/NewCampaign";
import ProfileEdit from "@/pages/ProfileEdit";
import Messages from "@/pages/Messages";
import Invitations from "@/pages/Invitations";
import Wallet from "@/pages/Wallet";

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
            <Route path="/register" element={<RegisterSplash />} />
            <Route path="/register/:role" element={<Register />} />
            <Route path="/onboarding/:role" element={<RequireAuth><Onboarding /></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><ProfileEdit /></RequireAuth>} />
            <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="/invitations" element={<RequireAuth><Invitations /></RequireAuth>} />
            <Route path="/wallet" element={<RequireAuth><Wallet /></RequireAuth>} />

            <Route path="/marketplace" element={<RequireAuth roles={["owner", "admin", "agent"]}><Marketplace /></RequireAuth>} />
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
