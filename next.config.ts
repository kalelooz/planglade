import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  async redirects() {
    return [
      {
        source: "/inbox",
        destination: "/app/inbox",
        permanent: false,
      },
      {
        source: "/projects",
        destination: "/app/projects",
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
        source: "/my-tasks",
        destination: "/app/tasks",
        permanent: false,
      },
      {
        source: "/work-items",
        destination: "/app/tasks?view=list",
        permanent: false,
      },
      {
        source: "/board",
        destination: "/app/tasks?view=board",
        permanent: false,
      },
      {
        source: "/report",
        destination: "/app/projects",
        permanent: false,
      },
      {
        source: "/timeline",
        destination: "/app/calendar",
        permanent: false,
      },
      {
        source: "/team",
        destination: "/app/settings",
        permanent: false,
      },
      {
        source: "/activity",
        destination: "/app",
        permanent: false,
      },
      {
        source: "/connections",
        destination: "/app/projects",
        permanent: false,
      },
      {
        source: "/work-map",
        destination: "/app/projects",
        permanent: false,
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
