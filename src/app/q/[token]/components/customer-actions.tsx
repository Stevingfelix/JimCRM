"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { recordCustomerDecision } from "../actions";

export function CustomerActions({ token }: { token: string }) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (decision: "won" | "lost") => {
    startTransition(async () => {
      const result = await recordCustomerDecision({
        token,
        decision,
        reason: reason || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        decision === "won"
          ? "Thanks — we'll be in touch shortly."
          : "Thanks for letting us know.",
      );
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border bg-card p-6 space-y-4">
      <div className="text-sm font-medium">Ready to decide?</div>
      {!showReject ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => submit("won")}
            disabled={pending}
            className="h-12 rounded-full flex-1"
          >
            ✓ Accept quote
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowReject(true)}
            disabled={pending}
            className="h-12 rounded-full flex-1"
          >
            Decline
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm">
            Briefly, what's the reason? (Optional — helps us improve our
            quotes.)
          </div>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Price was too high, going with another vendor, etc."
          />
          <div className="flex gap-3">
            <Button
              onClick={() => submit("lost")}
              disabled={pending}
              className="h-11 rounded-full flex-1"
            >
              {pending ? "Sending…" : "Confirm decline"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowReject(false);
                setReason("");
              }}
              disabled={pending}
              className="h-11 rounded-full"
            >
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
