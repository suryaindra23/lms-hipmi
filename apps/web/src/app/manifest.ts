import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sunrise Academy",
    short_name: "Sunrise Academy",
    description: "Pembelajaran dan praktik wirausaha digital yang inklusif.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fffdf8",
    theme_color: "#f97316",
    lang: "id",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
