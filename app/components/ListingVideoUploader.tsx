'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

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
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024 * 1024
const ACCEPT = [
  'video/*',
  '.mp4', '.mkv', '.mov', '.avi', '.flv', '.ts', '.mts', '.m2ts',
  '.mpeg', '.mpg', '.mxf', '.lxf', '.gxf', '.3gp', '.webm', '.m4v',
  '.qt', '.hevc', '.h265',
].join(',')
const MAX_PROCESSING_WAIT_MS = 10 * 60 * 1000
const DEFAULT_TUS_CHUNK_SIZE = 6 * 1024 * 1024

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

async function getTusOffset(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'Tus-Resumable': '1.0.0' },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const value = Number(response.headers.get('Upload-Offset'))
    return Number.isFinite(value) && value >= 0 ? value : null
  } catch {
    return null
  }
}

async function uploadTus(url: string, file: File, onProgress: (value: number) => void, configuredChunkSize?: number | null) {
  const chunkSize = Number.isFinite(configuredChunkSize) && Number(configuredChunkSize) > 0
    ? Number(configuredChunkSize)
    : DEFAULT_TUS_CHUNK_SIZE

  let offset = 0
  let retries = 0

  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size)
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

      if (!response.ok) {
        let detail = ''
        try { detail = (await response.text()).slice(0, 300) } catch {}
        const serverOffset = await getTusOffset(url)
        if (serverOffset !== null && serverOffset > offset) {
          offset = Math.min(serverOffset, file.size)
          retries = 0
          onProgress(Math.min(100, Math.round((offset / file.size) * 100)))
          continue
        }
        throw new Error(`TUS_${response.status}${detail ? `:${detail}` : ''}`)
      }

      const headerOffset = Number(response.headers.get('Upload-Offset'))
      const nextOffset = Number.isFinite(headerOffset) && headerOffset > offset ? headerOffset : end
      offset = Math.min(nextOffset, file.size)
      retries = 0
      onProgress(Math.min(100, Math.round((offset / file.size) * 100)))
    } catch (error) {
      const serverOffset = await getTusOffset(url)
      if (serverOffset !== null && serverOffset > offset) {
        offset = Math.min(serverOffset, file.size)
        retries = 0
        onProgress(Math.min(100, Math.round((offset / file.size) * 100)))
        continue
      }
      retries += 1
      if (retries > 4) throw error
      await new Promise(resolve => setTimeout(resolve, 700 * retries))
    }
  }

  onProgress(100)
}

