import type { NextConfig } from "next";

type CspOptions = {
  nodeEnv: string | undefined;
  umamiSrc: string | undefined;
  umamiWebsiteId: string | undefined;
};

export function buildContentSecurityPolicy({
  nodeEnv,
  umamiSrc,
  umamiWebsiteId,
}: CspOptions) {
  let umamiOrigin: string | undefined;

  if (umamiSrc && umamiWebsiteId) {
    try {
      const url = new URL(umamiSrc);
      if (url.protocol === "https:" || (nodeEnv !== "production" && url.protocol === "http:")) {
        umamiOrigin = url.origin;
      }
    } catch {
      // Invalid optional analytics configuration fails closed.
    }
  }

  const analyticsSource = umamiOrigin ? ` ${umamiOrigin}` : "";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${nodeEnv === "development" ? " 'unsafe-eval'" : ""}${analyticsSource}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${analyticsSource}`,
    ...(nodeEnv === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    const contentSecurityPolicy = buildContentSecurityPolicy({
      nodeEnv: process.env.NODE_ENV,
      umamiSrc: process.env.NEXT_PUBLIC_UMAMI_SRC,
      umamiWebsiteId: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
    });

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/setup",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ]
  },
};

export default nextConfig;
