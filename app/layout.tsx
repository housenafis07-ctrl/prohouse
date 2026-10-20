import type { Metadata } from "next";
import "./globals.css";
import GlobalNavigationGate from "./components/GlobalNavigationGate";
import GlobalLanguageFix from "./components/GlobalLanguageFix";
import LegacySurfaceLanguageFix from "./components/LegacySurfaceLanguageFix";
import LanguageRuntimeFix from "./components/LanguageRuntimeFix";
import I18nProvider from "./components/I18nProvider";
import RentalNavigationFix from "./components/RentalNavigationFix";
import PurchaseNavigationFix from "./components/PurchaseNavigationFix";
import NewBuildingsNavigationFix from "./components/NewBuildingsNavigationFix";
import HomeBuildingNavigationFix from "./components/HomeBuildingNavigationFix";
import MobileMainNavigation from "./components/MobileMainNavigation";
import PushRegistration from "./components/PushRegistration";
import PwaServiceWorkerRegistration from "./components/PwaServiceWorkerRegistration";
import ListingCardIconStyle from "./components/ListingCardIconStyle";
import RoyalhouseBrandFix from "./components/RoyalhouseBrandFix";
import RoyalhouseFooterFix from "./components/RoyalhouseFooterFix";
import RoyalhouseContactFooter from "./components/RoyalhouseContactFooter";
import AuthLanguageFix from "./components/AuthLanguageFix";
import RoyalhousePartnersLinkFix from "./components/RoyalhousePartnersLinkFix";
import TaxCalculatorServiceFix from "./components/TaxCalculatorServiceFix";
import RoyalhouseMobileHomeRedesign from "./components/RoyalhouseMobileHomeRedesign";
import RoyalhouseMobileHomePolish from "./components/RoyalhouseMobileHomePolish";
import RoyalhouseMobileAISearch from "./components/RoyalhouseMobileAISearch";
import RoyalhousePwaHomeSearchFix from "./components/RoyalhousePwaHomeSearchFix";
import RoyalhousePwaAiSearchStyle from "./components/RoyalhousePwaAiSearchStyle";
import TelegramMiniAppAuth from "./components/TelegramMiniAppAuth";
import TelegramLoginButton from "./components/TelegramLoginButton";

export const metadata: Metadata = {
  title: "Royalhouse — Ko‘chmas mulk platformasi",
  description: "O‘zbekistonda uy topish, sotish, ijaraga olish va ipoteka uchun zamonaviy platforma.",
  alternates: { languages: { uz: 'https://royalhouse.uz/uz', ru: 'https://royalhouse.uz/ru', 'x-default': 'https://royalhouse.uz/uz' } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz">
      <body>
        <I18nProvider>
          <TelegramMiniAppAuth>
            <RoyalhouseBrandFix />
            <RoyalhouseFooterFix />
            <RoyalhouseContactFooter />
            <GlobalLanguageFix />
            <LegacySurfaceLanguageFix />
            <LanguageRuntimeFix />
            <AuthLanguageFix />
            <RoyalhousePartnersLinkFix />
            <GlobalNavigationGate />
            <RentalNavigationFix />
            <PurchaseNavigationFix />
            <NewBuildingsNavigationFix />
            <HomeBuildingNavigationFix />
            <MobileMainNavigation />
            <PwaServiceWorkerRegistration />
            <PushRegistration />
            <ListingCardIconStyle />
            <TaxCalculatorServiceFix />
            <RoyalhouseMobileHomeRedesign />
            <RoyalhouseMobileHomePolish />
            <RoyalhouseMobileAISearch />
            <RoyalhousePwaHomeSearchFix />
            <RoyalhousePwaAiSearchStyle />
            <TelegramLoginButton />
            {children}
          </TelegramMiniAppAuth>
        </I18nProvider>
      </body>
    </html>
  );
}
