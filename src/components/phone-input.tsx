"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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

// Parse a stored phone string back into [country, local]. We store the
// concatenated form (e.g. "+1 555-0199") so reads stay simple; the split is
// best-effort.
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

export function PhoneInput({ value, onChange, placeholder, id }: Props) {
  const initial = useMemo(() => splitPhone(value), [value]);
  const [code, setCode] = useState<CountryCode>(initial.code);
  const [local, setLocal] = useState<string>(initial.local);

  const country = COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];

  function emit(nextCode: CountryCode, nextLocal: string) {
    const c = COUNTRIES.find((x) => x.code === nextCode) ?? COUNTRIES[0];
    const trimmed = nextLocal.trim();
    onChange(trimmed ? `${c.dial} ${trimmed}` : "");
  }

  return (
    <div className="flex items-stretch gap-2">
      <Select
        value={code}
        onValueChange={(v) => {
          const nextCode = v as CountryCode;
          setCode(nextCode);
          emit(nextCode, local);
        }}
      >
        <SelectTrigger className="w-[110px] shrink-0">
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span className="text-base leading-none">{country.flag}</span>
              <span className="text-xs tabular-nums">{country.dial}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">{c.flag}</span>
                <span>{c.name}</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {c.dial}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          emit(code, e.target.value);
        }}
        placeholder={placeholder ?? "555-0199"}
        className="flex-1"
      />
    </div>
  );
}
