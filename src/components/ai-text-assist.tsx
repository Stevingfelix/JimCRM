"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Mic, Sparkles, Square, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Web Speech API ────────────────────────────────────────────────────
// TS doesn't ship these lib types by default.

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionInstance)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ─── Shared types ──────────────────────────────────────────────────────

type ExtractFn<T> = (
  text: string,
) => Promise<
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }
>;

type CommonProps<T> = {
  extractAction: ExtractFn<T>;
  onExtracted: (result: T) => void;
  onClose: () => void;
};

// ─── Voice panel ───────────────────────────────────────────────────────
// Auto-starts recording on mount. Live transcript appears as user speaks.
// "Stop" ends recording and sends the transcript to the extractor.

export function AiVoicePanel<T>({
  extractAction,
  onExtracted,
  onClose,
}: CommonProps<T>) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [pending, startTransition] = useTransition();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseRef = useRef<string>("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      toast.error(
        "Voice input isn't supported in this browser. Try Chrome or Edge.",
      );
      onClose();
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) final += text;
        else interim += text;
      }
      setTranscript(baseRef.current + final + interim);
      if (final) baseRef.current += final;
    };
    rec.onerror = (ev) => {
      if (ev.error !== "aborted" && ev.error !== "no-speech") {
        toast.error(`Voice error: ${ev.error}`);
      }
      setListening(false);
    };
    rec.onend = () => setListening(false);

    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch {
      toast.error("Microphone permission denied");
      onClose();
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, [onClose]);

  function handleStop() {
    recognitionRef.current?.stop();
    setListening(false);
    const text = (baseRef.current || transcript).trim();
    if (!text) {
      toast.error("Didn't catch anything — try again");
      onClose();
      return;
    }
    const toastId = toast.loading("Processing Voice AI…");
    startTransition(async () => {
      const res = await extractAction(text);
      toast.dismiss(toastId);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      onExtracted(res.data);
      toast.success("Fields filled — review and save");
      onClose();
    });
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-brand-gradient-soft p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <span
          className={cn(
            "inline-flex size-2 rounded-full",
            listening ? "bg-rose-500 animate-pulse" : "bg-muted-foreground/40",
          )}
        />
        {listening ? "Listening…" : "Recording stopped"}
      </div>
      <div className="rounded-lg bg-card border border-primary/20 p-3 min-h-[80px] text-sm">
        {transcript ? (
          <p className="whitespace-pre-wrap">{transcript}</p>
        ) : (
          <p className="text-muted-foreground italic">
            Start speaking — &ldquo;Acme Group, John Doe, 555-0199,
            billing@acmegroup.com…&rdquo;
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            recognitionRef.current?.stop();
            onClose();
          }}
          disabled={pending}
          className="rounded-full"
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleStop}
          disabled={pending}
          className="rounded-full"
        >
          <Square className="size-3.5 mr-1.5 fill-current" />
          Stop &amp; Process
        </Button>
      </div>
    </div>
  );
}

// ─── Text panel ────────────────────────────────────────────────────────
// Free-form textarea + Cancel / Fill Details. Sends the text to the
// extractor and applies the result via onExtracted.

export function AiTextPanel<T>({
  extractAction,
  onExtracted,
  onClose,
  placeholder,
  title,
}: CommonProps<T> & {
  placeholder?: string;
  title?: string;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!text.trim()) {
      toast.error("Type something first");
      return;
    }
    const toastId = toast.loading("Processing with AI…");
    startTransition(async () => {
      const res = await extractAction(text);
      toast.dismiss(toastId);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      onExtracted(res.data);
      toast.success("Fields filled — review and save");
      onClose();
    });
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-brand-gradient-soft p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="size-4 text-primary" />
        <span className="font-medium">
          {title ?? "Describe the customer in plain language."}
        </span>
      </div>
      <Textarea
        rows={3}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          placeholder ??
          "e.g. John Smith from Acme Corp, john@acme.com, +1 555-0199, 123 Main St NY"
        }
        className="bg-card border-primary/20 focus-visible:ring-primary/30"
        disabled={pending}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={pending}
          className="rounded-full"
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={pending || !text.trim()}
          className="rounded-full"
        >
          <Wand2 className="size-3.5 mr-1.5" />
          Fill Details
        </Button>
      </div>
    </div>
  );
}

// ─── Trigger buttons ───────────────────────────────────────────────────
// Two circular icon buttons used at the top of the dialog header.

export function AiTriggerButtons({
  active,
  onPick,
  disabled,
}: {
  active: "voice" | "text" | null;
  onPick: (mode: "voice" | "text") => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onPick("voice")}
        disabled={disabled}
        aria-pressed={active === "voice"}
        aria-label="Fill with voice"
        title="Fill with voice"
        className={cn(
          "size-8 rounded-full grid place-items-center transition-colors disabled:opacity-50",
          active === "voice"
            ? "bg-primary text-primary-foreground"
            : "bg-brand-gradient-soft text-primary hover:opacity-90",
        )}
      >
        <Mic className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onPick("text")}
        disabled={disabled}
        aria-pressed={active === "text"}
        aria-label="Fill with AI"
        title="Fill with AI"
        className={cn(
          "size-8 rounded-full grid place-items-center transition-colors disabled:opacity-50",
          active === "text"
            ? "bg-primary text-primary-foreground"
            : "bg-brand-gradient-soft text-primary hover:opacity-90",
        )}
      >
        <Wand2 className="size-4" />
      </button>
    </div>
  );
}