export default function ListingVideoUploader({ listingId, ru, onStatusChange }: Props) {
  const [status, setStatus] = useState<VideoState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [media, setMedia] = useState<Media | null>(null)
  const mediaIdRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const processingStartedRef = useRef<number | null>(null)

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
    processingStartedRef.current = Date.now()

    let stopped = false
    const stop = () => {
      stopped = true
      if (pollRef.current) clearInterval(pollRef.current)
    }

    const check = async () => {
      try {
        const response = await fetch(`/api/listings/${listingId}/video/status?mediaId=${encodeURIComponent(mediaId)}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'VIDEO_STATUS_FAILED')

        const providerStatus = data.provider?.status
        if (data.media?.status === 'ready' || providerStatus === 'ready') {
          mediaIdRef.current = mediaId
          updateStatus('ready', data.media)
          stop()
          return
        }

        if (data.media?.status === 'failed' || providerStatus === 'failed' || providerStatus === 'error') {
          updateStatus('failed', data.media)
          const providerMessage = typeof data.provider?.errorMessage === 'string' ? data.provider.errorMessage.trim() : ''
          setError(providerMessage
            ? text(ru, `Video qayta ishlanmadi: ${providerMessage}`, `Видео не удалось обработать: ${providerMessage}`)
            : text(ru, 'Video qayta ishlanmadi. Boshqa video tanlang.', 'Видео не удалось обработать. Выберите другой файл.'))
          stop()
          return
        }

        if (processingStartedRef.current && Date.now() - processingStartedRef.current > MAX_PROCESSING_WAIT_MS) {
          updateStatus('failed', data.media)
          setError(text(ru, 'Video serverda juda uzoq qayta ishlanmoqda. Qayta urinib ko‘ring.', 'Видео слишком долго обрабатывается на сервере. Попробуйте ещё раз.'))
          stop()
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'VIDEO_PROCESSING_ENV_MISSING') {
          updateStatus('failed', null)
          setError(text(ru, 'Video serveri sozlanmagan. Administrator Cloudflare Stream konfiguratsiyasini tekshirishi kerak.', 'Видеосервер не настроен. Администратору нужно проверить конфигурацию Cloudflare Stream.'))
          stop()
        }
      }
    }

    await check()
    if (!stopped) pollRef.current = setInterval(check, 3000)
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

    const knownVideoExtension = /\.(mp4|mkv|mov|avi|flv|ts|mts|m2ts|mpeg|mpg|mxf|lxf|gxf|3gp|webm|m4v|qt|hevc|h265)$/i.test(file.name)
    const clearlyNonVideoMime = Boolean(file.type) && !file.type.startsWith('video/') && file.type !== 'application/octet-stream'
    if (clearlyNonVideoMime && !knownVideoExtension) {
      setStatus('failed')
      setError(text(ru, 'Video faylini tanlang.', 'Выберите видеофайл.'))
      return
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus('failed')
      setError(text(ru, 'Video hajmi 30 GB dan oshmasligi kerak.', 'Размер видео должен быть меньше 30 ГБ.'))
      return
    }

    try {
      try {
        const duration = await getVideoDuration(file)
        if (duration > MAX_DURATION_SECONDS) throw new Error('VIDEO_TOO_LONG')
        if (duration < 1) throw new Error('VIDEO_TOO_SHORT')
      } catch (durationError) {
        const code = durationError instanceof Error ? durationError.message : ''
        if (code === 'VIDEO_TOO_LONG' || code === 'VIDEO_TOO_SHORT') throw durationError
        // Some supported containers cannot expose metadata to the browser.
        // Keep them uploadable; the provider/storage receives the real file.
      }

      updateStatus('uploading', null)

      const initResponse = await fetch(`/api/listings/${listingId}/video/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      })

      const init = await initResponse.json().catch(() => ({}))
      if (!initResponse.ok) throw new Error(init.message || init.error || 'VIDEO_UPLOAD_INIT_FAILED')
      if (!init.media?.id || !init.upload?.protocol) throw new Error('VIDEO_UPLOAD_INIT_INVALID_RESPONSE')

      mediaIdRef.current = init.media.id

      if (init.upload.protocol === 'supabase-standard') {
        const supabase = createClient()
        setProgress(5)
        const { error: uploadError } = await supabase.storage
          .from('listing-videos')
          .upload(init.upload.path, file, {
            cacheControl: '31536000',
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          })
        if (uploadError) {
          console.error('[listing-video] standard Supabase upload failed', uploadError)
          throw new Error(`SUPABASE_UPLOAD_${uploadError.statusCode || uploadError.status || 500}:${uploadError.message}`)
        }
        setProgress(100)
      } else if (init.upload.protocol === 'post') {
        // Cloudflare Stream Direct Creator Uploads expects the selected file
        // as multipart/form-data under the "file" field. Do not set the
        // Content-Type manually; the browser must add the multipart boundary.
        if (!init.upload.url || typeof init.upload.url !== 'string') {
          throw new Error('VIDEO_UPLOAD_URL_MISSING')
        }

        const formData = new FormData()
        formData.append('file', file, file.name)
        setProgress(10)

        const uploadResponse = await fetch(init.upload.url, {
          method: 'POST',
          body: formData,
          cache: 'no-store',
        })

        if (!uploadResponse.ok) {
          const detail = (await uploadResponse.text().catch(() => '')).slice(0, 300)
          console.error('[listing-video] Cloudflare direct upload failed', {
            status: uploadResponse.status,
            detail,
          })
          throw new Error(`CLOUDFLARE_DIRECT_UPLOAD_${uploadResponse.status}`)
        }

        setProgress(100)
      } else if (init.upload.protocol === 'tus') {
        await uploadTus(init.upload.url, file, setProgress, init.upload.chunkSize)
      } else {
        throw new Error('VIDEO_UPLOAD_PROTOCOL_UNSUPPORTED')
      }

      const completeResponse = await fetch(`/api/listings/${listingId}/video/upload/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: init.media.id }),
      })
      const complete = await completeResponse.json().catch(() => ({}))
      if (!completeResponse.ok) throw new Error(complete.error || 'VIDEO_UPLOAD_COMPLETE_FAILED')

      updateStatus(complete.media?.status === 'ready' ? 'ready' : 'processing', complete.media)
      if (complete.media?.status !== 'ready') await pollStatus(init.media.id)
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
          : code.startsWith('SUPABASE_UPLOAD_')
            ? text(ru, 'Video saqlashga yuklanmadi. Fayl hajmi, internet yoki Storage ruxsatlarini tekshirish kerak.', 'Видео не загрузилось в хранилище. Проверьте размер файла, интернет или права Storage.')
            : code.startsWith('CLOUDFLARE_DIRECT_UPLOAD_')
              ? text(ru, 'Cloudflare video serveri faylni qabul qilmadi. Internet aloqasini tekshirib, videoni qayta tanlang.', 'Видеосервер Cloudflare не принял файл. Проверьте интернет-соединение и выберите видео ещё раз.')
              : code.startsWith('TUS_')
                ? text(ru, 'Video serverga yuklanmadi. Internet aloqasini tekshiring va qayta urinib ko‘ring.', 'Видео не загрузилось на сервер. Проверьте интернет-соединение и попробуйте ещё раз.')
                : code === 'VIDEO_UPLOAD_PROVIDER_INIT_FAILED'
                ? text(ru, 'Video serverga ulanishda xatolik. Qayta urinib ko‘ring.', 'Ошибка подключения к видеосерверу. Попробуйте ещё раз.')
                : code === 'VIDEO_UPLOAD_PROTOCOL_UNSUPPORTED'
                  ? text(ru, 'Video yuklash protokoli qo‘llab-quvvatlanmaydi.', 'Протокол загрузки видео не поддерживается.')
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

  const statusText = status === 'uploading'
    ? text(ru, `Yuklanmoqda${progress ? ` — ${progress}%` : '…'}`, `Загрузка${progress ? ` — ${progress}%` : '…'}`)
    : status === 'processing'
      ? text(ru, 'Video qayta ishlanmoqda…', 'Видео обрабатывается…')
      : status === 'ready'
        ? text(ru, 'Video tayyor', 'Видео готово')
        : ''

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 font-semibold">🎥 {text(ru, 'Video', 'Видео')}</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {text(ru, '1 ta video · 1–60 soniya · telefon, MP4, MOV, MKV, AVI, WebM va boshqa video formatlari qabul qilinadi. Server avtomatik optimallashtiradi.', '1 видео · 1–60 секунд · телефон, MP4, MOV, MKV, AVI, WebM и другие видеоформаты принимаются. Сервер автоматически оптимизирует видео.')}
      </p>

      <label className="mt-3 flex min-h-[82px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white text-sm font-semibold hover:border-slate-500">
        <input type="file" accept={ACCEPT} onChange={chooseVideo} className="hidden" />
        🎥 {text(ru, 'Video tanlash', 'Выбрать видео')}
      </label>

      {fileName && (
        <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-slate-600">
          <div className="truncate font-medium">{fileName}</div>
          {statusText && <div className="mt-1 text-slate-500">{statusText}</div>}
        </div>
      )}

      {status === 'uploading' && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.max(5, progress)}%` }} />
        </div>
      )}

      {status === 'ready' && media?.playback_url && (
        <div className="mt-3 overflow-hidden rounded-xl bg-black">
          <video src={media.playback_url} controls playsInline className="max-h-72 w-full object-contain" />
        </div>
      )}

      {error && <div className="mt-3 rounded-xl bg-red-50 px-3 py-3 text-xs leading-5 text-red-600">{error}</div>}

      {status === 'ready' && mediaIdRef.current && (
        <button type="button" onClick={() => void removeVideo()} className="mt-3 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600">
          {text(ru, 'Videoni o‘chirish', 'Удалить видео')}
        </button>
      )}
    </div>
  )
}
