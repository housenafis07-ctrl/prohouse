'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type ListingQualityInput = Record<string, unknown>
type Result = { score: number; label: string; breakdown: { data: number; media: number; content: number; completeness: number }; recommendations: string[] }

export default function ListingQualityCard({ listingId, listing, language = 'uz' }: { listingId: string; listing: ListingQualityInput; language?: 'uz' | 'ru' }) {
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const ru = language === 'ru'

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      const db = createClient()
      const [{ count: imageCount }, { count: videoCount }] = await Promise.all([
        db.from('listing_images').select('id', { count: 'exact', head: true }).eq('listing_id', listingId),
        db.from('listing_media').select('id', { count: 'exact', head: true }).eq('listing_id', listingId).eq('media_type', 'video').eq('status', 'ready'),
      ])
      if (cancelled) return
      fetch('/api/ai/listing-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing: { ...listing, image_count: imageCount || 0, has_main_image: (imageCount || 0) > 0, has_video: (videoCount || 0) > 0 }, language }),
      }).then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!cancelled && response.ok && data?.score != null) setResult(data as Result)
      }).finally(() => { if (!cancelled) setLoading(false) })
    }
    void run()
    return () => { cancelled = true }
  }, [listingId, JSON.stringify(listing), language])

  if (loading && !result) return <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">{ru ? 'Оцениваем объявление…' : 'E’lon sifati baholanmoqda…'}</div>
  if (!result) return null

  return <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-4">
      <div><p className="text-sm font-extrabold text-slate-950">✨ {ru ? 'Качество объявления' : 'E’lon sifati'}</p><p className="mt-1 text-xs text-slate-500">{result.label}</p></div>
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-slate-900 text-lg font-black text-slate-950">{result.score}</div>
    </div>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${result.score}%` }} /></div>
    <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      <div className="rounded-xl bg-slate-50 p-3"><b>{result.breakdown.data}/25</b><span className="mt-1 block text-slate-500">{ru ? 'Данные' : 'Ma’lumotlar'}</span></div>
      <div className="rounded-xl bg-slate-50 p-3"><b>{result.breakdown.media}/30</b><span className="mt-1 block text-slate-500">{ru ? 'Фото/видео' : 'Rasm/video'}</span></div>
      <div className="rounded-xl bg-slate-50 p-3"><b>{result.breakdown.content}/20</b><span className="mt-1 block text-slate-500">{ru ? 'Контент' : 'Tavsif'}</span></div>
      <div className="rounded-xl bg-slate-50 p-3"><b>{result.breakdown.completeness}/10</b><span className="mt-1 block text-slate-500">{ru ? 'Полнота' : 'To‘liqlik'}</span></div>
    </div>
    {result.recommendations.length > 0 && <div className="mt-4 rounded-xl bg-amber-50 p-4"><p className="text-sm font-bold text-amber-950">💡 {ru ? 'Что можно улучшить' : 'Yaxshilash mumkin'}</p><ul className="mt-2 space-y-1 text-xs text-amber-900">{result.recommendations.map((item) => <li key={item}>+ {item}</li>)}</ul></div>}
  </div>
}
