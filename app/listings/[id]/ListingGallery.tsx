'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type ListingImage = { image_url: string; sort_order: number | null }

const storagePathFromPublicUrl = (value: string) => {
  try { const url = new URL(value); const marker = '/storage/v1/object/public/listing-images/'; const index = url.pathname.indexOf(marker); return index >= 0 ? decodeURIComponent(url.pathname.slice(index + marker.length)) : null } catch { return null }
}

const rentalAmenityIcons: Record<string, string> = {
  'Ochiq hovuz': '🏊', 'Yopiq hovuz': '🏊', 'Wi‑Fi': '📶', 'Avtoturargoh': '🚗',
  'Oshxona': '🍳', 'Barbekyu': '🍖', 'Karaoke': '🎤', 'Bilyard': '🎱', 'Stol tennisi': '🏓',
  'Sauna': '♨️', 'Bolalar maydonchasi': '🛝', 'Jakuzi': '🛁',
  'Бассейн': '🏊', 'Крытый бассейн': '🏊', 'Парковка': '🚗', 'Кухня': '🍳', 'Барбекю': '🍖',
  'Караоке': '🎤', 'Бильярд': '🎱', 'Настольный теннис': '🏓', 'Сауна': '♨️', 'Джакузи': '🛁',
  'Wi-Fi': '📶'
}

const rentalUiCss = `
  /* RoyalHouse rental amenities: one source of truth + Bronla-style compact chips */
  section.mt-8.space-y-5 > div:nth-child(2) { display: none !important; }
  section.mt-5.grid.gap-5 > div:nth-child(2) .mt-4.flex.flex-wrap.gap-2 {
    display: grid !important;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px !important;
  }
  section.mt-5.grid.gap-5 > div:nth-child(2) .mt-4.flex.flex-wrap.gap-2 > span {
    display: flex !important;
    align-items: center;
    gap: 8px;
    min-width: 0;
    border: 1px solid #e8eef0;
    border-radius: 12px !important;
    background: #fff !important;
    padding: 9px 10px !important;
    color: #263944 !important;
    font-size: 12px !important;
    font-weight: 800 !important;
    line-height: 1.2;
    box-shadow: 0 2px 8px rgba(9,33,44,.04);
  }
  section.mt-5.grid.gap-5 > div:nth-child(2) .mt-4.flex.flex-wrap.gap-2 > span::before {
    content: attr(data-rh-icon);
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: #eefaf3;
    font-size: 16px;
  }
  @media (max-width: 767px) {
    section.mt-5.grid.gap-5 > div:nth-child(2) .mt-4.flex.flex-wrap.gap-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px !important;
    }
    section.mt-5.grid.gap-5 > div:nth-child(2) .mt-4.flex.flex-wrap.gap-2 > span {
      padding: 8px !important;
      border-radius: 11px !important;
      font-size: 11px !important;
    }
    section.mt-5.grid.gap-5 > div:nth-child(2) .mt-4.flex.flex-wrap.gap-2 > span::before {
      width: 27px;
      height: 27px;
      flex-basis: 27px;
      font-size: 14px;
    }
  }
  @media (max-width: 380px) {
    section.mt-5.grid.gap-5 > div:nth-child(2) .mt-4.flex.flex-wrap.gap-2 > span {
      font-size: 10px !important;
    }
  }
`

