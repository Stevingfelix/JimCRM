"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Common country dial codes. Order: US first (most likely default for this
// app's audience), then alphabetical. Extend by appending — order in the list
// determines order in the dropdown.
export const COUNTRIES = [
  { code: "US", dial: "+1", flag: "🇺🇸", name: "United States" },
  { code: "CA", dial: "+1", flag: "🇨🇦", name: "Canada" },
  { code: "GB", dial: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "AU", dial: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "BR", dial: "+55", flag: "🇧🇷", name: "Brazil" },
  { code: "CN", dial: "+86", flag: "🇨🇳", name: "China" },
  { code: "DE", dial: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "ES", dial: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "FR", dial: "+33", flag: "🇫🇷", name: "France" },
  { code: "GH", dial: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "IE", dial: "+353", flag: "🇮🇪", name: "Ireland" },
  { code: "IN", dial: "+91", flag: "🇮🇳", name: "India" },
  { code: "IT", dial: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "JP", dial: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "KE", dial: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "MX", dial: "+52", flag: "🇲🇽", name: "Mexico" },
  { code: "NG", dial: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "NL", dial: "+31", flag: "🇳🇱", name: "Netherlands" },
  { code: "NZ", dial: "+64", flag: "🇳🇿", name: "New Zealand" },
  { code: "PH", dial: "+63", flag: "🇵🇭", name: "Philippines" },
  { code: "SG", dial: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "ZA", dial: "+27", flag: "🇿🇦", name: "South Africa" },
] as const;

type CountryCode = (typeof COUNTRIES)[number]["code"];

function splitPhone(value: string): { code: CountryCode; local: string } {
  const trimmed = value.trim();
  for (const c of COUNTRIES) {
    if (trimmed.startsWith(c.dial)) {
      return { code: c.code, local: trimmed.slice(c.dial.length).trimStart() };
    }
  }
  return { code: "US", local: trimmed };
}

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  id?: string;
};

// Phone input with the country flag/dial-code embedded inside the same
// rounded box as the local number field — single visual control, not two
// adjacent ones.
export function PhoneInput({ value, onChange, placeholder, id }: Props) {
  const initial = useMemo(() => splitPhone(value), [value]);
  const [code, setCode] = useState<CountryCode>(initial.code);
  const [local, setLocal] = useState<string>(initial.local);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const country = COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];

  function emit(nextCode: CountryCode, nextLocal: string) {
    const c = COUNTRIES.find((x) => x.code === nextCode) ?? COUNTRIES[0];
    const trimmed = nextLocal.trim();
    onChange(trimmed ? `${c.dial} ${trimmed}` : "");
  }

  // Click-outside to close the country list.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative" ref={wrapRef}>
      <div
        className={cn(
          // Mirror the Input component's surface so the inline trigger blends.
          "flex h-10 w-full items-center gap-2 rounded-md border bg-background text-sm",
          "border-input shadow-sm transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-1 h-full pl-3 pr-2 rounded-l-md hover:bg-muted/60 transition-colors shrink-0"
        >
          <span className="text-base leading-none">{country.flag}</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </button>
        <div className="h-5 w-px bg-border" />
        <input
          id={id}
          type="tel"
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            emit(code, e.target.value);
          }}
          placeholder={placeholder ?? `e.g. ${country.dial} 555-0199`}
          className="flex-1 bg-transparent h-full pr-3 outline-none placeholder:text-muted-foreground tabular-nums"
        />
      </div>
      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 left-0 w-72 max-h-60 overflow-auto rounded-lg border bg-card shadow-lg py-1"
        >
          {COUNTRIES.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => {
                  setCode(c.code);
                  emit(c.code, local);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted text-left",
                  c.code === code && "bg-muted",
                )}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {c.dial}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
