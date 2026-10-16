import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Royalhouse — Ko‘chmas mulk platformasi",
    short_name: "Royalhouse",
    description:
      "O‘zbekistonda uy topish, sotish, ijaraga olish va ko‘chmas mulk xizmatlaridan foydalanish platformasi.",
    start_url: "/uz",
    scope: "/",
    id: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "uz",
    dir: "ltr",
    theme_color: "#ffffff",
    background_color: "#ffffff",
    categories: ["business", "lifestyle"],
    icons: [
      {
        src: "/royalhouse-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
    shortcuts: [
      {
        name: "Uy qidirish",
        short_name: "Qidirish",
        url: "/listings",
        icons: [{ src: "/royalhouse-icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      {
        name: "E’lon joylashtirish",
        short_name: "E’lon",
        url: "/listings/new",
        icons: [{ src: "/royalhouse-icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      {
        name: "Saqlanganlar",
        short_name: "Saqlangan",
        url: "/account/saved-searches",
        icons: [{ src: "/royalhouse-icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      {
        name: "Mening e’lonlarim",
        short_name: "E’lonlarim",
        url: "/account/listings",
        icons: [{ src: "/royalhouse-icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
    ],
  };
}
