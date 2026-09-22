import type { Metadata } from "next";
import "./globals.css";
import GlobalNavigationGate from "./components/GlobalNavigationGate";
import GlobalLanguageFix from "./components/GlobalLanguageFix";
import LegacySurfaceLanguageFix from "./components/LegacySurfaceLanguageFix";
import LanguageRuntimeFix from "./components/LanguageRuntimeFix";
import I18nProvider from "./components/I18nProvider";
import RentalNavigationFix from "./components/RentalNavigationFix";
import DailySearchNavigationFix from "./components/DailySearchNavigationFix";
import PurchaseNavigationFix from "./components/PurchaseNavigationFix";
import NewBuildingsNavigationFix from "./components/NewBuildingsNavigationFix";
import HomeBuildingNavigationFix from "./components/HomeBuildingNavigationFix";
import MobileMainNavigation from "./components/MobileMainNavigation";
import PushRegistration from "./components/PushRegistration";
import ListingCardIconStyle from "./components/ListingCardIconStyle";
import RoyalhouseBrandFix from "./components/RoyalhouseBrandFix";

export const metadata: Metadata = {
  title: "Royalhouse — Ko‘chmas mulk platformasi",
  description: "O‘zbekistonda uy topish, sotish, ijaraga olish va ipoteka uchun zamonaviy platforma.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz">
      <body>
        <I18nProvider>
          <RoyalhouseBrandFix />
          <GlobalLanguageFix />
          <LegacySurfaceLanguageFix />
          <LanguageRuntimeFix />
          <GlobalNavigationGate />
          <RentalNavigationFix />
          <DailySearchNavigationFix />
          <PurchaseNavigationFix />
          <NewBuildingsNavigationFix />
          <HomeBuildingNavigationFix />
          <MobileMainNavigation />
          <PushRegistration />
          <ListingCardIconStyle />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
