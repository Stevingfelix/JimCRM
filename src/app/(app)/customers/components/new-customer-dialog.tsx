"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/phone-input";
import {
  AiTextPanel,
  AiVoicePanel,
  AiTriggerButtons,
} from "@/components/ai-text-assist";
import { cn } from "@/lib/utils";
import {
  createCustomer,
  extractCustomerFromText,
  type ExtractedCustomer,
} from "../actions";

type Props = {
  // If provided, called instead of redirecting to the customer detail page
  // after save. Useful when the dialog is opened from another flow (e.g. the
  // quote builder) where we want the new customer selected in place.
  onCreated?: (customer: { id: string; name: string }) => void;
  // Custom trigger element. Defaults to a "+ New customer" pill button.
  trigger?: React.ReactNode;
  // Pre-fill hints (e.g. from an inbound email sender).
  defaultContactName?: string;
  defaultEmail?: string;
};

export function NewCustomerDialog({ onCreated, trigger, defaultContactName, defaultEmail }: Props = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [aiMode, setAiMode] = useState<"voice" | "text" | null>(null);
  const [processing, setProcessing] = useState(false);

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState(defaultContactName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setBillingAddress("");
    setAiMode(null);
    setProcessing(false);
  };

  function applyExtraction(r: ExtractedCustomer) {
    if (r.company_name) setName(r.company_name);
    if (r.contact_name) setContactName(r.contact_name);
    if (r.contact_email) setEmail(r.contact_email);
    if (r.contact_phone) setPhone(r.contact_phone);
    if (r.billing_address) setBillingAddress(r.billing_address);
  }

  // Wrap the extract action so we can flip the form into a "processing"
  // visual state (blurred / dimmed) while Claude is working. The toast
  // notification itself comes from the AI panel.
  async function trackedExtract(text: string) {
    setProcessing(true);
    try {
      return await extractCustomerFromText(text);
    } finally {
      setProcessing(false);
    }
  }

  const canSubmit = name.trim().length > 0 || contactName.trim().length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Provide a company or contact name");
      return;
    }
    const finalName = name.trim() || contactName.trim();
    startTransition(async () => {
      const result = await createCustomer({
        name: finalName,
        billing_address: billingAddress.trim() || null,
        primary_contact:
          contactName || email || phone
            ? {
                name: contactName.trim() || null,
                email: email.trim() || null,
                phone: phone.trim() || null,
                role: null,
              }
            : null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Customer saved");
      reset();
      setOpen(false);
      if (onCreated) {
        onCreated({ id: result.data.id, name: finalName });
      } else {
        router.push(`/customers/${result.data.id}`);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger render={<Button className="h-10 rounded-full px-5" />}>
          + New customer
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-0">
          <div className="flex items-center justify-between gap-3 pr-10">
            <DialogTitle>Add New Customer</DialogTitle>
            <AiTriggerButtons
              active={aiMode}
              onPick={setAiMode}
              disabled={processing}
            />
          </div>
        </DialogHeader>

        {aiMode === "text" && (
          <AiTextPanel
            extractAction={trackedExtract}
            onExtracted={(r) => applyExtraction(r as ExtractedCustomer)}
            onClose={() => setAiMode(null)}
          />
        )}

        {aiMode === "voice" && (
          <AiVoicePanel
            extractAction={trackedExtract}
            onExtracted={(r) => applyExtraction(r as ExtractedCustomer)}
            onClose={() => setAiMode(null)}
          />
        )}

        {/* Form blurs while AI is processing — the loading toast is the
            foreground element. */}
        <form
          onSubmit={onSubmit}
          className={cn(
            "space-y-4 transition-all",
            processing && "blur-sm opacity-60 pointer-events-none",
          )}
          aria-busy={processing}
        >
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name" className="text-sm font-medium">
                Company Name{" "}
                <span className="text-muted-foreground font-normal">
                  (Optional if contact name given)
                </span>
              </Label>
              <Input
                id="name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="contact-name" className="text-sm font-medium">
                Contact Name{" "}
                <span className="text-muted-foreground font-normal">
                  (Optional if company name given)
                </span>
              </Label>
              <Input
                id="contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address{" "}
                  <span className="text-muted-foreground font-normal">
                    (Optional)
                  </span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. billing@acmecorp.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone" className="text-sm font-medium">
                  Phone Number
                </Label>
                <PhoneInput
                  id="phone"
                  value={phone}
                  onChange={setPhone}
                  placeholder="e.g. +1 555-0199"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="billing" className="text-sm font-medium">
                Billing Address
              </Label>
              <Textarea
                id="billing"
                rows={3}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="e.g. 123 Industry Way, NY"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={pending || !canSubmit}
            className="h-11 rounded-full w-full text-sm"
          >
            {pending ? "Saving…" : "Save Customer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
