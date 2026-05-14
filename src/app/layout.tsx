import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Plus Jakarta Sans — rounded, humanist sans with a soft, premium feel.
// Loaded for all the typographic weights we use across the app.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Geist Mono retained for tabular / code snippets (kbd hints, formulas, etc).
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CAP Hardware Quoting",
  description: "Internal quoting tool for CAP Hardware Supply",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        {/* Mounted at the root so toasts work on the public /q/[token]
            portal too — that route is outside the (app) group so it
            doesn't inherit the in-app Toaster. The (app) layout still
            has its own Toaster; they live side-by-side without conflict. */}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
