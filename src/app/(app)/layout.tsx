import { TopNav } from "@/components/top-nav";
import { Toaster } from "@/components/ui/sonner";
import { countNeedsReview } from "./review/queries";

// All authenticated routes are data-driven and must hit the DB on every request.
// (App relies on env vars at runtime; SSG would prerender at build time before
// envs are available.)
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Best-effort review count; surface 0 if the DB call fails (e.g. env not yet set in dev).
  let reviewCount = 0;
  try {
    reviewCount = await countNeedsReview();
  } catch {
    reviewCount = 0;
  }
  // TODO: gate behind Supabase session check once auth is wired
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav reviewCount={reviewCount} />
      <main className="flex-1">{children}</main>
      <Toaster richColors closeButton />
    </div>
  );
}
