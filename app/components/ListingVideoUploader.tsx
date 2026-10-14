'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'

type VideoState = 'idle' | 'uploading' | 'processing' | 'ready' | 'failed'

type Media = {
  id: string
  status: string
  playback_url?: string | null
  thumbnail_storage_path?: string | null
  duration_seconds?: number | null
}

type Props = {
  listingId: string | null
  ru: boolean
  onStatusChange?: (status: VideoState, media?: Media | null) => void
}

const MAX_DURATION_SECONDS = 60
const CHUNK_SIZE = 50 * 1024 * 1024
const ACCEPT = 'video/*,.mp4,.mov,.webm,.mkv,.avi,.3gp,.m4v,.hevc,.h265'
const text = (ru: boolean, uz: string, ruText: string) => (ru ? ruText : uz)

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = Number(video.duration)
      URL.revokeObjectURL(url)
      if (!Number.isFinite(duration) || duration <= 0) reject(new Error('VIDEO_DURATION_READ_FAILED'))
      else resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('VIDEO_FORMAT_READ_FAILED'))
    }
    video.src = url
  })
}

async function uploadTus(url: string, file: File, onProgress: (value: number) => void) {
  let offset = 0
  let retries = 0
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size)
    const chunk = file.slice(offset, end)
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: chunk,
      })
      if (!response.ok) throw new Error(`TUS_${response.status}`)
      const nextOffset = Number(response.headers.get('Upload-Offset'))
      if (!Number.isFinite(nextOffset) || nextOffset <= offset) throw new Error('TUS_INVALID_OFFSET')
      offset = nextOffset
      retries = 0
      onProgress(Math.min(100, Math.round((offset / file.size) * 100)))
    } catch (error) {
      retries += 1
      if (retries > 3) throw error
      await new Promise(resolve => setTimeout(resolve, 700 * retries))
    }
  }
}

