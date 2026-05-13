import { TopNav } from "@/components/top-nav";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: gate behind Supabase session check once auth is wired
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1">{children}</main>
      <Toaster richColors closeButton />
    </div>
  );
}
