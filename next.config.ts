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
  allowedDevOrigins: process.env.NODE_ENV === "development" ? ["127.0.0.1"] : undefined,
  env: {
    PLANGLADE_BUILD_DEMO_READ_ONLY:
      process.env.PLANGLADE_NETLIFY_DEMO_READ_ONLY?.trim().toLowerCase() === "true"
        ? "true"
        : "false",
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
  async redirects() {
    return [
      {
        source: "/landing",
        destination: "/",
        permanent: true,
      },
      {
        source: "/inbox",
        destination: "/app/inbox",
        permanent: false,
      },
      {
        source: "/tasks",
        destination: "/app/tasks",
        permanent: false,
      },
      {
        source: "/notes",
        destination: "/app/notes",
        permanent: false,
      },
      {
        source: "/calendar",
        destination: "/app/calendar",
        permanent: false,
      },
      {
        source: "/settings",
        destination: "/app/settings",
        permanent: false,
      },
      {
        source: "/board",
        destination: "/app/tasks?view=board",
        permanent: false,
      },
      {
        source: "/my-tasks",
        destination: "/app/tasks?filter=mine",
        permanent: false,
      },
      {
        source: "/dashboard",
        destination: "/app",
        permanent: true,
      },
      {
        source: "/graph-view",
        destination: "/app",
        permanent: true,
      },
      {
        source: "/activity-log",
        destination: "/app",
        permanent: true,
      },
      {
        source: "/work-items",
        destination: "/app/tasks",
        permanent: true,
      },
      {
        source: "/project-report",
        destination: "/app/projects",
        permanent: true,
      },
      {
        source: "/report",
        destination: "/app/projects",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
