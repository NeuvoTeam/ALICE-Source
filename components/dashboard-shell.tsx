"use client";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useClientNavStore } from "@/stores/useClientNavStore";
import { cn } from "@/lib/utils";

// Note that rem in a media query resolves against the initial font size, so 64rem and 1024px
// are the same boundary, and this string is byte-for-byte the one the compiled Tailwind sheet
// uses for .lg\:hidden / .lg\:flex.
const DESKTOP_QUERY = "(min-width: 64rem)";

interface SidebarContextType {
  isOpen: boolean;
  isMobile: boolean;
  toggleSidebar: () => void;
}

export const SidebarContext = createContext<SidebarContextType>({
  isOpen: true,
  isMobile: false,
  toggleSidebar: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export function DashboardShell({
  viewMode = "clinician",
  activeTab = "vignette",
  onViewModeChange = () => {},
  onTabChange = () => {},
  children,
}: {
  viewMode?: "clinician" | "client";
  activeTab?: "vignette" | "summaries";
  onViewModeChange?: (mode: "clinician" | "client") => void;
  onTabChange?: (tab: "vignette" | "summaries") => void;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  // Start isMobile as false so the server render and the first client render agree - no hydration mismatch.
  const [isMobile, setIsMobile] = useState(false);

  const lastMobile = useRef(false);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);

    const sync = () => {
      const next = !query.matches;
      // `resize` re-reads the query on every viewport change, real or emulated; the
      // lg (1024px, emitted by Tailwind as `@media (min-width:64rem)`) is the single boundary.
      // The JS only mirrors its negation for the static slot and closes the drawer on a crossing.
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
    return useClientNavStore.subscribe((state, prev) => {
      if (
        state.selectedClientId !== prev.selectedClientId ||
        state.selectedSessionId !== prev.selectedSessionId
      ) {
        setDrawerOpen(false);
      }
    });
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setDrawerOpen((prev) => !prev);
    } else {
      setDesktopOpen((prev) => !prev);
    }
  };

  const isOpen = isMobile ? drawerOpen : desktopOpen;

  const sidebar = (
    <DashboardSidebar
      viewMode={viewMode}
      activeTab={activeTab}
      onViewModeChange={onViewModeChange}
      onTabChange={onTabChange}
    />
  );

  return (
    <SidebarContext.Provider value={{ isOpen, isMobile, toggleSidebar }}>
      <div className="flex h-screen flex-col lg:flex-row overflow-hidden bg-background">
        {/* DESKTOP COLLAPSIBLE SIDEBAR */}
        {!isMobile && (
          <div
            className={cn(
              "hidden lg:flex transition-[width] duration-250 ease-in-out shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar",
              desktopOpen ? "w-72" : "w-0 border-r-0"
            )}
          >
            {sidebar}
          </div>
        )}

        {/* MOBILE / SPLIT-SCREEN DRAWER */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
          <SheetContent side="left" className="w-72 max-w-[85vw] gap-0 p-0 border-r border-sidebar-border">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Client, case and session navigation.</SheetDescription>
            {sidebar}
          </SheetContent>
        </Sheet>
      </div>
    </SidebarContext.Provider>
  );
}
