"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Sidebar> & {
  notifications: React.ComponentProps<typeof TopBar>["notifications"];
  children: React.ReactNode;
};

// Wraps the sidebar + topbar + main content area and owns the mobile drawer
// state. On md+ screens the sidebar sits inline like before; below md it
// slides in from the left over a backdrop.
export function AppShell({
  reviewCount,
  user,
  company,
  notifications,
  children,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close the drawer when navigating to a new route.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [mobileOpen]);

  // Listen for the topbar's hamburger event.
  useEffect(() => {
    const onOpen = () => setMobileOpen(true);
    window.addEventListener("open-mobile-nav", onOpen);
    return () => window.removeEventListener("open-mobile-nav", onOpen);
  }, []);

  return (
    // h-screen (not min-h-screen) so the outer container is exactly viewport
    // height; the inner <main> becomes the scroll container. Sidebar + topbar
    // stay fixed regardless of how tall the page content is.
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Desktop sidebar — always visible from md up. */}
      <div className="hidden md:flex h-screen">
        <Sidebar reviewCount={reviewCount} user={user} company={company} />
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden transition-opacity",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-background/40 backdrop-blur-sm transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            "relative h-full w-[260px] max-w-[80vw] shadow-2xl transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar
            reviewCount={reviewCount}
            user={user}
            company={company}
          />
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar notifications={notifications} />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