export default function ListingVideoUploader({ listingId, ru, onStatusChange }: Props) {
  const [status, setStatus] = useState<VideoState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [media, setMedia] = useState<Media | null>(null)
  const mediaIdRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
  }, [])

  const updateStatus = (next: VideoState, nextMedia?: Media | null) => {
    setStatus(next)
    if (nextMedia !== undefined) setMedia(nextMedia)
    onStatusChange?.(next, nextMedia === undefined ? media : nextMedia)
  }

  const pollStatus = async (mediaId: string) => {
    if (!listingId) return
    if (pollRef.current) clearInterval(pollRef.current)
    const check = async () => {
      try {
        const response = await fetch(`/api/listings/${listingId}/video/status?mediaId=${encodeURIComponent(mediaId)}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'VIDEO_STATUS_FAILED')
        const providerStatus = data.provider?.status
        if (data.media?.status === 'ready' || providerStatus === 'ready') {
          mediaIdRef.current = mediaId
          updateStatus('ready', data.media)
          if (pollRef.current) clearInterval(pollRef.current)
        } else if (data.media?.status === 'failed' || providerStatus === 'failed') {
          updateStatus('failed', data.media)
          setError(text(ru, 'Video qayta ishlanmadi. Boshqa video tanlang.', 'Видео не удалось обработать. Выберите другой файл.'))
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch {
        // Temporary status errors are retried by the next poll.
      }
    }
    await check()
    pollRef.current = setInterval(check, 3000)
  }

  const chooseVideo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!listingId) {
      setError(text(ru, 'Avval oldingi bosqichni saqlang.', 'Сначала сохраните предыдущий шаг.'))
      return
    }
    setError('')
    if (pollRef.current) clearInterval(pollRef.current)
    setMedia(null)
    setProgress(0)
    setFileName(file.name)
    mediaIdRef.current = null

    try {
      const duration = await getVideoDuration(file)
      if (duration > MAX_DURATION_SECONDS) throw new Error('VIDEO_TOO_LONG')
      if (duration < 1) throw new Error('VIDEO_TOO_SHORT')

      updateStatus('uploading', null)
      const initResponse = await fetch(`/api/listings/${listingId}/video/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'video/mp4', sizeBytes: file.size }),
      })
      const init = await initResponse.json()
      if (!initResponse.ok) throw new Error(init.message || init.error || 'VIDEO_UPLOAD_INIT_FAILED')
      mediaIdRef.current = init.media.id

      await uploadTus(init.upload.url, file, setProgress)

      const completeResponse = await fetch(`/api/listings/${listingId}/video/upload/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: init.media.id }),
      })
      const complete = await completeResponse.json()
      if (!completeResponse.ok) throw new Error(complete.error || 'VIDEO_UPLOAD_COMPLETE_FAILED')

      updateStatus('processing', complete.media)
      await pollStatus(init.media.id)
    } catch (err) {
      if (mediaIdRef.current && listingId) {
        await fetch(`/api/listings/${listingId}/video?mediaId=${encodeURIComponent(mediaIdRef.current)}`, { method: 'DELETE' }).catch(() => undefined)
      }
      mediaIdRef.current = null
      updateStatus('failed', null)
      const code = err instanceof Error ? err.message : ''
      const message = code === 'VIDEO_TOO_LONG'
        ? text(ru, 'Video maksimal 60 soniya bo‘lishi kerak.', 'Видео должно быть не длиннее 60 секунд.')
        : code === 'VIDEO_TOO_SHORT'
          ? text(ru, 'Video kamida 1 soniya bo‘lishi kerak.', 'Видео должно быть длиннее 1 секунды.')
          : text(ru, 'Videoni yuklashda xatolik yuz berdi. Qayta urinib ko‘ring.', 'Не удалось загрузить видео. Попробуйте ещё раз.')
      setError(message)
    }
  }

  const removeVideo = async () => {
    if (!listingId || !mediaIdRef.current) return
    if (pollRef.current) clearInterval(pollRef.current)
    const response = await fetch(`/api/listings/${listingId}/video?mediaId=${encodeURIComponent(mediaIdRef.current)}`, { method: 'DELETE' })
    if (!response.ok) {
      setError(text(ru, 'Videoni o‘chirishda xatolik yuz berdi.', 'Не удалось удалить видео.'))
      return
    }
    mediaIdRef.current = null
    setMedia(null)
    setFileName('')
    setProgress(0)
    setError('')
    updateStatus('idle', null)
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <b className="text-sm font-bold">🎥 {text(ru, 'Video', 'Видео')}</b>
          <p className="mt-1 text-xs leading-5 text-slate-500">{text(ru, '1 ta video · 1–60 soniya · telefon formati qabul qilinadi. Server avtomatik optimallashtiradi.', '1 видео · 1–60 секунд · формат телефона поддерживается. Сервер автоматически оптимизирует видео.')}</p>
        </div>
        {status === 'ready' && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">✓ {text(ru, 'Tayyor', 'Готово')}</span>}
      </div>

      {!media && status !== 'uploading' && status !== 'processing' && (
        <label className="mt-4 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-7 text-sm font-semibold hover:border-slate-950">
          <input type="file" accept={ACCEPT} onChange={chooseVideo} className="hidden" />
          {text(ru, '🎥 Video tanlash', '🎥 Выбрать видео')}
        </label>
      )}

      {(status === 'uploading' || status === 'processing') && (
        <div className="mt-4 rounded-2xl bg-white p-4">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold"><span className="truncate">{fileName}</span><span>{status === 'uploading' ? `${progress}%` : text(ru, 'Qayta ishlanmoqda…', 'Обработка…')}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: status === 'processing' ? '100%' : `${progress}%` }} /></div>
        </div>
      )}

      {status === 'ready' && media && (
        <div className="mt-4 overflow-hidden rounded-2xl bg-slate-950">
          {media.thumbnail_storage_path ? <img src={media.thumbnail_storage_path} alt="" className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center text-4xl text-white">▶</div>}
          <div className="flex items-center justify-between gap-3 p-3 text-xs text-white"><span className="truncate">{fileName}</span><button type="button" onClick={() => void removeVideo()} className="rounded-lg bg-white/15 px-3 py-1.5 font-semibold hover:bg-white/25">{text(ru, 'O‘chirish', 'Удалить')}</button></div>
        </div>
      )}

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}
      {!listingId && <p className="mt-3 text-xs text-slate-400">{text(ru, 'Video yuklash uchun oldingi bosqichni saqlang.', 'Сохраните предыдущий шаг, чтобы загрузить видео.')}</p>}
    </div>
  )
}
