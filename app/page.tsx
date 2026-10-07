import type { Metadata } from 'next'
import HomeClient from './components/HomeClient'

const SITE_URL = 'https://royalhouse.uz'

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

export const metadata: Metadata = {
  title: 'Royalhouse — Ko‘chmas mulk platformasi',
  description: 'O‘zbekistonda uy topish, sotish, ijaraga olish va ipoteka uchun zamonaviy platforma.',
  alternates: {
    canonical: SITE_URL,
    languages: {
      uz: `${SITE_URL}/uz`,
      ru: `${SITE_URL}/ru`,
      'x-default': SITE_URL,
    },
  },
  openGraph: {
    locale: 'uz_UZ',
    url: SITE_URL,
    siteName: 'Royalhouse',
    title: 'Royalhouse — Ko‘chmas mulk platformasi',
    description: 'O‘zbekistonda uy topish, sotish, ijaraga olish va ipoteka uchun zamonaviy platforma.',
  },
}

const websiteStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Royalhouse',
  alternateName: 'Royal House',
  url: SITE_URL,
}

const organizationStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Royalhouse',
  url: SITE_URL,
  logo: `${SITE_URL}/royalhouse-icon.svg`,
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(websiteStructuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(organizationStructuredData) }}
      />
      <HomeClient />
    </>
  )
}
