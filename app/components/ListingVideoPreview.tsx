'use client'

import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'

type Props = {
  listingId: string
  title: string
}

type VideoMedia = {
  provider?: 'supabase' | 'cloudflare' | string | null
  playback_url?: string | null
  thumbnail_storage_path?: string | null
}

export default function ListingVideoPreview({ listingId, title }: Props) {
  const [media, setMedia] = useState<VideoMedia | null>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const modalVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    setMounted(true)
    let cancelled = false
    fetch(`/api/listings/${encodeURIComponent(listingId)}/video`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!cancelled && data?.media?.playback_url) setMedia(data.media)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [listingId])

  useEffect(() => {
    if (!media) return
    const findTarget = () => {
      const element = document.querySelector<HTMLElement>('section.overflow-hidden.rounded-3xl div.bg-slate-100 > div.relative')
      if (element) setTarget(element)
    }
    findTarget()
    const observer = new MutationObserver(findTarget)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [media])

  useEffect(() => {
    if (!target) return
    const observer = new IntersectionObserver(entries => {
      setVisible(Boolean(entries[0]?.isIntersecting))
    }, { rootMargin: '200px 0px', threshold: 0.01 })
    observer.observe(target)
    return () => observer.disconnect()
  }, [target])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(false)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [lightbox])

  useEffect(() => {
    if (!lightbox || media?.provider !== 'supabase' || !modalVideoRef.current) return
    const video = modalVideoRef.current
    video.muted = false
    void video.play().catch(() => undefined)
  }, [lightbox, media?.provider])

  if (!mounted || !media || !target || failed) return null

  const playbackUrl = media.playback_url
  if (!playbackUrl) return null

  const separator = playbackUrl.includes('?') ? '&' : '?'
  const previewSrc = `${playbackUrl}${separator}autoplay=true&muted=true&loop=true&controls=false&preload=metadata`
  const modalSrc = `${playbackUrl}${separator}autoplay=true&controls=true&preload=metadata`

  return createPortal(
    <>
      <div
        className="pointer-events-auto absolute bottom-4 right-4 z-20 w-[150px] cursor-zoom-in overflow-hidden rounded-2xl border-2 border-white bg-black shadow-2xl sm:w-[190px]"
        aria-label={`${title} video`}
        role="button"
        tabIndex={0}
        onClick={() => setLightbox(true)}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setLightbox(true) } }}
      >
        {visible ? (
          media.provider === 'supabase' ? (
            <video
              src={playbackUrl}
              title={`${title} video`}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              onError={() => setFailed(true)}
              className="aspect-[9/16] block w-full border-0 bg-black object-cover"
            />
          ) : (
            <iframe
              src={previewSrc}
              title={`${title} video`}
              loading="lazy"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              onError={() => setFailed(true)}
              className="aspect-[9/16] block w-full border-0 bg-black"
            />
          )
        ) : (
          <div className="relative aspect-[9/16] w-full bg-black">
            {media.thumbnail_storage_path && <img src={media.thumbnail_storage_path} alt="" className="h-full w-full object-cover" loading="lazy" />}
            <span className="absolute inset-0 grid place-items-center text-2xl text-white drop-shadow">▶</span>
          </div>
        )}
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white">VIDEO</span>
        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-black/70 px-2 py-1 text-xs font-bold text-white">↗</span>
      </div>

      {lightbox && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} video`}
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            aria-label="Yopish"
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 z-20 rounded-full bg-white/15 px-4 py-2 text-2xl font-bold text-white hover:bg-white/25"
          >
            ×
          </button>

          <div
            className="relative flex h-full w-full max-w-5xl items-center justify-center"
            onClick={event => event.stopPropagation()}
          >
            {media.provider === 'supabase' ? (
              <video
                ref={modalVideoRef}
                src={playbackUrl}
                title={`${title} video`}
                autoPlay
                controls
                playsInline
                preload="auto"
                className="max-h-[92vh] max-w-[95vw] rounded-2xl bg-black object-contain shadow-2xl"
              />
            ) : (
              <iframe
                src={modalSrc}
                title={`${title} video`}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-[92vh] w-full max-w-4xl rounded-2xl border-0 bg-black shadow-2xl"
              />
            )}
          </div>
        </div>,
        document.body,
      )}
    </>,
    target,
  )
}
