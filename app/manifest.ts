import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  const icon = { src: '/royalhouse-icon.svg', sizes: 'any', type: 'image/svg+xml' }

  return {
    name: 'Royalhouse — Ko‘chmas mulk platformasi',
    short_name: 'Royalhouse',
    description:
      'O‘zbekistonda uy topish, sotish, ijaraga olish va ko‘chmas mulk xizmatlaridan foydalanish platformasi.',
    start_url: '/uz',
    scope: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'uz',
    theme_color: '#ffffff',
    background_color: '#ffffff',
    icons: [icon],
    shortcuts: [
      {
        name: 'Uy qidirish',
        short_name: 'Qidirish',
        url: '/listings',
        icons: [icon],
      },
      {
        name: 'E’lon joylashtirish',
        short_name: 'E’lon',
        url: '/listings/new',
        icons: [icon],
      },
      {
        name: 'Mening e’lonlarim',
        short_name: 'E’lonlarim',
        url: '/account/listings',
        icons: [icon],
      },
      {
        name: 'Xabarlar',
        short_name: 'Chat',
        url: '/chat',
        icons: [icon],
      },
    ],
  }
}
