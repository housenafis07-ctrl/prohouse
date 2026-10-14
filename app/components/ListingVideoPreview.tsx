'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

type Props = {
  listingId: string
  title: string
}

type VideoMedia = {
  playback_url?: string | null
  thumbnail_storage_path?: string | null
}

export default function ListingVideoPreview({ listingId, title }: Props) {
  const [media, setMedia] = useState<VideoMedia | null>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  const [mounted, setMounted] = useState(false)

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

  if (!mounted || !media || !target || failed) return null

  const playbackUrl = media.playback_url
  if (!playbackUrl) return null

  const separator = playbackUrl.includes('?') ? '&' : '?'
  const src = `${playbackUrl}${separator}autoplay=true&muted=true&loop=true&controls=false&preload=metadata`

  return createPortal(
    <div className="pointer-events-auto absolute bottom-4 right-4 z-20 w-[150px] overflow-hidden rounded-2xl border-2 border-white bg-black shadow-2xl sm:w-[190px]" aria-label={`${title} video`}>
      {visible ? (
        <iframe
          src={src}
          title={`${title} video`}
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          onError={() => setFailed(true)}
          className="aspect-[9/16] block w-full border-0 bg-black"
        />
      ) : (
        <div className="relative aspect-[9/16] w-full bg-black">
          {media.thumbnail_storage_path && <img src={media.thumbnail_storage_path} alt="" className="h-full w-full object-cover" loading="lazy" />}
          <span className="absolute inset-0 grid place-items-center text-2xl text-white drop-shadow">▶</span>
        </div>
      )}
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white">VIDEO</span>
    </div>,
    target,
  )
}
