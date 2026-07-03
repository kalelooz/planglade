import type { MetadataRoute } from "next";

const siteUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://planglade.com");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl.toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
