import type { Metadata } from "next";
import "./globals.css";
import GlobalNavigationGate from "./components/GlobalNavigationGate";
import GlobalLanguageFix from "./components/GlobalLanguageFix";
import LegacySurfaceLanguageFix from "./components/LegacySurfaceLanguageFix";
import RentalNavigationFix from "./components/RentalNavigationFix";
import DailySearchNavigationFix from "./components/DailySearchNavigationFix";
import PurchaseNavigationFix from "./components/PurchaseNavigationFix";
import NewBuildingsNavigationFix from "./components/NewBuildingsNavigationFix";
import HomeBuildingNavigationFix from "./components/HomeBuildingNavigationFix";
import MobileMainNavigation from "./components/MobileMainNavigation";
import PushRegistration from "./components/PushRegistration";

export const metadata: Metadata = {
  title: "Prohouse — Ko‘chmas mulk platformasi",
  description: "O‘zbekistonda uy topish, sotish, ijaraga olish va ipoteka uchun zamonaviy platforma.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz">
      <body>
        <GlobalLanguageFix />
        <LegacySurfaceLanguageFix />
        <GlobalNavigationGate />
        <RentalNavigationFix />
        <DailySearchNavigationFix />
        <PurchaseNavigationFix />
        <NewBuildingsNavigationFix />
        <HomeBuildingNavigationFix />
        <MobileMainNavigation />
        <PushRegistration />
        {children}
      </body>
    </html>
  );
}
