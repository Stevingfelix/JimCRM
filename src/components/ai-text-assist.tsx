"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Mic, Sparkles, Square, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// Minimal Web Speech API types — TS doesn't ship them in the lib by default.
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

type Props<TResult> = {
  // Server action that takes the input text and returns extracted structured data.
  extractAction: (
    text: string,
  ) => Promise<
    | { ok: true; data: TResult }
    | { ok: false; error: { code: string; message: string } }
  >;
  // Called with the structured result; the consumer maps it into form state.
  onExtracted: (result: TResult) => void;
  placeholder?: string;
  // Used in voice mode for the "say something like..." example.
  hint?: string;
};

// A reusable AI-assist surface: paste/type or speak, hit Extract, get
// structured fields back. The consumer wires the action and the apply step;
// this component only owns the input UI.
export function AiTextAssist<T>({
  extractAction,
  onExtracted,
  placeholder,
  hint,
}: Props<T>) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [pending, startTransition] = useTransition();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseTextRef = useRef<string>("");

  // Stop recognition if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function startListening() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      toast.error(
        "Voice input isn't supported in this browser. Try Chrome or Edge.",
      );
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    baseTextRef.current = text ? text + " " : "";

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const transcript = r[0].transcript;
        if (r.isFinal) final += transcript;
        else interim += transcript;
      }
      setText(baseTextRef.current + final + interim);
      if (final) baseTextRef.current += final;
    };
    rec.onerror = (ev) => {
      if (ev.error !== "aborted" && ev.error !== "no-speech") {
        toast.error(`Voice error: ${ev.error}`);
      }
      setListening(false);
    };
    rec.onend = () => setListening(false);

    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function handleExtract() {
    if (!text.trim()) {
      toast.error("Type or speak something first");
      return;
    }
    startTransition(async () => {
      const res = await extractAction(text);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      onExtracted(res.data);
      toast.success("Fields filled — review and save");
    });
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-brand-gradient-soft p-3 space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <Sparkles className="size-3.5" />
        AI assist
        {hint && (
          <span className="font-normal text-muted-foreground">· {hint}</span>
        )}
      </div>
      <Textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          placeholder ??
          "Paste an email signature, describe the customer, or tap the mic and speak."
        }
        className="bg-card border-primary/20 focus-visible:ring-primary/30"
      />
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant={listening ? "destructive" : "outline"}
          size="sm"
          onClick={listening ? stopListening : startListening}
          className="rounded-full"
        >
          {listening ? (
            <>
              <Square className="size-3.5 mr-1.5 fill-current" />
              Stop
            </>
          ) : (
            <>
              <Mic className="size-3.5 mr-1.5" />
              Speak
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleExtract}
          disabled={pending || !text.trim()}
          className="rounded-full"
        >
          <Wand2 className="size-3.5 mr-1.5" />
          {pending ? "Extracting…" : "Fill with AI"}
        </Button>
      </div>
    </div>
  );
}
