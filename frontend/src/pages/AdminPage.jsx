
import { AdminPanel } from "./AdminPanel";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0]">
      
      
      <div className="flex flex-col h-full overflow-y-auto w-full flex-1">
        <AdminPanel />
      </div>

    </div>
  );
}
