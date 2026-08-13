import { Sidebar } from "./Sidebar";
import { ThemeToaster } from "@/components/ThemeToaster";
import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] relative overflow-hidden flex">
      {/* Background gradients/elements (optional) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#FF3B30] opacity-[0.02] blur-[100px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#34C759] opacity-[0.02] blur-[100px] rounded-full mix-blend-screen" />
      </div>

      <Sidebar />
      <ThemeToaster />

      <main className="flex-1 ml-64 relative z-10 p-6 md:p-10 h-screen overflow-y-auto no-scrollbar">
        <div className="w-full max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
