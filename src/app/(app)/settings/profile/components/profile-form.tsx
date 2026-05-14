"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePassword,
  signOutAllSessions,
  updateProfile,
} from "../actions";

type Initial = {
  email: string;
  full_name: string;
  role: string;
};

function initialsFromName(name: string, email: string): string {
  if (name) {
    const p = name.trim().split(/\s+/);
    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    return p[0].slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0] ?? "";
  return (local.slice(0, 2) || "?").toUpperCase();
}

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [savingProfile, startProfileSave] = useTransition();
  const [savingPw, startPwSave] = useTransition();
  const [signingOut, startSignOut] = useTransition();
  const [fullName, setFullName] = useState(initial.full_name);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const initials = initialsFromName(fullName, initial.email);

  function handleProfileSave() {
    startProfileSave(async () => {
      const res = await updateProfile({ full_name: fullName });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    });
  }

  function handlePasswordSave() {
    if (newPw.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Passwords don't match");
      return;
    }
    startPwSave(async () => {
      const res = await changePassword({
        new_password: newPw,
        confirm_password: confirmPw,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Password changed");
      setNewPw("");
      setConfirmPw("");
    });
  }

  function handleSignOutAll() {
    if (
      !confirm(
        "Sign out of every device and browser? You'll need to sign back in here too.",
      )
    ) {
      return;
    }
    startSignOut(async () => {
      const res = await signOutAllSessions();
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Signed out everywhere");
      // The session this request used was just invalidated server-side; the
      // client cookie is gone too — next navigation redirects to /login.
      router.push("/login");
    });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* IDENTITY (left column) */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-full bg-brand-gradient text-primary-foreground grid place-items-center font-semibold text-base shadow-sm shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {fullName || initial.email.split("@")[0]}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {initial.email} · {initial.role}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Display name
          </Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jim Smith"
          />
          <p className="text-[11px] text-muted-foreground">
            Shown in the sidebar and on quotes you create.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Email
          </Label>
          <Input value={initial.email} disabled />
          <p className="text-[11px] text-muted-foreground">
            Email changes require re-verification — contact an admin if you
            need to switch.
          </p>
        </div>
        <div className="flex items-center justify-end">
          <Button
            onClick={handleProfileSave}
            disabled={savingProfile}
            className="rounded-full"
          >
            {savingProfile ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </section>

      {/* PASSWORD + SESSIONS (right column, stacked) */}
      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Change password</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use at least 8 characters. You&apos;ll stay signed in on this
              device.
            </p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                New password
              </Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Confirm new password
              </Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="flex items-center justify-end">
            <Button
              onClick={handlePasswordSave}
              disabled={savingPw || !newPw || !confirmPw}
              className="rounded-full"
            >
              {savingPw ? "Updating…" : "Change password"}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Sessions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sign out of every device and browser where you&apos;re signed in.
            </p>
          </div>
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              onClick={handleSignOutAll}
              disabled={signingOut}
              className="rounded-full"
            >
              <LogOut className="size-4 mr-2" />
              {signingOut ? "Signing out…" : "Sign out everywhere"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
