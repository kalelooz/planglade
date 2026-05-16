import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-af93d52f-b25f-4255-9aaa-f53ad0739b81.space-z.ai",
    ".space-z.ai",
    ".space.chatglm.site",
    "127.0.0.1",
    "localhost",
  ],
};

export default nextConfig;
