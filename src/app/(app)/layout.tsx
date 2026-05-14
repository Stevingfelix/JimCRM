import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { CommandPalette } from "@/components/command-palette";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/auth";
import { getCompanyInfo } from "@/lib/company";
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
        <TopBar notifications={notifications} />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
      <Toaster richColors closeButton />
      <CommandPalette />
    </div>
  );
}
