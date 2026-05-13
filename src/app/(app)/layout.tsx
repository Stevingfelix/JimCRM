import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { countNeedsReview } from "./review/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let reviewCount = 0;
  try {
    reviewCount = await countNeedsReview();
  } catch {
    reviewCount = 0;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar reviewCount={reviewCount} />
      <main className="flex-1 min-w-0">{children}</main>
      <Toaster richColors closeButton />
    </div>
  );
}
