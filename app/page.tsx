import type { Metadata } from 'next'
import HomeClient from './components/HomeClient'

export const metadata: Metadata = {
  title: 'Royalhouse — Ko‘chmas mulk platformasi',
  description: 'O‘zbekistonda uy topish, sotish, ijaraga olish va ipoteka uchun zamonaviy platforma.',
  alternates: {
    canonical: 'https://royalhouse.uz/',
    languages: {
      uz: 'https://royalhouse.uz/uz',
      ru: 'https://royalhouse.uz/ru',
      'x-default': 'https://royalhouse.uz/',
    },
  },
  openGraph: {
    locale: 'uz_UZ',
    url: 'https://royalhouse.uz/',
    siteName: 'Royalhouse',
    title: 'Royalhouse — Ko‘chmas mulk platformasi',
    description: 'O‘zbekistonda uy topish, sotish, ijaraga olish va ipoteka uchun zamonaviy platforma.',
  },
}

export default function HomePage() {
  return <HomeClient />
}
