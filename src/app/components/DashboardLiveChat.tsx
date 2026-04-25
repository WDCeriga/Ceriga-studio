"use client";

import { useState } from "react";
import { MessageCircle, User } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";
import { SupportChatPanel } from "./SupportChatPanel";
import { cn } from "./ui/utils";

export function DashboardLiveChat() {
  const [open, setOpen] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(false);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "fixed z-[95] flex items-center gap-2.5 rounded-2xl border border-white/12 bg-[#111113] px-3 py-2.5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition-transform hover:border-white/18 hover:bg-[#161618] active:scale-[0.98] sm:px-3.5",
            "bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-[max(0.75rem,env(safe-area-inset-right,0px))] sm:bottom-6 sm:right-6",
          )}
          style={{ fontFamily: "'DM Sans', sans-serif" }}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#CC2D24]/30 bg-[#CC2D24]/12">
            <MessageCircle className="h-5 w-5 text-[#FCA5A5]" strokeWidth={2} aria-hidden />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#111113] bg-[#CC2D24]">
              <User className="h-2.5 w-2.5 text-white" strokeWidth={2.5} aria-hidden />
            </span>
          </span>
          <span className="max-w-[200px] text-left text-sm font-semibold leading-tight text-white/95 sm:max-w-none">
            Chat with us
          </span>
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          forceMount
          side="right"
          className={cn(
            "flex flex-col gap-0 overflow-hidden bg-[#111113] p-0 text-white [&>button:last-child]:hidden",
            "max-lg:!fixed max-lg:!inset-0 max-lg:!left-0 max-lg:!right-0 max-lg:!top-0 max-lg:!bottom-0 max-lg:!h-[100svh] max-lg:!max-h-[100svh] max-lg:!w-full max-lg:!max-w-none max-lg:!rounded-none max-lg:!border-0",
            desktopExpanded
              ? "lg:!fixed lg:!inset-y-4 lg:!right-4 lg:!top-4 lg:!bottom-4 lg:!left-auto lg:!h-auto lg:!max-h-[calc(100dvh-2rem)] lg:!w-[min(100vw-2rem,56rem)] lg:!max-w-[min(100vw-2rem,56rem)] lg:rounded-2xl lg:border lg:border-white/10 lg:!shadow-2xl"
              : "lg:h-full lg:max-h-dvh lg:w-[min(100vw-1rem,400px)] lg:border-l lg:border-white/10",
          )}
        >
          <SheetTitle className="sr-only">Chat with us</SheetTitle>
          <SupportChatPanel
            layout="sheet"
            sheetOpen={open}
            onClose={() => setOpen(false)}
            desktopExpanded={desktopExpanded}
            onDesktopExpandedChange={setDesktopExpanded}
            className="h-full min-h-0"
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
