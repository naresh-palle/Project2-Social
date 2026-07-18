import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
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
import Admin from "@/pages/Admin";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<ProfileEdit />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/invitations" element={<Invitations />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/campaigns/new" element={<NewCampaign />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/creators/:id" element={<CreatorDetail />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
