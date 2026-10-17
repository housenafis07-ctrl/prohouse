import type { MetadataRoute } from 'next'

const icons = [
  {
    src: '/icons/royalhouse-logo-192x192.png',
    sizes: '192x192',
    type: 'image/png',
  },
  {
    src: '/icons/royalhouse-logo-512x512.png',
    sizes: '512x512',
    type: 'image/png',
  },
]

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Royalhouse — Ko‘chmas mulk platformasi',
    short_name: 'Royalhouse',
    description: 'O‘zbekistonda uy topish, sotish, ijaraga olish va ko‘chmas mulk xizmatlaridan foydalanish platformasi.',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'uz',
    theme_color: '#ffffff',
    background_color: '#ffffff',
    icons,
    shortcuts: [
  {
    name: 'Uy qidirish',
    short_name: 'Qidirish',
    url: '/listings',
    icons,
  },
  {
    name: "E'lon joylashtirish",
    short_name: "E'lon",
    url: '/listings/new',
    icons,
  },
  {
    name: "Mening e'lonlarim",
    short_name: "E'lonlarim",
    url: '/account/listings',
    icons,
  },
  {
    name: 'Xabarlar',
    short_name: 'Chat',
    url: '/chat',
    icons,
  },
],
  }
}
