import Link from "next/link";
import { Building2, Users, FileSpreadsheet, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const SECTIONS = [
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
];

export default function SettingsIndexPage() {
  return (
    <div className="px-8 py-8 space-y-6 max-w-5xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your business identity, team, and export formats.
        </p>
      </div>

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
