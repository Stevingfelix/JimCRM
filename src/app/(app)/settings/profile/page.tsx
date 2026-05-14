import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProfileForm } from "./components/profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  return (
    <div className="px-8 py-8 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Your name, sign-in, and password.
        </p>
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← back to Settings
        </Link>
      </div>

      <ProfileForm
        initial={{
          email: me.email ?? "",
          full_name: me.full_name ?? "",
          role: me.role === "admin" ? "Admin" : "User",
        }}
      />
    </div>
  );
}
