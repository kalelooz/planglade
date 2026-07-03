import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/lovable/theme-provider";
import { AuthProvider } from "@/components/lovable/auth-context";
import { AppSettingsBridge } from "@/components/lovable/app-settings-bridge";

const metadataBase = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
const umamiSrc = process.env.NEXT_PUBLIC_UMAMI_SRC;
const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

const geistSans = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase,
  title: "PlanGlade",
  description: "A calm clearing for your projects.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/brand/logo-mark.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "PlanGlade",
    description: "A calm clearing for your projects.",
    images: [{ url: "/brand/og-image.png", width: 1280, height: 640, alt: "PlanGlade" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PlanGlade",
    description: "A calm clearing for your projects.",
    images: ["/brand/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

function UmamiAnalytics() {
  if (!umamiSrc || !umamiWebsiteId) {
    return null;
  }

  return (
    <Script
      src={umamiSrc}
      data-website-id={umamiWebsiteId}
      strategy="afterInteractive"
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AppSettingsBridge />
            {children}
            <UmamiAnalytics />
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
