import { useNavigate } from "react-router";
import { SupportChatPanel } from "../components/SupportChatPanel";

export function SupportChatPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[calc(100dvh-4.35rem)] flex-col lg:min-h-dvh">
      <div className="mx-auto flex w-full max-w-4xl min-h-0 flex-1 flex-col px-3 py-4 lg:px-8 lg:py-6">
        <SupportChatPanel
          layout="page"
          sheetOpen
          onClose={() => navigate("/dashboard")}
          className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        />
      </div>
    </div>
  );
}
