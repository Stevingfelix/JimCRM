import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/auth";
import { countNeedsReview } from "./review/queries";
import { getNotifications } from "./notifications/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [reviewCount, notifications] = await Promise.all([
    countNeedsReview().catch(() => 0),
    getNotifications(10).catch(() => ({
      unread_count: 0,
      recent: [],
      last_seen_at: null,
    })),
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
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b bg-card px-6 flex items-center justify-end gap-2 shrink-0">
          <NotificationBell initial={notifications} />
        </header>
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
      <Toaster richColors closeButton />
    </div>
  );
}
