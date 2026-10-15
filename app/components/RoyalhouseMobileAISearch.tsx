'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

type Tab = 'sale' | 'rent' | 'daily'

type Listing = {
  id: string
  title: string
  title_ru?: string | null
  listing_type?: string | null
  property_type?: string | null
  price?: number | null
  currency?: string | null
  area_m2?: number | null
  rooms?: number | null
  district?: string | null
  city?: string | null
  primary_image?: { image_url?: string | null } | null
}

const complexHints = [
  ' xon', ' xona', ' kvartira', ' uy ', ' hovli', ' yer ', ' uchast', ' tijorat',
  ' ijara', ' ijaraga', ' kunlik', ' sutkalik', ' dacha', ' yangi uy', ' novost',
  ' mlrd', ' milliard', ' mln', ' million', ' ming $', ' ming y', ' doll', '$',
  ' gacha', ' dan ', ' metro', ' yaqin', ' oil', ' arzon', ' qimmat', ' maydon',
  ' m2', ' m²', 'комнат', 'квартир', 'аренд', 'сутк', 'новост', 'до ', 'млрд', 'млн',
]

function normalize(value: string) {
  return value.toLocaleLowerCase('uz-UZ').replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim()
}

function needsAi(query: string) {
  const q = ` ${normalize(query)} `
  const words = q.trim().split(/\s+/).filter(Boolean)
  return words.length >= 3 || complexHints.some((hint) => q.includes(hint))
}

function detectTab(root: HTMLElement): Tab {
  const active = Array.from(root.querySelectorAll('button')).find((button) => button.className.includes('bg-emerald-600'))
  const label = normalize(active?.textContent || '')
  if (label.includes('ijara') || label.includes('аренд')) return 'rent'
  if (label.includes('kunlik') || label.includes('сут')) return 'daily'
  return 'sale'
}

function formatPrice(price: number | null | undefined, currency: string | null | undefined) {
  if (price === null || price === undefined) return ''
  const value = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(price)
  const unit = currency === 'UZS' ? 'so‘m' : currency || ''
  return `${value} ${unit}`.trim()
}

function listingHref(id: string) {
  return `/listings/${encodeURIComponent(id)}`
}

