import type { MetadataRoute } from "next";

const siteUrl = new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "https://planglade.com");

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPaths = ["/", "/demo", "/privacy", "/terms", "/security", "/contact"];

  return publicPaths.map((path, index) => ({
    url: new URL(path, siteUrl).toString(),
    changeFrequency: "weekly",
    priority: index === 0 ? 1 : 0.7,
  }));
}
