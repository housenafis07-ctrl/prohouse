'use client'

import { useEffect, useState } from 'react'
import { getListingHeroImageUrl, getListingThumbnailImageUrl } from '@/lib/listing-image'

type ListingImage = { image_url: string; sort_order: number | null }

export default function ListingGallery({ images, title }: { images: ListingImage[]; title: string }) {
  const [activeImage, setActiveImage] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [failed, setFailed] = useState<Record<number, boolean>>({})

  const safeIndex = Math.min(activeImage, Math.max(images.length - 1, 0))
  const current = images[safeIndex]
  const previousImage = () => setActiveImage(i => images.length ? (i - 1 + images.length) % images.length : 0)
  const nextImage = () => setActiveImage(i => images.length ? (i + 1) % images.length : 0)

  useEffect(() => {
    if (!lightbox) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(false)
      if (event.key === 'ArrowLeft') previousImage()
      if (event.key === 'ArrowRight') nextImage()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [lightbox])

  if (!images.length) {
    return <div className="flex h-[300px] items-center justify-center bg-slate-100 text-slate-400 sm:h-[420px]">Rasm mavjud emas</div>
  }

  const imageSrc = (image: ListingImage, index: number, thumbnail = false) => {
    if (failed[index]) return image.image_url
    return thumbnail ? getListingThumbnailImageUrl(image.image_url) : getListingHeroImageUrl(image.image_url)
  }

  return (
    <>
      <div className="bg-slate-100">
        <div
          className="relative h-[300px] cursor-zoom-in touch-pan-y select-none sm:h-[420px]"
          onClick={() => setLightbox(true)}
          onTouchStart={event => setTouchStart(event.touches[0]?.clientX ?? null)}
          onTouchEnd={event => {
            if (touchStart == null) return
            const delta = (event.changedTouches[0]?.clientX ?? touchStart) - touchStart
            if (Math.abs(delta) >= 50) {
              if (delta < 0) nextImage()
              else previousImage()
            }
            setTouchStart(null)
          }}
        >
          <img
            src={imageSrc(current, safeIndex)}
            alt={`${title} — ${safeIndex + 1}-rasm`}
            title={title}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            draggable={false}
            onError={() => setFailed(state => ({ ...state, [safeIndex]: true }))}
            className="h-full w-full object-cover"
          />
          {images.length > 1 && <>
            <button type="button" aria-label="Oldingi rasm" onClick={event => { event.stopPropagation(); previousImage() }} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-xl font-black shadow-lg sm:left-4 sm:px-4 sm:py-3">‹</button>
            <button type="button" aria-label="Keyingi rasm" onClick={event => { event.stopPropagation(); nextImage() }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-xl font-black shadow-lg sm:right-4 sm:px-4 sm:py-3">›</button>
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white">{safeIndex + 1} / {images.length}</div>
          </>}
          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white">↗ Kattalashtirish</div>
        </div>
        {images.length > 1 && <div className="flex gap-2 overflow-x-auto border-t border-slate-200 bg-white p-3">
          {images.map((image, index) => <button key={`${image.image_url}-${index}`} type="button" onClick={() => setActiveImage(index)} aria-label={`${title} — ${index + 1}-rasm`} className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${safeIndex === index ? 'border-emerald-500' : 'border-transparent'}`}>
            <img src={imageSrc(image, index, true)} alt={`${title} — ${index + 1}-rasm`} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(state => ({ ...state, [index]: true }))} className="h-full w-full object-cover" />
          </button>)}
        </div>}
      </div>

      {lightbox && current && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={`${title} rasmlar galereyasi`} onClick={() => setLightbox(false)}>
        <button type="button" aria-label="Yopish" onClick={() => setLightbox(false)} className="absolute right-4 top-4 z-10 rounded-full bg-white/15 px-4 py-2 text-2xl font-bold text-white hover:bg-white/25">×</button>
        {images.length > 1 && <button type="button" aria-label="Oldingi rasm" onClick={event => { event.stopPropagation(); previousImage() }} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-3xl font-black text-white hover:bg-white/25">‹</button>}
        <img src={imageSrc(current, safeIndex)} alt={`${title} — ${safeIndex + 1}-rasm`} onError={() => setFailed(state => ({ ...state, [safeIndex]: true }))} onClick={event => event.stopPropagation()} className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl" />
        {images.length > 1 && <button type="button" aria-label="Keyingi rasm" onClick={event => { event.stopPropagation(); nextImage() }} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-3xl font-black text-white hover:bg-white/25">›</button>}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-bold text-white">{safeIndex + 1} / {images.length}</div>
      </div>}
    </>
  )
}
