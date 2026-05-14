"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, MoreVertical, Trash2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  inviteTeammate,
  resendInvite,
  revokeInvite,
  removeUser,
  setUserRole,
} from "../actions";

type Member = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  last_sign_in_at: string | null;
  created_at: string;
  is_self: boolean;
};

type Invite = {
  id: string;
  email: string;
  role: "admin" | "user";
  status: "pending";
  invited_at: string;
};

type Props = {
  members: Member[];
  invites: Invite[];
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function initials(email: string, full_name: string | null): string {
  if (full_name) {
    const p = full_name.trim().split(/\s+/);
    if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
    return p[0].slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0] ?? "";
  return (local.slice(0, 2) || "?").toUpperCase();
}

export function TeamManager({ members, invites }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {members.length} member{members.length === 1 ? "" : "s"}
          {invites.length > 0 ? ` · ${invites.length} pending` : ""}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="rounded-full" />}>
            <Mail className="size-4 mr-2" />
            Invite teammate
          </DialogTrigger>
          <InviteDialog onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <section className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Members</h2>
        </div>
        {members.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No members yet.
          </div>
        ) : (
          <ul className="divide-y">
            {members.map((m) => (
              <MemberRow key={m.user_id} member={m} />
            ))}
          </ul>
        )}
      </section>

      {invites.length > 0 && (
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/30">
            <h2 className="text-sm font-semibold">Pending invitations</h2>
          </div>
          <ul className="divide-y">
            {invites.map((i) => (
              <InviteRow key={i.id} invite={i} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MemberRow({ member }: { member: Member }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeRole(role: "admin" | "user") {
    if (role === member.role) return;
    startTransition(async () => {
      const res = await setUserRole({ user_id: member.user_id, role });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Role updated to ${role}`);
      router.refresh();
    });
  }

  function handleRemove() {
    if (member.is_self) {
      toast.error("You can't remove yourself");
      return;
    }
    if (!confirm(`Remove ${member.email}? They will lose access immediately.`)) {
      return;
    }
    startTransition(async () => {
      const res = await removeUser(member.user_id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Member removed");
      router.refresh();
    });
  }

  return (
    <li className="px-5 py-4 flex items-center gap-4">
      <div className="size-9 rounded-full bg-brand-gradient text-primary-foreground grid place-items-center font-semibold text-sm shrink-0">
        {initials(member.email, member.full_name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {member.full_name ?? member.email.split("@")[0]}
          </span>
          {member.is_self && (
            <span className="text-[10px] tracking-wide uppercase text-muted-foreground border rounded-full px-1.5 py-0.5">
              You
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {member.email} · last sign-in {formatDateTime(member.last_sign_in_at)}
        </div>
      </div>
      <Select
        value={member.role}
        onValueChange={(v) => changeRole(v as "admin" | "user")}
        disabled={pending || member.is_self}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="user">User</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending || member.is_self}
          render={<Button variant="ghost" size="icon" />}
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={handleRemove}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4 mr-2" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function InviteRow({ invite }: { invite: Invite }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleResend() {
    startTransition(async () => {
      const res = await resendInvite(invite.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Invite resent");
      router.refresh();
    });
  }

  function handleRevoke() {
    if (!confirm(`Revoke invite to ${invite.email}?`)) return;
    startTransition(async () => {
      const res = await revokeInvite(invite.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Invite revoked");
      router.refresh();
    });
  }

  return (
    <li className="px-5 py-4 flex items-center gap-4">
      <div className="size-9 rounded-full border-2 border-dashed bg-muted/30 text-muted-foreground grid place-items-center text-sm shrink-0">
        <Mail className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{invite.email}</div>
        <div className="text-xs text-muted-foreground">
          {invite.role === "admin" ? "Admin" : "User"} · invited{" "}
          {formatDateTime(invite.invited_at)}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        disabled={pending}
      >
        <RefreshCw className="size-3.5 mr-1.5" />
        Resend
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRevoke}
        disabled={pending}
      >
        <X className="size-3.5 mr-1.5" />
        Revoke
      </Button>
    </li>
  );
}

function InviteDialog({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await inviteTeammate({ email, role });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      setRole("user");
      onDone();
      router.refresh();
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Invite teammate</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Email
          </Label>
          <Input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Role
          </Label>
          <Select value={role} onValueChange={(v) => setRole(v as "admin" | "user")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">
                User — can quote, review extractions, manage parts
              </SelectItem>
              <SelectItem value="admin">
                Admin — also manages settings + invites
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          They&apos;ll receive a magic-link email from Supabase. The link sets
          their password and signs them in.
        </p>
        <DialogFooter>
          <Button type="submit" disabled={pending} className="rounded-full">
            {pending ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
