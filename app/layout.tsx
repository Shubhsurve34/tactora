import type { Metadata, Viewport } from "next";
import "@fontsource-variable/anybody/standard.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tactora | Football tactics board",
  description:
    "Build football moves step by step and play them back. Live space control, offside lines, team shape in metres, cover shadows and passing lanes. A ShubhTechIN project.",
  applicationName: "Tactora",
  openGraph: {
    type: "website",
    siteName: "Tactora",
    title: "Tactora | Football tactics board",
    description: "Animated moves, live space control, offside lines and team shape in metres.",
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
