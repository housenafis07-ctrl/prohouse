import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prohouse — Ko‘chmas mulk platformasi",
  description: "O‘zbekistonda uy topish, sotish, ijaraga olish va ipoteka uchun zamonaviy platforma.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
