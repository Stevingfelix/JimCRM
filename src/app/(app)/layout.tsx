import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { CommandPalette } from "@/components/command-palette";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/auth";
import { getCompanyInfo } from "@/lib/company";
import { countNeedsReview } from "./review/queries";
import { getNotifications } from "./notifications/queries";

export const dynamic = "force-dynamic";

function KbdHint() {
  return (
    <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground border rounded-md px-2 py-1">
      <span>Search</span>
      <kbd className="ml-1 font-mono text-[10px] px-1 rounded bg-muted">
        ⌘K
      </kbd>
    </div>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [reviewCount, notifications, company] = await Promise.all([
    countNeedsReview().catch(() => 0),
    getNotifications(10).catch(() => ({
      unread_count: 0,
      recent: [],
      last_seen_at: null,
    })),
    getCompanyInfo(),
  ]);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        reviewCount={reviewCount}
        user={{
          email: user.email,
          full_name: user.full_name,
          role: user.role === "admin" ? "Admin" : "User",
        }}
        company={{
          name: company.company_name,
          logo_url: company.logo_url,
        }}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b bg-card px-6 flex items-center justify-end gap-3 shrink-0">
          <KbdHint />
          <NotificationBell initial={notifications} />
        </header>
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
      <Toaster richColors closeButton />
      <CommandPalette />
    </div>
  );
}
