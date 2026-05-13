"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addContact, deleteContact, updateContact } from "../../actions";

type Contact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
};

export function ContactsEditor({
  customerId,
  initial,
}: {
  customerId: string;
  initial: Contact[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
  });
  const [pending, startTransition] = useTransition();

  const addDisabled =
    pending ||
    (!draft.name.trim() &&
      !draft.email.trim() &&
      !draft.phone.trim() &&
      !draft.role.trim());

  const onAdd = () => {
    if (addDisabled) return;
    startTransition(async () => {
      const result = await addContact({
        customer_id: customerId,
        name: draft.name || null,
        email: draft.email || null,
        phone: draft.phone || null,
        role: draft.role || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setDraft({ name: "", email: "", phone: "", role: "" });
      router.refresh();
    });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Name</TableHead>
            <TableHead className="w-[260px]">Email</TableHead>
            <TableHead className="w-[160px]">Phone</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {initial.map((c) => (
            <ContactRow key={c.id} customerId={customerId} contact={c} />
          ))}
          <TableRow>
            <TableCell>
              <Input
                placeholder="add contact…"
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAdd();
                  }
                }}
                className="h-8"
              />
            </TableCell>
            <TableCell>
              <Input
                type="email"
                value={draft.email}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, email: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAdd();
                  }
                }}
                className="h-8"
              />
            </TableCell>
            <TableCell>
              <Input
                value={draft.phone}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, phone: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAdd();
                  }
                }}
                className="h-8"
              />
            </TableCell>
            <TableCell>
              <Input
                value={draft.role}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, role: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAdd();
                  }
                }}
                className="h-8"
              />
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="ghost"
                onClick={onAdd}
                disabled={addDisabled}
              >
                add
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function ContactRow({
  customerId,
  contact,
}: {
  customerId: string;
  contact: Contact;
}) {
  const router = useRouter();
  const [name, setName] = useState(contact.name ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [role, setRole] = useState(contact.role ?? "");
  const [pending, startTransition] = useTransition();

  const dirty =
    name !== (contact.name ?? "") ||
    email !== (contact.email ?? "") ||
    phone !== (contact.phone ?? "") ||
    role !== (contact.role ?? "");

  const persist = () => {
    if (!dirty) return;
    startTransition(async () => {
      const result = await updateContact({
        id: contact.id,
        customer_id: customerId,
        name: name || null,
        email: email || null,
        phone: phone || null,
        role: role || null,
      });
      if (!result.ok) toast.error(result.error.message);
      else router.refresh();
    });
  };

  const remove = () => {
    if (!confirm(`Remove contact "${contact.name ?? contact.email ?? ""}"?`))
      return;
    startTransition(async () => {
      const result = await deleteContact({
        id: contact.id,
        customer_id: customerId,
      });
      if (!result.ok) toast.error(result.error.message);
      else router.refresh();
    });
  };

  return (
    <TableRow>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={persist}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={persist}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={persist}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onBlur={persist}
          className="h-8"
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="ghost"
          onClick={remove}
          disabled={pending}
        >
          ×
        </Button>
      </TableCell>
    </TableRow>
  );
}
