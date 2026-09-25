import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import ListingDetailLanguageFix from './ListingDetailLanguageFix'
import { createClient } from '@/utils/supabase/server'

const SITE_URL = 'https://royalhouse.uz'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('listings')
    .select('id,title,title_ru,description,city,district,address,price,currency,listing_type,taxonomy_code,is_verified,listing_images(image_url,sort_order)')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle()

  if (!data) {
    return {
      title: 'E’lon topilmadi | RoyalHouse',
      robots: { index: false, follow: true },
    }
  }

  const isRental = data.listing_type === 'daily' || data.taxonomy_code === 'rent_dacha'
  const location = [data.city, data.district, data.address].filter(Boolean).join(', ')
  const price = data.price ? `${new Intl.NumberFormat('uz-UZ').format(Number(data.price))} ${data.currency === 'USD' ? '$' : 'so‘m'}` : ''
  const title = `${data.title}${location ? ` — ${location}` : ''} | RoyalHouse`
  const descriptionBase = (data.description || '').replace(/\s+/g, ' ').trim()
  const description = (isRental
    ? `${data.title} — dacha ijarasi${location ? `, ${location}` : ''}. Bo‘sh sanalarni kalendardan ko‘ring, kirish va chiqish kunlarini tanlang, narxni tekshiring va RoyalHouse orqali bron qiling.${price ? ` Narx: ${price}.` : ''}`
    : `${data.title}${location ? ` — ${location}` : ''}. ${descriptionBase || 'RoyalHouse platformasidagi ko‘chmas mulk e’loni.'}${price ? ` Narx: ${price}.` : ''}`
  ).slice(0, 300)
  const images = ((data.listing_images || []) as { image_url: string; sort_order: number | null }[]).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const firstImage = images[0]?.image_url
  const keywords = isRental
    ? [data.title, 'dacha ijarasi', 'dacha bron qilish', 'dacha Chorvoq', 'dacha Toshkent', 'dacha dam olish', 'dacha narxlari', 'dacha ijara kalendari', 'RoyalHouse']
    : [data.title, 'ko‘chmas mulk', 'uy sotiladi', 'kvartira sotiladi', location, 'RoyalHouse']

  return {
    title,
    description,
    keywords: keywords.filter(Boolean),
    alternates: { canonical: `${SITE_URL}/listings/${encodeURIComponent(id)}` },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
    openGraph: {
      type: 'website',
      url: `${SITE_URL}/listings/${encodeURIComponent(id)}`,
      siteName: 'RoyalHouse',
      title,
      description,
      locale: 'uz_UZ',
      images: firstImage ? [{ url: firstImage, width: 1600, height: 1200, alt: data.title }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description, images: firstImage ? [firstImage] : undefined },
  }
}

export default function ListingDetailLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ListingDetailLanguageFix />
    </>
  )
}
