'use client'

import { useState } from 'react'
import { getListingHeroImageUrl, getListingThumbnailImageUrl } from '@/lib/listing-image'

type ListingImage = { image_url: string; sort_order: number | null }

export default function ListingGallery({ images, title }: { images: ListingImage[]; title: string }) {
  const [activeImage, setActiveImage] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)

  const safeIndex = Math.min(activeImage, Math.max(images.length - 1, 0))
  const previousImage = () => setActiveImage(i => images.length ? (i - 1 + images.length) % images.length : 0)
  const nextImage = () => setActiveImage(i => images.length ? (i + 1) % images.length : 0)

  if (!images.length) {
    return <div className="flex h-[300px] items-center justify-center bg-slate-100 text-slate-400 sm:h-[420px]">Rasm mavjud emas</div>
  }

  return (
    <div className="bg-slate-100">
      <div
        className="relative h-[300px] touch-pan-y select-none sm:h-[420px]"
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
          src={getListingHeroImageUrl(images[safeIndex].image_url)}
          alt={title}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
        />
        {images.length > 1 && <>
          <button aria-label="Oldingi rasm" onClick={previousImage} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-xl font-black shadow-lg sm:left-4 sm:px-4 sm:py-3">‹</button>
          <button aria-label="Keyingi rasm" onClick={nextImage} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-xl font-black shadow-lg sm:right-4 sm:px-4 sm:py-3">›</button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white">{safeIndex + 1} / {images.length}</div>
        </>}
      </div>
      {images.length > 1 && <div className="flex gap-2 overflow-x-auto border-t border-slate-200 bg-white p-3">
        {images.map((image, index) => <button key={`${image.image_url}-${index}`} type="button" onClick={() => setActiveImage(index)} aria-label={`${title} — ${index + 1}-rasm`} className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${safeIndex === index ? 'border-emerald-500' : 'border-transparent'}`}>
          <img src={getListingThumbnailImageUrl(image.image_url)} alt={`${title} — ${index + 1}`} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
        </button>)}
      </div>}
    </div>
  )
}
