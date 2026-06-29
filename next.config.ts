import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
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
  allowedDevOrigins: [
    "preview-chat-af93d52f-b25f-4255-9aaa-f53ad0739b81.space-z.ai",
    ".space-z.ai",
    ".space.chatglm.site",
    "127.0.0.1",
    "localhost",
  ],
};

export default nextConfig;
