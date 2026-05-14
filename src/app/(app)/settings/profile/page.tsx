import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProfileForm } from "./components/profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  return (
    <div className="px-8 py-8 space-y-6 max-w-3xl">
      <div className="space-y-1">
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← back to Settings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your name, sign-in, and password.
        </p>
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
