'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { getListingImageUrl } from '@/lib/listing-image'
import { formatMoney } from '@/lib/money'
import { rankSimilarListings, type ListingRecommendationSignal } from '@/lib/listing-recommendations'
import type { Lang } from '@/lib/i18n'

type ListingCandidate = ListingRecommendationSignal & {
  title: string
  title_ru?: string | null
  price: number
  currency: string
  city: string
  district: string | null
  primary_image_url?: string | null
  published_at?: string | null
}

type CurrentListing = ListingRecommendationSignal & {
  title: string
}

export default function ListingRecommendations({ listing, lang }: { listing: CurrentListing; lang: Lang }) {
  const [items, setItems] = useState<ListingCandidate[]>([])
  const { id, title, listing_type, property_type, taxonomy_code, city, district, is_mortgage_available } = listing

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const db = createClient()
        const { data, error } = await db
          .from('listing_search')
          .select('id,title,title_ru,listing_type,property_type,taxonomy_code,city,district,is_mortgage_available,price,currency,primary_image_url,published_at')
          .eq('status', 'active')
          .neq('id', id)
          .order('published_at', { ascending: false })
          .limit(150)

        if (error) throw error
        const candidates = (data || []) as ListingCandidate[]
        const ranked = rankSimilarListings(candidates, [{ id, title, listing_type, property_type, taxonomy_code, city, district, is_mortgage_available }], [], 4)
        if (!cancelled) setItems(ranked)
      } catch {
        if (!cancelled) setItems([])
      }
    }

    void load()
    return () => { cancelled = true }
  }, [id, title, listing_type, property_type, taxonomy_code, city, district, is_mortgage_available])

  if (!items.length) return null

  const titleFor = (item: ListingCandidate) => lang === 'ru' ? (item.title_ru || item.title) : item.title

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-black text-slate-950 sm:text-2xl">
          {lang === 'ru' ? 'Рекомендуем вам' : 'Sizga tavsiya etamiz'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {lang === 'ru' ? 'Похожие объявления с учётом категории и района' : 'Siz ko‘rayotgan e’longa kategoriya va hudud bo‘yicha o‘xshash e’lonlar'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {items.map((item) => {
          const image = item.primary_image_url ? getListingImageUrl(item.primary_image_url, 'card') : null
          return (
            <Link key={item.id} href={`/listings/${item.id}`} className="group min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                {image ? <img src={image} alt={titleFor(item)} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-3xl text-slate-300">⌂</div>}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 min-h-10 text-sm font-bold text-slate-900">{titleFor(item)}</p>
                <p className="mt-2 text-sm font-black text-emerald-700">{formatMoney(Number(item.price), item.currency, lang)}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{[item.district, item.city].filter(Boolean).join(', ')}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