export default function RoyalhouseMobileAISearch() {
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [aiMode, setAiMode] = useState(false)
  const [error, setError] = useState('')

  const locale = useMemo(() => {
    if (typeof document === 'undefined') return 'uz'
    return document.documentElement.lang === 'ru' ? 'ru' : 'uz'
  }, [])

  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let currentController: AbortController | null = null
    let input: HTMLInputElement | null = null
    let root: HTMLElement | null = null
    let resultNode: HTMLDivElement | null = null

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      currentController?.abort()
      input?.removeEventListener('input', onInput)
      input?.removeEventListener('focus', onFocus)
      resultNode?.remove()
    }

    const find = () => {
      if (disposed) return
      input = document.querySelector('input[aria-label="Aqlli qidiruv"], input[aria-label="Умный поиск"]') as HTMLInputElement | null
      if (!input) {
        const candidate = Array.from(document.querySelectorAll('input')).find((node) => /Toshkentda 3 xonali|3-комнатная квартира|Aqlli qidiruv|Умный поиск/i.test(node.getAttribute('placeholder') || ''))
        input = candidate as HTMLInputElement | null
      }
      if (!input) {
        window.setTimeout(find, 300)
        return
      }

      root = input.closest('[data-royalhouse-mobile-search]') as HTMLElement | null
      const row = input.parentElement?.parentElement as HTMLElement | null
      const box = row?.parentElement as HTMLElement | null
      if (!box) return

      resultNode = document.createElement('div')
      resultNode.setAttribute('data-royalhouse-ai-results', 'true')
      resultNode.style.display = 'block'
      box.appendChild(resultNode)
      setMount(resultNode)

      onInput = () => {
        setQuery(input?.value || '')
      }
      onFocus = () => setQuery(input?.value || '')
      input.addEventListener('input', onInput)
      input.addEventListener('focus', onFocus)
      setQuery(input.value || '')
    }

    const requestSearch = async (value: string) => {
      const trimmed = value.trim()
      if (trimmed.length < 2) {
        setItems([])
        setAiMode(false)
        setError('')
        setLoading(false)
        return
      }

      currentController?.abort()
      const controller = new AbortController()
      currentController = controller
      setLoading(true)
      setError('')

      const tab = root ? detectTab(root) : 'sale'
      const ai = needsAi(trimmed)
      setAiMode(ai)

      try {
        const url = ai ? '/api/ai/property-search' : (() => {
          const params = new URLSearchParams({ q: trimmed, limit: '8', sort: 'newest', tab })
          return `/api/listings/search?${params.toString()}`
        })()

        const response = await fetch(url, {
          method: ai ? 'POST' : 'GET',
          headers: ai ? { 'Content-Type': 'application/json' } : undefined,
          body: ai ? JSON.stringify({ query: trimmed, tab }) : undefined,
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error || 'Qidiruvda xatolik.')
        if (controller.signal.aborted || disposed) return
        setItems(Array.isArray(payload?.data) ? payload.data.slice(0, 6) : [])
      } catch (searchError) {
        if (controller.signal.aborted || disposed) return
        setItems([])
        setError(searchError instanceof Error ? searchError.message : 'Qidiruvda xatolik.')
      } finally {
        if (!controller.signal.aborted && !disposed) setLoading(false)
      }
    }

    let onInput = () => {}
    let onFocus = () => {}
    find()

    const observer = new MutationObserver(() => {
      if (!input?.isConnected) find()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    const run = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => requestSearch(query), needsAi(query) ? 500 : 280)
    }

    // Keep the search state in sync without replacing the existing input or its handlers.
    const sync = window.setInterval(() => {
      const current = input?.value || ''
      if (current !== query) setQuery(current)
    }, 150)

    return () => {
      disposed = true
      observer.disconnect()
      window.clearInterval(sync)
      cleanup()
    }
    // The component intentionally reacts to the DOM-mounted existing search input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    if (!mount || query.trim().length < 2) return
    const timer = setTimeout(() => {
      const controller = new AbortController()
      const tab = detectTab(mount.closest('[data-royalhouse-mobile-search]') as HTMLElement || document.body)
      const ai = needsAi(query)
      setLoading(true)
      setAiMode(ai)
      setError('')

      const run = async () => {
        try {
          const response = await fetch(ai ? '/api/ai/property-search' : `/api/listings/search?${new URLSearchParams({ q: query.trim(), limit: '8', sort: 'newest', tab }).toString()}`, {
            method: ai ? 'POST' : 'GET',
            headers: ai ? { 'Content-Type': 'application/json' } : undefined,
            body: ai ? JSON.stringify({ query: query.trim(), tab }) : undefined,
            cache: 'no-store',
            signal: controller.signal,
          })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(payload?.error || 'Qidiruvda xatolik.')
          setItems(Array.isArray(payload?.data) ? payload.data.slice(0, 6) : [])
        } catch (error) {
          if (controller.signal.aborted) return
          setItems([])
          setError(error instanceof Error ? error.message : 'Qidiruvda xatolik.')
        } finally {
          if (!controller.signal.aborted) setLoading(false)
        }
      }
      void run()
      return () => controller.abort()
    }, needsAi(query) ? 500 : 280)
    return () => clearTimeout(timer)
  }, [query, mount])

  if (!mount) return null

  return createPortal(
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm" data-royalhouse-ai-inline-results>
      {loading && (
        <div className="px-3 py-2 text-[11px] font-semibold text-slate-400">{aiMode ? '✦ AI e’lonlarni izlamoqda…' : 'E’lonlar qidirilmoqda…'}</div>
      )}
      {!loading && error && <div className="px-3 py-2 text-[11px] font-semibold text-rose-500">{error}</div>}
      {!loading && !error && items.length > 0 && (
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{aiMode ? '✦ AI qidiruv natijalari' : 'Mos e’lonlar'}</span>
            <span className="text-[9px] font-semibold text-slate-400">{items.length} ta</span>
          </div>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { window.location.assign(listingHref(item.id)) }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50"
            >
              <div className="h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {item.primary_image?.image_url ? <img src={item.primary_image.image_url} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-black text-slate-800">{locale === 'ru' ? item.title_ru || item.title : item.title}</div>
                <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{[item.city, item.district, item.rooms ? `${item.rooms} xona` : '', item.area_m2 ? `${item.area_m2} m²` : ''].filter(Boolean).join(' · ')}</div>
                <div className="mt-1 text-[11px] font-black text-emerald-700">{formatPrice(item.price, item.currency)}</div>
              </div>
              <span className="text-slate-300">›</span>
            </button>
          ))}
        </div>
      )}
      {!loading && !error && query.trim().length >= 2 && items.length === 0 && (
        <div className="px-3 py-3 text-[11px] font-semibold text-slate-400">Mos e’lon topilmadi. Boshqa so‘zlar bilan urinib ko‘ring.</div>
      )}
    </div>,
    mount,
  )
}
