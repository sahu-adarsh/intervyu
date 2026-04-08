import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PostHogProvider } from "@/components/PostHogProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "intervyu.io | AI Interview Prep",
    template: "%s | intervyu.io",
  },
  description:
    "Practice real voice interviews with Neerja, our AI interviewer. Get live code evaluation, CV analysis, and a detailed performance report. Land your dream job at Google, Amazon, Microsoft, and more.",
  keywords: [
    "interview prep",
    "AI interview",
    "mock interview",
    "coding interview",
    "system design interview",
    "voice interview practice",
    "Google interview prep",
    "Amazon interview prep",
    "software engineer interview",
  ],
  metadataBase: new URL("https://intervyu.io"),
  openGraph: {
    type: "website",
    url: "https://intervyu.io",
    title: "intervyu.io | AI Interview Prep",
    description:
      "Practice real voice interviews with Neerja, our AI interviewer. Live code evaluation, CV analysis, and performance reports — all in one session.",
    siteName: "intervyu.io",
    images: [
      {
        url: "/favicon-64.png",
        width: 64,
        height: 64,
        alt: "intervyu.io logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "intervyu.io | AI Interview Prep",
    description:
      "Practice real voice interviews with AI. Live code evaluation, CV analysis, and performance reports.",
  },
  icons: {
    icon: [
      { url: "/favicon-64.png", sizes: "64x64", type: "image/png" },
    ],
    shortcut: "/favicon-64.png",
    apple: "/favicon-64.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
