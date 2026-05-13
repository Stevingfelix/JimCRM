import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/auth";
import { countNeedsReview } from "./review/queries";

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

  const reviewCount = await countNeedsReview().catch(() => 0);

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
      <main className="flex-1 min-w-0">{children}</main>
      <Toaster richColors closeButton />
    </div>
  );
}
