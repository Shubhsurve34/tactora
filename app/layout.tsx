import type { Metadata, Viewport } from "next";
import "@fontsource-variable/anybody/standard.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tactora | Football tactics board",
  description:
    "Set formations, move players and draw runs and passes on a football pitch, then share the tactic as a link. A ShubhTechIN project.",
  applicationName: "Tactora",
  openGraph: {
    type: "website",
    siteName: "Tactora",
    title: "Tactora | Football tactics board",
    description: "Set formations, move players, draw runs and passes, and share the tactic as a link.",
    locale: "en_IN",
  },
};

export const viewport: Viewport = {
  themeColor: "#E3E8E4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
