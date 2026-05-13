"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  sendMagicLink,
  signInWithGoogle,
  signInWithPassword,
} from "./actions";

type Mode = "password" | "magic";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const onPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await signInWithPassword({ email, password, next });
      if (result && !result.ok) {
        toast.error(result.error.message);
      }
      // success → server redirect, this client never sees it
    });
  };

  const onMagicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await sendMagicLink({ email });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setMagicSent(true);
    });
  };

  const onGoogle = () => {
    startTransition(async () => {
      const result = await signInWithGoogle();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      window.location.href = result.data.url;
    });
  };

  if (magicSent) {
    return (
      <div className="rounded-xl border bg-muted/30 px-4 py-5 text-center space-y-2">
        <div className="text-sm font-medium">Check your inbox</div>
        <p className="text-xs text-muted-foreground">
          We sent a sign-in link to{" "}
          <span className="text-foreground font-medium">{email}</span>. Open it
          on this device to sign in.
        </p>
        <button
          type="button"
          onClick={() => setMagicSent(false)}
          className="text-xs text-muted-foreground hover:text-foreground underline mt-2"
        >
          back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        onClick={onGoogle}
        disabled={pending}
        className="w-full h-11 rounded-full"
      >
        <GoogleIcon className="mr-2 size-4" />
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground uppercase tracking-wider">
        <div className="flex-1 border-t" />
        <span>or</span>
        <div className="flex-1 border-t" />
      </div>

      {mode === "password" ? (
        <form onSubmit={onPasswordSubmit} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button
            type="submit"
            disabled={pending || !email || !password}
            className="h-11 rounded-full w-full text-sm"
          >
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode("magic")}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Email me a magic link instead
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={onMagicSubmit} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="magic-email">Email</Label>
            <Input
              id="magic-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            disabled={pending || !email}
            className={cn("h-11 rounded-full w-full text-sm")}
          >
            {pending ? "Sending…" : "Send magic link"}
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode("password")}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Use password instead
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.8 10.23h-9.81v3.94h5.66c-.24 1.45-1.71 4.24-5.66 4.24-3.41 0-6.18-2.82-6.18-6.3s2.77-6.3 6.18-6.3c1.94 0 3.24.83 3.98 1.54l2.71-2.61C16.95 3.12 14.69 2 12.04 2 6.5 2 2.04 6.48 2.04 12s4.46 10 10 10c5.78 0 9.6-4.06 9.6-9.78 0-.66-.07-1.16-.16-1.99z"
        fill="currentColor"
      />
    </svg>
  );
}
