import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ipoteka imkoniyatlari | Ипотечные возможности — Royalhouse',
  description: 'Daromad, kreditlar va boshlang‘ich badal asosida taxminiy ipoteka imkoniyatingizni hisoblang va mos banklar hamda uylarni toping.',
  alternates: { canonical: '/ipoteka/imkoniyatlari' },
  openGraph: {
    title: 'Ipoteka imkoniyatlari | Royalhouse',
    description: 'Taxminiy ipoteka imkoniyatini hisoblang, mos banklar va uylarni toping.',
    type: 'website',
    url: 'https://royalhouse.uz/ipoteka/imkoniyatlari',
  },
  robots: { index: true, follow: true },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
