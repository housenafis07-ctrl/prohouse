import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Siz qancha uy olishingiz mumkin? | Сколько жилья вам по карману? — Royalhouse',
  description: 'Daromad, kreditlar, boshlang‘ich badal va muddat asosida taxminiy uy budjetingizni hisoblang va mos obyektlarni toping.',
  alternates: { canonical: '/ipoteka/uy-qancha' },
  openGraph: {
    title: 'Siz qancha uy olishingiz mumkin? | Royalhouse',
    description: 'Uy budjetingizni hisoblang va mos ipotekali obyektlarni toping.',
    type: 'website',
    url: 'https://royalhouse.uz/ipoteka/uy-qancha',
  },
  robots: { index: true, follow: true },
}
export default function Layout({ children }: { children: React.ReactNode }) { return children }
