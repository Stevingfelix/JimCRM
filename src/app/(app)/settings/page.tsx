import Link from "next/link";
import {
  Building2,
  Users,
  FileSpreadsheet,
  UserCircle,
  ArrowRight,
  ShieldOff,
} from "lucide-react";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    href: "/settings/profile",
    title: "Profile",
    blurb:
      "Your display name, sign-in email, and password. Affects how you appear in the sidebar and on quotes.",
    Icon: UserCircle,
  },
  {
    href: "/settings/company",
    title: "Company info",
    blurb:
      "Name, logo, address, contact details — the stuff that appears on quote PDFs and in the sidebar.",
    Icon: Building2,
  },
  {
    href: "/settings/team",
    title: "Team",
    blurb:
      "Invite teammates by email. Admins manage settings; users can quote and review.",
    Icon: Users,
  },
  {
    href: "/settings/exports",
    title: "CSV export profiles",
    blurb:
      "Configure column names and order to match your ERP's import format.",
    Icon: FileSpreadsheet,
  },
  {
    href: "/settings/sender-blocklist",
    title: "Sender blocklist",
    blurb:
      "Senders auto-added when you reject their emails in the review queue. Future emails from them are skipped before any LLM runs.",
    Icon: ShieldOff,
  },
];

export default function SettingsIndexPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 max-w-5xl">
      <p className="text-sm text-muted-foreground">
        Configure your business identity, team, and export formats.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {SECTIONS.map(({ href, title, blurb, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border bg-card p-5 hover:bg-muted/40 transition-colors flex items-start gap-4"
          >
            <div className="size-10 rounded-lg bg-brand-gradient-soft text-primary grid place-items-center shrink-0">
              <Icon className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{title}</h2>
                <ArrowRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{blurb}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
