import type { Metadata } from "next";
import { Suspense }          from "react";
import { Anton, Inter, JetBrains_Mono } from "next/font/google";
import { PostHogProvider }   from "@/components/providers/posthog-provider";
import { AuthProvider }      from "@/lib/supabase/auth-provider";
import { UpgradeBanner }     from "@/components/auth/upgrade-banner";
import "./globals.css";

/* ── Fonts ────────────────────────────────────────────────────────────────────
   Anton     → --font-display  (condensed grotesque, headlines/wordmark)
   Inter     → --font-body     (clean grotesque, body copy)
   JetBrains → --font-mono     (ALL numbers: ranks, vote counts, stats)
   Exposed as CSS vars so Tailwind @theme picks them up via globals.css.
──────────────────────────────────────────────────────────────────────────── */
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Streets — Underground Music Discovery",
  description:
    "The community-ranked discovery engine for emerging artists. Be early. Be right.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-bone text-ink">
        <PostHogProvider>
          <AuthProvider>
            <Suspense>
              <UpgradeBanner />
            </Suspense>
            {children}
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
