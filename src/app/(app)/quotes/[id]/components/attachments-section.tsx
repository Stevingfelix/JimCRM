"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  addQuoteAttachment,
  deleteQuoteAttachment,
} from "../../actions";

type Attachment = {
  id: string;
  drive_file_id: string;
  name: string;
  mime_type: string | null;
};

type Props = {
  quoteId: string;
  attachments: Attachment[];
};

// Google Picker integration. The script loader + GIS init are kept inline
// to avoid a global script tag on every page. Both scripts are loaded
// lazily on first picker open.
type GoogleAPI = {
  load: (lib: string, cb: () => void) => void;
};
type PickerAPI = {
  PickerBuilder: new () => {
    addView: (view: unknown) => ReturnType<PickerAPI["PickerBuilder"] extends new () => infer R ? () => R : never>;
    setOAuthToken: (token: string) => ReturnType<PickerAPI["PickerBuilder"] extends new () => infer R ? () => R : never>;
    setDeveloperKey: (key: string) => ReturnType<PickerAPI["PickerBuilder"] extends new () => infer R ? () => R : never>;
    setAppId: (id: string) => ReturnType<PickerAPI["PickerBuilder"] extends new () => infer R ? () => R : never>;
    setCallback: (cb: (data: unknown) => void) => ReturnType<PickerAPI["PickerBuilder"] extends new () => infer R ? () => R : never>;
    build: () => { setVisible: (v: boolean) => void };
  };
  DocsView: new () => unknown;
  Feature: { NAV_HIDDEN: unknown; MULTISELECT_ENABLED: unknown };
  Action: { PICKED: string };
  Response: { DOCUMENTS: string; ACTION: string };
  Document: { ID: string; NAME: string; MIME_TYPE: string };
};
type GoogleNS = {
  picker?: PickerAPI;
  accounts?: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: { access_token?: string; error?: string }) => void;
      }) => { requestAccessToken: () => void };
    };
  };
};

declare global {
  interface Window {
    gapi?: GoogleAPI;
    google?: GoogleNS;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export function AttachmentsSection({ quoteId, attachments }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [opening, setOpening] = useState(false);
  const accessTokenRef = useRef<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  const configured = Boolean(clientId && apiKey);

  useEffect(() => {
    if (!configured) return;
    // Preload Google scripts so the first pick is snappy.
    loadScript("https://apis.google.com/js/api.js").catch(() => {});
    loadScript("https://accounts.google.com/gsi/client").catch(() => {});
  }, [configured]);

  const openPicker = async () => {
    if (!configured) {
      toast.error(
        "Set NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY in .env.local",
      );
      return;
    }
    setOpening(true);
    try {
      await loadScript("https://apis.google.com/js/api.js");
      await loadScript("https://accounts.google.com/gsi/client");

      // 1. Get an access token via Google Identity Services.
      const token: string = await new Promise((resolve, reject) => {
        const client = window.google?.accounts?.oauth2.initTokenClient({
          client_id: clientId!,
          scope: "https://www.googleapis.com/auth/drive.file",
          callback: (response) => {
            if (response.access_token) resolve(response.access_token);
            else reject(new Error(response.error ?? "token error"));
          },
        });
        if (!client) reject(new Error("GIS not loaded"));
        else client.requestAccessToken();
      });
      accessTokenRef.current = token;

      // 2. Load Picker.
      await new Promise<void>((resolve) =>
        window.gapi!.load("picker", () => resolve()),
      );

      const picker = window.google!.picker!;
      const view = new picker.DocsView();
      const built = new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey!)
        .setCallback((data: unknown) => {
          const d = data as Record<string, unknown>;
          if (d[picker.Response.ACTION] !== picker.Action.PICKED) return;
          const docs =
            (d[picker.Response.DOCUMENTS] as Array<Record<string, unknown>>) ??
            [];
          if (docs.length === 0) return;
          startTransition(async () => {
            for (const doc of docs) {
              const id = String(doc[picker.Document.ID] ?? "");
              const name = String(doc[picker.Document.NAME] ?? "Untitled");
              const mime =
                (doc[picker.Document.MIME_TYPE] as string | undefined) ?? null;
              if (!id) continue;
              const result = await addQuoteAttachment({
                quote_id: quoteId,
                drive_file_id: id,
                name,
                mime_type: mime,
              });
              if (!result.ok) {
                toast.error(result.error.message);
                return;
              }
            }
            toast.success(
              `${docs.length} file${docs.length === 1 ? "" : "s"} attached`,
            );
            router.refresh();
          });
        })
        .build();
      built.setVisible(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "picker failed";
      toast.error(message);
    } finally {
      setOpening(false);
    }
  };

  const remove = (attachment: Attachment) => {
    if (!confirm(`Remove attachment "${attachment.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteQuoteAttachment({
        id: attachment.id,
        quote_id: quoteId,
      });
      if (!result.ok) toast.error(result.error.message);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {attachments.length === 0 ? (
          <li className="text-sm text-muted-foreground italic">
            No attachments yet.
          </li>
        ) : (
          attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
            >
              <a
                href={`https://drive.google.com/file/d/${a.drive_file_id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline truncate flex-1 mr-3"
              >
                📎 {a.name}
              </a>
              <button
                type="button"
                onClick={() => remove(a)}
                disabled={pending}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                remove
              </button>
            </li>
          ))
        )}
      </ul>
      <Button size="sm" variant="outline" onClick={openPicker} disabled={opening}>
        {opening ? "Opening Drive…" : "+ Pick from Drive"}
      </Button>
      {!configured && (
        <p className="text-xs text-muted-foreground">
          Configure <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> and{" "}
          <code>NEXT_PUBLIC_GOOGLE_API_KEY</code> to enable the picker.
        </p>
      )}
    </div>
  );
}
