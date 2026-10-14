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
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024 * 1024
const ACCEPT = [
  'video/*',
  '.mp4', '.mkv', '.mov', '.avi', '.flv', '.ts', '.mts', '.m2ts',
  '.mpeg', '.mpg', '.mxf', '.lxf', '.gxf', '.3gp', '.webm', '.m4v',
  '.qt', '.hevc', '.h265',
].join(',')
const MAX_PROCESSING_WAIT_MS = 15 * 60 * 1000
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

function uploadDirectPost(url: string, file: File, onProgress: (value: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file, file.name)
    xhr.open('POST', url)
    xhr.responseType = 'text'
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
        return
      }
      const detail = (xhr.responseText || '').slice(0, 300)
      reject(new Error(`DIRECT_UPLOAD_${xhr.status}${detail ? `:${detail}` : ''}`))
    }
    xhr.onerror = () => reject(new Error('DIRECT_UPLOAD_NETWORK'))
    xhr.onabort = () => reject(new Error('DIRECT_UPLOAD_ABORTED'))
    xhr.send(form)
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

async function uploadTus(
  url: string,
  file: File,
  onProgress: (value: number) => void,
  configuredChunkSize?: number | null,
) {
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
  const inputRef = useRef<HTMLInputElement | null>(null)

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
          setError(text(ru, 'Video qayta ishlanmadi. Boshqa video tanlang.', 'Видео не удалось обработать. Выберите другой файл.'))
          stop()
          return
        }

        if (processingStartedRef.current && Date.now() - processingStartedRef.current > MAX_PROCESSING_WAIT_MS) {
          updateStatus('failed', data.media)
          setError(text(ru, 'Video serverda juda uzoq qayta ishlanmoqda. Qayta urinib ko‘ring.', 'Видео слишком долго обрабатывается на сервере. Попробуйте ещё раз.'))
          stop()
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'VIDEO_PROCESSING_ENV_MISSING') {
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

    if (!file.type.startsWith('video/') && !/\.(mp4|mkv|mov|avi|flv|ts|mts|m2ts|mpeg|mpg|mxf|lxf|gxf|3gp|webm|m4v|qt|hevc|h265)$/i.test(file.name)) {
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
        if (duration < 1) throw new Error('VIDEO_TOO_SHORT')
      } catch (durationError) {
        const code = durationError instanceof Error ? durationError.message : ''
        if (code === 'VIDEO_TOO_SHORT') throw durationError
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
      if (!init.media?.id || !init.upload?.url || !init.upload?.protocol) throw new Error('VIDEO_UPLOAD_INIT_INVALID_RESPONSE')

      mediaIdRef.current = init.media.id

      if (init.upload.protocol === 'post') {
        await uploadDirectPost(init.upload.url, file, setProgress)
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
      const message = code === 'VIDEO_TOO_SHORT'
        ? text(ru, 'Video kamida 1 soniya bo‘lishi kerak.', 'Видео должно быть длиннее 1 секунды.')
        : code.startsWith('DIRECT_UPLOAD_')
          ? text(ru, 'Video Cloudflare Streamga yuklanmadi. Server javobini tekshirish kerak.', 'Видео не загрузилось в Cloudflare Stream. Нужно проверить ответ сервера.')
          : code.startsWith('TUS_') || code === 'TUS_INVALID_OFFSET'
            ? text(ru, 'Video serverga yuklanmadi. Internet aloqasini tekshiring va qayta urinib ko‘ring.', 'Видео не загрузилось на сервер. Проверьте интернет-соединение и попробуйте ещё раз.')
            : code === 'VIDEO_PROCESSING_ENV_MISSING'
              ? text(ru, 'Video serveri sozlanmagan. Administrator Cloudflare Stream konfiguratsiyasini tekshirishi kerak.', 'Видеосервер не настроен. Администратору нужно проверить конфигурацию Cloudflare Stream.')
              : code === 'VIDEO_UPLOAD_PROVIDER_INIT_FAILED'
                ? text(ru, 'Video serverga ulanishda xatolik. Qayta urinib ko‘ring.', 'Ошибка подключения к видеосерверу. Попробуйте ещё раз.')
                : code === 'VIDEO_CLIP_FAILED'
                  ? text(ru, 'Videoni 60 soniyagacha qisqartirishda xatolik yuz berdi. Qayta urinib ko‘ring.', 'Не удалось автоматически обрезать видео до 60 секунд. Попробуйте ещё раз.')
                  : text(ru, 'Videoni yuklashda xatolik yuz berdi. Qayta urinib ko‘ring.', 'Не удалось загрузить видео. Попробуйте ещё раз.')

      setError(message)
    }
  }

  const removeVideo = async () => {
    if (!listingId || !mediaIdRef.current) return
    if (pollRef.current) clearInterval(pollRef.current)

    const response = await fetch(`/api/listings/${listingId}/video?mediaId=${encodeURIComponent(mediaIdRef.current)}`, { method: 'DELETE' })
    if (!response.ok) {
      setError(text(ru, 'Videoni o‘chirishda xatolik yuz berdi.', 'Ошибка удаления видео.'))
      return
    }

    mediaIdRef.current = null
    setMedia(null)
    setFileName('')
    setProgress(0)
    setError('')
    updateStatus('idle', null)
  }

  const openPicker = () => inputRef.current?.click()

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <h3 className="font-bold">🎥 {text(ru, 'Video', 'Видео')}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {text(ru, '1 ta video · 1–60 soniya · telefon, MP4, MOV, MKV, AVI, WebM va boshqa video formatlari qabul qilinadi. 60 soniyadan uzun video avtomatik dastlabki 60 soniyaga qisqartiriladi.', '1 видео · 1–60 секунд · принимаются телефонные форматы, MP4, MOV, MKV, AVI, WebM и другие. Видео длиннее 60 секунд автоматически обрежется до первых 60 секунд.')}
        </p>
      </div>

      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={chooseVideo} />

      <button
        type="button"
        onClick={openPicker}
        disabled={status === 'uploading' || status === 'processing'}
        className="mt-4 flex min-h-[78px] w-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-4 text-sm font-semibold hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        🎥 {status === 'uploading'
          ? text(ru, `Yuklanmoqda ${progress}%`, `Загрузка ${progress}%`)
          : status === 'processing'
            ? text(ru, 'Video qayta ishlanmoqda…', 'Видео обрабатывается…')
            : media?.playback_url
              ? text(ru, 'Videoni almashtirish', 'Заменить видео')
              : text(ru, 'Video tanlash', 'Выбрать видео')}
      </button>

      {fileName && (
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {fileName}{progress > 0 && status === 'uploading' ? ` · ${progress}%` : ''}
        </div>
      )}

      {status === 'ready' && media?.playback_url && (
        <div className="mt-3 overflow-hidden rounded-xl bg-black">
          <video
            src={media.playback_url}
            poster={media.thumbnail_storage_path || undefined}
            controls
            playsInline
            className="max-h-72 w-full object-contain"
          />
          <div className="px-3 py-2 text-xs text-white/80">
            {media.duration_seconds ? `${Math.round(media.duration_seconds)} s` : ''}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl bg-red-50 px-3 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {status === 'processing' && (
        <div className="mt-3 rounded-xl bg-blue-50 px-3 py-3 text-sm text-blue-700">
          {text(ru, 'Video yuklandi. Server uni tekshirmoqda va kerak bo‘lsa 60 soniyagacha avtomatik qisqartirmoqda.', 'Видео загружено. Сервер проверяет его и при необходимости автоматически обрезает до 60 секунд.')}
        </div>
      )}

      {media && status !== 'uploading' && (
        <button type="button" onClick={removeVideo} className="mt-3 text-sm font-semibold text-red-600">
          {text(ru, 'Videoni o‘chirish', 'Удалить видео')}
        </button>
      )}
    </div>
  )
}
