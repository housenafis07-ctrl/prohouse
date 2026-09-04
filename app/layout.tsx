import type { Metadata } from "next";
import "./globals.css";
import GlobalNavigationFix from "./components/GlobalNavigationFix";

export const metadata: Metadata = {
  title: "Prohouse — Ko‘chmas mulk platformasi",
  description: "O‘zbekistonda uy topish, sotish, ijaraga olish va ipoteka uchun zamonaviy platforma.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz">
      <body>
        <GlobalNavigationFix />
        {children}
      </body>
    </html>
  );
}
