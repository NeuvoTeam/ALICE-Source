"use client";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useClientNavStore } from "@/stores/useClientNavStore";

// Note that rem in a media query resolves against the initial font size, so 64rem and 1024px
// are the same boundary, and this string is byte-for-byte the one the compiled Tailwind sheet
// uses for .lg\:hidden / .lg\:flex.
const DESKTOP_QUERY = "(min-width: 64rem)";

export function DashboardShell({ viewMode, activeTab, onViewModeChange, onTabChange, children }: {
  viewMode: "clinician" | "client";
  activeTab: "vignette" | "summaries";
  onViewModeChange: (mode: "clinician" | "client") => void;
  onTabChange: (tab: "vignette" | "summaries") => void;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Start isMobile as false so the server render and the first client render agree - no hydration mismatch.
  const [isMobile, setIsMobile] = useState(false);

  const selectedClientId = useClientNavStore((s) => s.selectedClientId);
  const selectedSessionId = useClientNavStore((s) => s.selectedSessionId);

  const lastMobile = useRef(false);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);

    const sync = () => {
      const next = !query.matches;
      // `resize` re-reads the query on every viewport change, real or emulated; the
      // lg (1024px, emitted by Tailwind as `@media (min-width:64rem)`) is the single boundary.
      // The JS only mirrors its negation for the static slot and closes the drawer on a crossing.
      // Only crossing the breakpoint closes the drawer: a viewport change that stays
      // inside the same mode (an on-screen keyboard, say) must leave it open.
      if (next !== lastMobile.current) setDrawerOpen(false);
      lastMobile.current = next;
      setIsMobile(next);
    };

    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  // Picking a client or a session is navigation and must close the drawer.
  useEffect(() => {
    setDrawerOpen(false);
  }, [selectedClientId, selectedSessionId]);

  const sidebar = (
    <DashboardSidebar
      viewMode={viewMode}
      activeTab={activeTab}
      onViewModeChange={onViewModeChange}
      onTabChange={onTabChange}
    />
  );

  return (
    <div className="flex h-screen flex-col lg:flex-row">
      {!isMobile && <div className="hidden lg:flex">{sidebar}</div>}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-3 lg:hidden">
          <SheetTrigger asChild>
            <button type="button" aria-label="Open navigation" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </SheetTrigger>
          <span className="font-semibold">ALICE</span>
        </header>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        <SheetContent side="left" className="w-64 max-w-[85vw] gap-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Client, case and session navigation.</SheetDescription>
          {sidebar}
        </SheetContent>
      </Sheet>
    </div>
  );
}
