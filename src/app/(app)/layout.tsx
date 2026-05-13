import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { getActiveCredentialsPublic } from "@/lib/gmail/credentials";
import { countNeedsReview } from "./review/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Best-effort lookups — degrade gracefully if env not set.
  const [reviewCount, gmailStatus] = await Promise.all([
    countNeedsReview().catch(() => 0),
    getActiveCredentialsPublic().catch(() => ({
      connected: false,
      email: null as string | null,
      watched_label: null,
      last_polled_at: null,
    })),
  ]);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        reviewCount={reviewCount}
        user={{
          email: gmailStatus.email,
          label: "Jim",
          role: "Admin",
        }}
      />
      <main className="flex-1 min-w-0">{children}</main>
      <Toaster richColors closeButton />
    </div>
  );
}
