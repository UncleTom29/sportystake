import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/*",
          "/api/admin",
          "/api/admin/*",
          "/api/auth",
          "/api/auth/*",
        ],
      },
    ],
    sitemap: "https://sportystake.com/sitemap.xml",
  };
}
