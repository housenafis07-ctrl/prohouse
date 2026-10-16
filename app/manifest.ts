import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
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
    icons: [
      {
        src: '/royalhouse-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
