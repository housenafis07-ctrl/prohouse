'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'

const LOCATION_KEY = 'royalhouse-location'

type SavedLocation = {
  region: string
  district: string
  neighborhood: string
}

const readSaved = (): SavedLocation => {
  try {
    const raw = localStorage.getItem(LOCATION_KEY)
    if (raw) return { region: '', district: '', neighborhood: '', ...JSON.parse(raw) }
  } catch {}
  return { region: 'Toshkent shahri', district: '', neighborhood: '' }
}

const regionLabel = (region: string, ru: boolean) => {
  if (!region || region === 'ALL') return ru ? 'Весь Узбекистан' : 'Butun O‘zbekiston'
  if (region === 'Toshkent shahri') return ru ? 'Ташкент' : 'Toshkent'
  return ru ? region.replace(' viloyati', ' область') : region
}

export default function RoyalhousePartnersLinkFix() {
  useEffect(() => {
    let panel: HTMLDivElement | null = null
    let activeButton: HTMLButtonElement | null = null
    let cleanupOutside: (() => void) | null = null
    let cleanupScroll: (() => void) | null = null

    const closePanel = () => {
      if (panel) panel.remove()
      panel = null
      activeButton = null
      cleanupOutside?.()
      cleanupOutside = null
      cleanupScroll?.()
      cleanupScroll = null
    }

    const fixPartners = () => {
      const nodes = Array.from(document.querySelectorAll('span,div,a,button'))
      nodes.forEach((node) => {
        if (node.getAttribute('data-royalhouse-partners-link') === '1') return
        const text = node.textContent?.trim()
        if (text !== 'Hamkorlar uchun' && text !== 'Партнёрам' && text !== 'Для партнёров') return
        if (node.children.length > 0) return
        const link = document.createElement('a')
        link.href = '/partners'
        link.textContent = text
        link.className = node.className
        link.setAttribute('data-royalhouse-partners-link', '1')
        node.replaceWith(link)
      })
    }

    const buildPanel = (button: HTMLButtonElement) => {
      closePanel()
      activeButton = button
      const ru = button.getAttribute('data-royalhouse-location-lang') === 'ru' || button.textContent?.includes('Ташкент') || button.textContent?.includes('Весь') || false
      const saved = readSaved()
      let state = saved
      let neighborhoods: string[] = []
      let loadingNeighborhoods = false

      panel = document.createElement('div')
      panel.setAttribute('data-royalhouse-location-panel', '1')
      panel.style.cssText = 'position:fixed;z-index:9999;width:min(390px,calc(100vw - 24px));max-height:min(620px,calc(100vh - 24px));overflow:auto;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.22);padding:16px;font-family:inherit;color:#0f172a'

      const positionPanel = () => {
        if (!panel) return
        const rect = button.getBoundingClientRect()
        const width = Math.min(390, window.innerWidth - 24)
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
        let top = rect.bottom + 8
        if (top + panel.offsetHeight > window.innerHeight - 12) top = Math.max(12, rect.top - panel.offsetHeight - 8)
        panel.style.left = `${left}px`
        panel.style.top = `${top}px`
      }

      const render = () => {
        if (!panel) return
        const regions = UZBEKISTAN_LOCATIONS
        const regionData = regions.find((item) => item.name === state.region)
        const districts = regionData?.districts || []
        panel.innerHTML = ''

        const head = document.createElement('div')
        head.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px'
        const headText = document.createElement('div')
        headText.innerHTML = `<div style="font-size:16px;font-weight:800">${ru ? 'Местоположение' : 'Joylashuv'}</div><div style="margin-top:3px;font-size:12px;color:#64748b">${regionLabel(state.region, ru)}${state.district ? ` · ${state.district}` : ''}${state.neighborhood ? ` · ${state.neighborhood}` : ''}</div>`
        const close = document.createElement('button')
        close.type = 'button'
        close.textContent = '×'
        close.setAttribute('aria-label', ru ? 'Закрыть' : 'Yopish')
        close.style.cssText = 'width:32px;height:32px;border:0;border-radius:10px;background:#f8fafc;color:#64748b;font-size:22px;cursor:pointer'
        close.onclick = closePanel
        head.append(headText, close)
        panel.appendChild(head)

        const makeLabel = (title: string, select: HTMLSelectElement) => {
          const wrap = document.createElement('label')
          wrap.style.cssText = 'display:block;margin-top:10px'
          const small = document.createElement('span')
          small.textContent = title
          small.style.cssText = 'display:block;margin-bottom:5px;font-size:11px;font-weight:700;color:#64748b'
          select.style.cssText = 'width:100%;height:42px;border:1px solid #e2e8f0;border-radius:11px;background:#fff;padding:0 11px;font-size:13px;font-weight:700;color:#0f172a;outline:none'
          wrap.append(small, select)
          panel?.appendChild(wrap)
        }

        const regionSelect = document.createElement('select')
        const allRegion = document.createElement('option')
        allRegion.value = 'ALL'
        allRegion.textContent = ru ? 'Весь Узбекистан' : 'Butun O‘zbekiston'
        regionSelect.appendChild(allRegion)
        regions.forEach((item) => {
          const option = document.createElement('option')
          option.value = item.name
          option.textContent = ru ? item.name.replace(' viloyati', ' область') : item.name
          regionSelect.appendChild(option)
        })
        regionSelect.value = state.region || 'ALL'
        regionSelect.onchange = () => {
          state = { region: regionSelect.value, district: '', neighborhood: '' }
          neighborhoods = []
          loadingNeighborhoods = false
          render()
        }
        makeLabel(ru ? 'Область / город' : 'Viloyat / shahar', regionSelect)

        const districtSelect = document.createElement('select')
        const allDistrict = document.createElement('option')
        allDistrict.value = ''
        allDistrict.textContent = ru ? 'Все районы' : 'Barcha tumanlar'
        districtSelect.appendChild(allDistrict)
        districts.forEach((item) => {
          const option = document.createElement('option')
          option.value = item
          option.textContent = ru ? item.replace(' tumani', ' район').replace(' shahri', ' город') : item
          districtSelect.appendChild(option)
        })
        districtSelect.value = state.district
        districtSelect.disabled = !state.region || state.region === 'ALL'
        districtSelect.onchange = async () => {
          state = { ...state, district: districtSelect.value, neighborhood: '' }
          neighborhoods = []
          loadingNeighborhoods = false
          render()
          if (state.district) {
            loadingNeighborhoods = true
            render()
            try {
              const db = createClient()
              const { data } = await db.from('listings').select('neighborhood').eq('district', state.district).not('neighborhood', 'is', null).limit(500)
              neighborhoods = Array.from(new Set((data || []).map((item: any) => String(item.neighborhood || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
            } catch {
              neighborhoods = []
            } finally {
              loadingNeighborhoods = false
              render()
            }
          }
        }
        makeLabel(ru ? 'Район / город' : 'Tuman / shahar', districtSelect)

        const neighborhoodSelect = document.createElement('select')
        const anyNeighborhood = document.createElement('option')
        anyNeighborhood.value = ''
        anyNeighborhood.textContent = ru ? 'Все махалли' : 'Barcha mahallalar'
        neighborhoodSelect.appendChild(anyNeighborhood)
        neighborhoods.forEach((item) => {
          const option = document.createElement('option')
          option.value = item
          option.textContent = item
          neighborhoodSelect.appendChild(option)
        })
        neighborhoodSelect.value = state.neighborhood
        neighborhoodSelect.disabled = !state.district || loadingNeighborhoods
        neighborhoodSelect.onchange = () => {
          state = { ...state, neighborhood: neighborhoodSelect.value }
          render()
        }
        makeLabel(loadingNeighborhoods ? (ru ? 'Махалля · загрузка…' : 'Mahalla · yuklanmoqda…') : (ru ? 'Махалля (необязательно)' : 'Mahalla (ixtiyoriy)'), neighborhoodSelect)

        const note = document.createElement('div')
        note.style.cssText = 'margin-top:12px;border-radius:12px;background:#f8fafc;padding:10px 11px;font-size:11px;line-height:1.45;color:#64748b'
        note.textContent = ru ? 'Махалля не обязательна. Можно выбрать только область/город или район. Точный выбор можно продолжить на карте.' : 'Mahalla shart emas. Faqat viloyat/shahar yoki tuman tanlashning o‘zi yetarli. Aniq hududni xaritada davom ettirishingiz mumkin.'
        panel.appendChild(note)

        const actions = document.createElement('div')
        actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px'
        const apply = document.createElement('button')
        apply.type = 'button'
        apply.textContent = ru ? 'Применить' : 'Qo‘llash'
        apply.style.cssText = 'height:42px;border:0;border-radius:11px;background:#059669;color:#fff;font-size:13px;font-weight:800;cursor:pointer'
        apply.onclick = () => {
          localStorage.setItem(LOCATION_KEY, JSON.stringify(state))
          button.textContent = `⌖ ${regionLabel(state.region, ru)}`
          button.setAttribute('data-royalhouse-location-lang', ru ? 'ru' : 'uz')
          closePanel()
          const params = new URLSearchParams()
          if (state.region && state.region !== 'ALL') params.set('region', state.region)
          if (state.district) params.set('district', state.district)
          if (state.neighborhood) params.set('neighborhood', state.neighborhood)
          window.location.href = `/listings?${params.toString()}`
        }
        const map = document.createElement('button')
        map.type = 'button'
        map.textContent = ru ? 'Открыть карту' : 'Xaritada ko‘rish'
        map.style.cssText = 'height:42px;border:1px solid #d1fae5;border-radius:11px;background:#ecfdf5;color:#047857;font-size:13px;font-weight:800;cursor:pointer'
        map.onclick = () => {
          localStorage.setItem(LOCATION_KEY, JSON.stringify(state))
          button.textContent = `⌖ ${regionLabel(state.region, ru)}`
          button.setAttribute('data-royalhouse-location-lang', ru ? 'ru' : 'uz')
          const params = new URLSearchParams()
          if (state.region && state.region !== 'ALL') params.set('region', state.region)
          if (state.district) params.set('district', state.district)
          if (state.neighborhood) params.set('neighborhood', state.neighborhood)
          window.location.href = `/listings/map${params.toString() ? `?${params.toString()}` : ''}`
        }
        actions.append(apply, map)
        panel.appendChild(actions)
        positionPanel()
      }

      render()
      document.body.appendChild(panel)
      positionPanel()

      const outside = (event: MouseEvent) => {
        const target = event.target as Node
        if (panel && !panel.contains(target) && !button.contains(target)) closePanel()
      }
      document.addEventListener('mousedown', outside)
      cleanupOutside = () => document.removeEventListener('mousedown', outside)
      const onScroll = () => positionPanel()
      window.addEventListener('resize', onScroll)
      window.addEventListener('scroll', onScroll, true)
      cleanupScroll = () => {
        window.removeEventListener('resize', onScroll)
        window.removeEventListener('scroll', onScroll, true)
      }
    }

    const fixLocation = () => {
      const existingButton = document.querySelector<HTMLButtonElement>('header button[data-royalhouse-location="1"]')
      if (existingButton) {
        const saved = readSaved()
        const ru = existingButton.getAttribute('data-royalhouse-location-lang') === 'ru' || existingButton.textContent?.includes('Ташкент') || existingButton.textContent?.includes('Весь') || false
        existingButton.textContent = `⌖ ${regionLabel(saved.region, ru)}`
        return
      }

      const locationNodes = Array.from(document.querySelectorAll('header span')).filter((node) => {
        const text = node.textContent?.trim()
        return text === '⌖ Toshkent' || text === '⌖ Ташкент'
      })
      if (locationNodes.length > 1) locationNodes[0].remove()
      const node = locationNodes[locationNodes.length - 1]
      if (!node) return

      const saved = readSaved()
      const ru = node.textContent?.includes('Ташкент') || false
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = `⌖ ${regionLabel(saved.region, ru)}`
      button.className = node.className
      button.setAttribute('data-royalhouse-location', '1')
      button.setAttribute('data-royalhouse-location-lang', ru ? 'ru' : 'uz')
      button.setAttribute('aria-haspopup', 'dialog')
      button.title = ru ? 'Выбрать местоположение' : 'Joylashuvni tanlash'
      button.style.cursor = 'pointer'
      button.onclick = (event) => {
        event.stopPropagation()
        if (activeButton === button && panel) closePanel()
        else buildPanel(button)
      }
      node.replaceWith(button)
    }

    const fix = () => {
      fixPartners()
      fixLocation()
    }

    fix()
    const observer = new MutationObserver(fix)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      closePanel()
    }
  }, [])

  return null
}
