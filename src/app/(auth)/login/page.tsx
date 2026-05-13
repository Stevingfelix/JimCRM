import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-brand-gradient text-primary-foreground grid place-items-center font-bold text-lg shadow-sm">
            C
          </div>
          <div>
            <div className="font-semibold tracking-tight">CAP Quoting</div>
            <div className="text-xs text-muted-foreground">
              Sign in to continue
            </div>
          </div>
        </div>

        {searchParams.error && (
          <div className="text-sm rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950 dark:border-rose-900 px-3 py-2">
            {decodeURIComponent(searchParams.error)}
          </div>
        )}

        <Suspense>
          <LoginForm next={searchParams.next} />
        </Suspense>

        <p className="text-[11px] text-muted-foreground text-center">
          Internal tool · invite-only access.
        </p>
      </div>
    </div>
  );
}
