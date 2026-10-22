import type { Metadata } from 'next'
import HomeClient from './components/HomeClient'

const HOME_HERO_IMAGE = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=85'

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
  return (
    <>
      <link rel="preconnect" href="https://images.unsplash.com" />
      <link rel="preload" as="image" href={HOME_HERO_IMAGE} />
      <HomeClient />
    </>
  )
}