export default function ListingGallery({ images, title }: { images: ListingImage[]; title: string }) {
  const [activeImage, setActiveImage] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [resolved, setResolved] = useState<Record<number, string>>({})
  const [resolving, setResolving] = useState<Record<number, boolean>>({})
  const safeIndex = Math.min(activeImage, Math.max(images.length - 1, 0))
  const current = images[safeIndex]
  const previousImage = () => setActiveImage(i => images.length ? (i - 1 + images.length) % images.length : 0)
  const nextImage = () => setActiveImage(i => images.length ? (i + 1) % images.length : 0)

  useEffect(() => {
    if (!lightbox) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightbox(false); if (event.key === 'ArrowLeft') previousImage(); if (event.key === 'ArrowRight') nextImage() }
    window.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [lightbox])

  useEffect(() => {
    const root = document.querySelector('section.mt-5.grid.gap-5 > div:nth-child(2) .mt-4.flex.flex-wrap.gap-2')
    if (!root) return
    root.querySelectorAll('span').forEach(node => {
      const label = node.textContent?.trim() || ''
      const icon = rentalAmenityIcons[label]
      if (icon) node.setAttribute('data-rh-icon', icon)
    })
  }, [])

  if (!images.length) return <div className="flex h-[300px] items-center justify-center bg-slate-100 text-slate-400 sm:h-[420px]">Rasm mavjud emas</div>

  const resolveSigned = async (image: ListingImage, index: number) => {
    if (resolved[index] || resolving[index]) return
    const path = storagePathFromPublicUrl(image.image_url)
    if (!path) return
    setResolving(state => ({ ...state, [index]: true }))
    try { const db = createClient(); const { data } = await db.storage.from('listing-images').createSignedUrl(path, 3600); if (data?.signedUrl) setResolved(state => ({ ...state, [index]: data.signedUrl })) }
    finally { setResolving(state => ({ ...state, [index]: false })) }
  }
  const imageSrc = (image: ListingImage, index: number) => resolved[index] || image.image_url

  return <>
    <style dangerouslySetInnerHTML={{ __html: rentalUiCss }} />
    <div className="bg-slate-100">
      <div className="relative h-[300px] cursor-zoom-in touch-pan-y select-none sm:h-[420px]" onClick={() => setLightbox(true)} onTouchStart={event => setTouchStart(event.touches[0]?.clientX ?? null)} onTouchEnd={event => { if (touchStart == null) return; const delta = (event.changedTouches[0]?.clientX ?? touchStart) - touchStart; if (Math.abs(delta) >= 50) delta < 0 ? nextImage() : previousImage(); setTouchStart(null) }}>
        <img src={imageSrc(current, safeIndex)} alt={`${title} — ${safeIndex + 1}-rasm`} title={title} loading="eager" fetchPriority="high" decoding="async" draggable={false} onError={() => void resolveSigned(current, safeIndex)} className="h-full w-full object-cover" />
        {resolving[safeIndex] && <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 text-sm font-semibold text-slate-500">Rasm yuklanmoqda...</div>}
        {images.length > 1 && <><button type="button" aria-label="Oldingi rasm" onClick={event => { event.stopPropagation(); previousImage() }} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-xl font-black shadow-lg sm:left-4 sm:px-4 sm:py-3">‹</button><button type="button" aria-label="Keyingi rasm" onClick={event => { event.stopPropagation(); nextImage() }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-xl font-black shadow-lg sm:right-4 sm:px-4 sm:py-3">›</button><div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white">{safeIndex + 1} / {images.length}</div></>}
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white">↗ Kattalashtirish</div>
      </div>
      {images.length > 1 && <div className="flex gap-2 overflow-x-auto border-t border-slate-200 bg-white p-3">{images.map((image, index) => <button key={`${image.image_url}-${index}`} type="button" onClick={() => setActiveImage(index)} aria-label={`${title} — ${index + 1}-rasm`} className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${safeIndex === index ? 'border-emerald-500' : 'border-transparent'}`}><img src={imageSrc(image, index)} alt={`${title} — ${index + 1}-rasm`} loading="lazy" decoding="async" draggable={false} onError={() => void resolveSigned(image, index)} className="h-full w-full object-cover" /></button>)}</div>}
    </div>
    {lightbox && current && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={`${title} rasmlar galereyasi`} onClick={() => setLightbox(false)}><button type="button" aria-label="Yopish" onClick={() => setLightbox(false)} className="absolute right-4 top-4 z-10 rounded-full bg-white/15 px-4 py-2 text-2xl font-bold text-white hover:bg-white/25">×</button>{images.length > 1 && <button type="button" aria-label="Oldingi rasm" onClick={event => { event.stopPropagation(); previousImage() }} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-3xl font-black text-white hover:bg-white/25">‹</button>}<img src={imageSrc(current, safeIndex)} alt={`${title} — ${safeIndex + 1}-rasm`} onError={() => void resolveSigned(current, safeIndex)} onClick={event => event.stopPropagation()} className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl" />{images.length > 1 && <button type="button" aria-label="Keyingi rasm" onClick={event => { event.stopPropagation(); nextImage() }} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-3xl font-black text-white hover:bg-white/25">›</button>}<div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-bold text-white">{safeIndex + 1} / {images.length}</div></div>}
  </>
}
