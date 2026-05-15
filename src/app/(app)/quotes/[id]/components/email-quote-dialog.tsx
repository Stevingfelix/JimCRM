"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatQuoteNumber } from "@/lib/format";
import { sendQuoteEmail } from "../email-actions";

type ContactOption = {
  name: string | null;
  email: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  quoteNumber: number;
  customerContacts: ContactOption[];
  defaultValidity: string | null;
};

export function EmailQuoteDialog({
  open,
  onOpenChange,
  quoteId,
  quoteNumber,
  customerContacts,
  defaultValidity,
}: Props) {
  const router = useRouter();
  const displayNumber = formatQuoteNumber(quoteNumber);

  const contactsWithEmail = customerContacts.filter(
    (c): c is ContactOption & { email: string } => !!c.email,
  );

  const [to, setTo] = useState(contactsWithEmail[0]?.email ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(
    `Quote ${displayNumber} from CAP Hardware Supply`,
  );
  const [body, setBody] = useState(buildDefaultBody(displayNumber, defaultValidity));
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) {
      toast.error("Enter a recipient email address");
      return;
    }
    startTransition(async () => {
      const result = await sendQuoteEmail({
        quote_id: quoteId,
        to: to.trim(),
        cc: cc.trim() || undefined,
        subject,
        body,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Quote emailed successfully");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader className="space-y-1.5">
            <DialogTitle>Email {displayNumber}</DialogTitle>
            <DialogDescription>
              Send this quote as a PDF attachment via Gmail.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {/* To field */}
            <div className="space-y-1.5">
              <Label htmlFor="email-to">To</Label>
              {contactsWithEmail.length > 0 ? (
                <Select value={to} onValueChange={(v) => setTo(v ?? "")}>
                  <SelectTrigger id="email-to">
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactsWithEmail.map((c) => (
                      <SelectItem key={c.email} value={c.email}>
                        {c.name ? `${c.name} (${c.email})` : c.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="email-to"
                  type="email"
                  placeholder="recipient@example.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  required
                />
              )}
              {/* Allow typing a custom email even when contacts exist */}
              {contactsWithEmail.length > 0 && (
                <Input
                  type="email"
                  placeholder="Or type a different email"
                  value={contactsWithEmail.some((c) => c.email === to) ? "" : to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1.5"
                />
              )}
            </div>

            {/* CC field */}
            <div className="space-y-1.5">
              <Label htmlFor="email-cc">CC (optional)</Label>
              <Input
                id="email-cc"
                type="email"
                placeholder="cc@example.com"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="email-body">Body</Label>
              <Textarea
                id="email-body"
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-xs"
                required
              />
            </div>

            {/* PDF indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span>PDF will be attached automatically</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || !to.trim()}
              className="h-11 rounded-full w-full text-sm gap-2"
            >
              <Mail className="h-4 w-4" />
              {pending ? "Sending..." : "Send email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function buildDefaultBody(
  displayNumber: string,
  validity: string | null,
): string {
  const validityLine = validity
    ? `This quote is valid until ${validity}.`
    : "Please let us know if you have any questions.";
  return `Hi,

Please find attached quote ${displayNumber} from CAP Hardware Supply.

${validityLine}

Don't hesitate to reach out if you need anything else.

Best regards,
Jim
CAP Hardware Supply`;
}
