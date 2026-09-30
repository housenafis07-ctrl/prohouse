import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Uylarni solishtirish | Сравнение объектов — Royalhouse',
  description: 'Royalhouse’da 3 tagacha ko‘chmas mulk obyektini narx, maydon, m² narxi, ipoteka va joylashuv bo‘yicha solishtiring.',
  alternates: { canonical: '/solishtirish' },
  openGraph: {
    title: 'Uylarni solishtirish | Royalhouse',
    description: '3 tagacha uy-joy obyektini asosiy ko‘rsatkichlar bo‘yicha taqqoslang.',
    type: 'website',
    url: 'https://royalhouse.uz/solishtirish',
  },
  robots: { index: true, follow: true },
}
export default function Layout({ children }: { children: React.ReactNode }) { return children }
