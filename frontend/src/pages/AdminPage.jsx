import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AdminPanel } from "./AdminPanel";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <div className="pt-28 max-w-[1600px] mx-auto px-6 md:px-10 pb-20">
        <AdminPanel />
      </div>
      <Footer />
    </div>
  );
}
