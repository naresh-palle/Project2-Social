import { Sidebar } from "./Sidebar";
import { ThemeToaster } from "@/components/ThemeToaster";
import { Outlet } from "react-router-dom";
import { FloatingChatWidget } from "./FloatingChatWidget";

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

      {/* The main shell is fixed height. Child pages must manage their own scrolling */}
      <main className="flex-1 ml-64 relative z-10 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden relative w-full max-w-[1600px] mx-auto p-6 md:p-10 pb-28 pr-8 md:pr-12">
          <Outlet />
        </div>
      </main>

      {/* Floating Messages (icon-only FAB) */}
      <FloatingChatWidget />
    </div>
  );
}
