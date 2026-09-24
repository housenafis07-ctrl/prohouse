'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

type Taxonomy = {
  code: string
  name_uz: string
  name_ru: string | null
}

type ServiceItem = {
  uz: string
  ru: string
  descUz: string
  descRu: string
  href: string
  icon: string
  external?: boolean
}

type Tab = {
  key: 'home' | 'finance' | 'interactive'
  uz: string
  ru: string
  descUz: string
  descRu: string
}

export default function GlobalNavigationFix() {
  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    let userId: string | null = null

    const isRu = () => window.localStorage.getItem('royalhouse-lang') === 'ru'

    const close = () => {
      document.querySelector('.prohouse-services-overlay')?.remove()
      document.querySelector('.prohouse-services-style')?.remove()
      document.querySelector('.prohouse-shadow-overlay')?.remove()
      document.body.style.overflow = ''
    }

    const openBuildingShadow = () => {
      if (document.querySelector('.prohouse-shadow-overlay')) return

      const ru = isRu()
      const overlay = document.createElement('div')
      overlay.className = 'prohouse-shadow-overlay'

      const modal = document.createElement('div')
      modal.className = 'prohouse-shadow-modal'

      const topbar = document.createElement('div')
      topbar.className = 'prohouse-shadow-topbar'

      const title = document.createElement('strong')
      title.textContent = ru ? 'Тень здания — симулятор солнца' : 'Bino soyasini ko‘rish — quyosh va soya simulyatori'

      const closeButton = document.createElement('button')
      closeButton.type = 'button'
      closeButton.className = 'prohouse-shadow-close'
      closeButton.textContent = '×'
      closeButton.setAttribute('aria-label', ru ? 'Закрыть' : 'Yopish')
      closeButton.onclick = () => {
        overlay.remove()
        document.body.style.overflow = 'hidden'
      }

      const iframe = document.createElement('iframe')
      iframe.className = 'prohouse-shadow-frame'
      iframe.src = ru ? '/tools/building-shadow.html?lang=ru' : '/tools/building-shadow.html'
      iframe.title = ru ? 'Симулятор тени здания' : 'Bino soyasi simulyatori'
      iframe.loading = 'eager'
      iframe.setAttribute('allowfullscreen', '')

      topbar.append(title, closeButton)
      modal.append(topbar, iframe)
      overlay.appendChild(modal)
      document.body.appendChild(overlay)
      document.body.style.overflow = 'hidden'
    }

    const openServices = async () => {
      if (document.querySelector('.prohouse-services-overlay')) return

      const ru = isRu()
      let services: Taxonomy[] = []

      try {
        const { data } = await supabase
          .from('partner_listing_taxonomy')
          .select('code,name_uz,name_ru')
          .eq('section_code', 'services')
          .eq('parent_code', 'services')
          .eq('is_active', true)
          .eq('allows_partner_listing', true)
          .order('sort_order')

        services = (data || []) as Taxonomy[]
      } catch {
        services = []
      }

      if (!mounted) return

      const icons: Record<string, string> = {
        services_repair: '🔧',
        services_cleaning: '🧹',
        services_design: '🎨',
        services_construction: '🏗️',
        services_furniture: '🪑',
        services_plumbing: '🚿',
        services_electric: '⚡',
        services_moving: '🚚',
        services_other: '🛠️',
        services_landscape: '🌳',
        services_cctv: '📹',
        services_ac_installation: '❄️',
      }

      const finance: ServiceItem[] = [
        { uz: 'E-Notarius', ru: 'E-Notarius', descUz: 'Elektron notarial xizmatlar', descRu: 'Электронные нотариальные услуги', href: 'https://e-notarius.uz/', icon: '📄', external: true },
        { uz: 'Mulkni baholash', ru: 'Оценка недвижимости', descUz: 'Ko‘chmas mulk qiymatini baholash', descRu: 'Оценка стоимости недвижимости', href: '/services/request?type=property_valuation', icon: '📊' },
        { uz: 'Sug‘urta xizmati', ru: 'Страховые услуги', descUz: 'Uy va mulkni onlayn sug‘urtalash', descRu: 'Онлайн-страхование жилья и имущества', href: '/services/request?type=insurance', icon: '🛡️' },
      ]

      const interactive: ServiceItem[] = [
        { uz: 'Bino soyasini ko‘rish', ru: 'Посмотреть тень здания', descUz: 'Bino soyasining uzunligi va yo‘nalishini hisoblash', descRu: 'Расчёт длины и направления тени здания', href: '/tools/building-shadow.html', icon: '☀️' },
        { uz: 'Qurilishlar statistikasi', ru: 'Статистика строительства', descUz: 'Qurilish obyektlari bo‘yicha interaktiv ma’lumotlar', descRu: 'Интерактивные данные по строительным объектам', href: 'https://dshk.shaffofqurilish.uz/oz', icon: '🏗️', external: true },
      ]

      const tabs: Tab[] = [
        { key: 'home', uz: 'Uy bilan bog‘liq xizmatlar', ru: 'Услуги для дома', descUz: 'Remont, tozalash, dizayn va boshqa xizmatlar', descRu: 'Ремонт, клининг, дизайн и другие услуги' },
        { key: 'finance', uz: 'Moliyaviy va huquqiy xizmatlar', ru: 'Финансовые и юридические услуги', descUz: 'Notarius, baholash va sug‘urta', descRu: 'Нотариус, оценка и страхование' },
        { key: 'interactive', uz: 'Interaktiv xizmatlar', ru: 'Интерактивные сервисы', descUz: 'Bino soyasi va qurilish statistikasi', descRu: 'Расчёт тени и строительная статистика' },
      ]

      const style = document.createElement('style')
      style.className = 'prohouse-services-style'
      style.textContent = `
.prohouse-services-overlay{position:fixed;inset:0;z-index:9999;background:rgba(4,10,20,.72);backdrop-filter:blur(10px);display:flex;align-items:flex-start;justify-content:center;padding:60px 20px 30px;overflow:auto}
.prohouse-services-modal{position:relative;width:min(1180px,100%);background:#fff;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:32px;box-sizing:border-box}
.prohouse-services-head{display:flex;align-items:center;gap:16px;padding-right:50px}.prohouse-services-head-icon{width:58px;height:58px;border-radius:18px;background:#ecfdf5;display:flex;align-items:center;justify-content:center;font-size:28px;flex:none}.prohouse-services-title{margin:0 0 8px;font-size:30px;font-weight:900;color:#0f172a;line-height:1.1}.prohouse-services-subtitle{margin:0;color:#64748b;font-size:14px}.prohouse-services-close{position:absolute;right:16px;top:12px;border:0;background:#f1f5f9;color:#64748b;border-radius:50%;width:38px;height:38px;font-size:26px;cursor:pointer}
.prohouse-services-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:24px 0 18px}.prohouse-services-tab{border:1px solid #dbe3ea;border-radius:16px;background:#f8fafc;color:#334155;padding:14px 16px;text-align:left;cursor:pointer;font-weight:900;font-size:14px;line-height:1.25}.prohouse-services-tab.active{border-color:#10b981;background:#ecfdf5;color:#047857}.prohouse-services-tab span{display:block;margin-top:4px;color:#64748b;font-size:11px;font-weight:500}
.prohouse-services-search{width:100%;margin:0 0 16px;padding:14px 16px;border:1px solid #dbe3ea;border-radius:16px;background:#f8fafc;color:#0f172a;font-size:15px;outline:none;box-sizing:border-box}.prohouse-services-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.prohouse-service-card{display:flex;align-items:center;gap:14px;min-height:92px;padding:16px;border:1px solid #dbe3ea;border-radius:16px;background:#fff;text-decoration:none;color:#0f172a;box-sizing:border-box;transition:.15s;min-width:0}.prohouse-service-card:hover{border-color:#10b981;background:#f8fffb}.prohouse-service-icon{display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#ecfdf5;font-size:24px;flex:none}.prohouse-service-content{min-width:0;flex:1}.prohouse-service-name{display:block;font-size:15px;font-weight:900;line-height:1.25;overflow-wrap:anywhere}.prohouse-service-sub{display:block;margin-top:4px;color:#64748b;font-size:12px;line-height:1.35;overflow-wrap:anywhere}.prohouse-service-arrow{font-size:22px;color:#94a3b8;flex:none}.prohouse-services-note{margin-top:18px;padding:14px 16px;border-radius:14px;background:#f8fafc;color:#64748b;font-size:13px;line-height:1.45}
@media(max-width:900px){.prohouse-services-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.prohouse-services-overlay{padding:10px 8px 18px}.prohouse-services-modal{width:100%;min-height:calc(100vh - 28px);padding:18px 12px 16px;border-radius:28px;background:linear-gradient(180deg,#111827 0%,#172131 100%);color:#f8fafc}.prohouse-services-head{gap:12px;padding:4px 48px 0 2px}.prohouse-services-head-icon{width:54px;height:54px;border-radius:17px;background:rgba(16,185,129,.16);font-size:25px}.prohouse-services-title{font-size:28px;color:#f8fafc}.prohouse-services-subtitle{font-size:14px;color:#94a3b8}.prohouse-services-close{right:14px;top:14px;width:48px;height:48px;background:#475569;color:#dbeafe;font-size:31px}.prohouse-services-tabs{grid-template-columns:1fr;gap:8px;margin:18px 0 12px}.prohouse-services-tab{padding:12px 13px;background:rgba(30,41,59,.75);border-color:rgba(100,116,139,.42);color:#f8fafc}.prohouse-services-tab.active{background:rgba(16,185,129,.15);color:#6ee7b7}.prohouse-services-tab span{color:#94a3b8}.prohouse-services-search{height:50px;padding:0 15px;background:rgba(30,41,59,.9);border-color:rgba(148,163,184,.38);color:#f8fafc}.prohouse-services-search::placeholder{color:#94a3b8}.prohouse-services-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.prohouse-service-card{min-height:125px;padding:10px 8px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:7px;border-radius:17px;background:rgba(30,41,59,.74);border-color:rgba(100,116,139,.42);color:#f8fafc}.prohouse-service-icon{width:43px;height:43px;font-size:22px;background:rgba(0,90,75,.55)}.prohouse-service-name{font-size:12.5px;color:#f8fafc}.prohouse-service-sub{font-size:10.5px;color:#94a3b8}.prohouse-service-arrow{display:none}.prohouse-services-note{margin-top:12px;padding:13px 14px;background:rgba(30,41,59,.75);color:#a8b6c9;font-size:12.5px}}
.prohouse-shadow-overlay{position:fixed;inset:0;z-index:10001;background:rgba(2,6,23,.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}.prohouse-shadow-modal{width:min(1400px,100%);height:min(900px,calc(100vh - 36px));background:#111827;border-radius:22px;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.4);display:flex;flex-direction:column}.prohouse-shadow-topbar{height:58px;min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 14px 0 20px;background:#0f172a;color:#f8fafc;border-bottom:1px solid #334155}.prohouse-shadow-topbar strong{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.prohouse-shadow-close{width:40px;height:40px;border:0;border-radius:50%;background:#334155;color:#fff;font-size:26px;line-height:1;cursor:pointer;flex:none}.prohouse-shadow-frame{display:block;width:100%;height:100%;border:0;background:#12151c}
@media(max-width:900px){.prohouse-services-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.prohouse-shadow-overlay{padding:8px}.prohouse-shadow-modal{height:calc(100vh - 16px);border-radius:18px}.prohouse-shadow-topbar{height:54px;min-height:54px;padding-left:14px}}
@media(max-width:640px){.prohouse-services-overlay{padding:10px 8px 18px}.prohouse-services-modal{width:100%;min-height:calc(100vh - 28px);padding:18px 12px 16px;border-radius:28px;background:linear-gradient(180deg,#111827 0%,#172131 100%);color:#f8fafc}.prohouse-services-head{gap:12px;padding:4px 48px 0 2px}.prohouse-services-head-icon{width:54px;height:54px;border-radius:17px;background:rgba(16,185,129,.16);font-size:25px}.prohouse-services-title{font-size:28px;color:#f8fafc}.prohouse-services-subtitle{font-size:14px;color:#94a3b8}.prohouse-services-close{right:14px;top:14px;width:48px;height:48px;background:#475569;color:#dbeafe;font-size:31px}.prohouse-services-tabs{grid-template-columns:1fr;gap:8px;margin:18px 0 12px}.prohouse-services-tab{padding:12px 13px;background:rgba(30,41,59,.75);border-color:rgba(100,116,139,.42);color:#f8fafc}.prohouse-services-tab.active{background:rgba(16,185,129,.15);color:#6ee7b7}.prohouse-services-tab span{color:#94a3b8}.prohouse-services-search{height:50px;padding:0 15px;background:rgba(30,41,59,.9);border-color:rgba(148,163,184,.38);color:#f8fafc}.prohouse-services-search::placeholder{color:#94a3b8}.prohouse-services-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.prohouse-service-card{min-height:125px;padding:10px 8px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:7px;border-radius:17px;background:rgba(30,41,59,.74);border-color:rgba(100,116,139,.42);color:#f8fafc}.prohouse-service-icon{width:43px;height:43px;font-size:22px;background:rgba(0,90,75,.55)}.prohouse-service-name{font-size:12.5px;color:#f8fafc}.prohouse-service-sub{font-size:10.5px;color:#94a3b8}.prohouse-service-arrow{display:none}.prohouse-services-note{margin-top:12px;padding:13px 14px;background:rgba(30,41,59,.75);color:#a8b6c9;font-size:12.5px}.prohouse-shadow-topbar{height:52px;min-height:52px;padding:0 10px 0 13px}.prohouse-shadow-topbar strong{font-size:13px}.prohouse-shadow-close{width:38px;height:38px;font-size:24px}}
`
      document.head.appendChild(style)

      const overlay = document.createElement('div')
      overlay.className = 'prohouse-services-overlay'
      overlay.onclick = close

      const modal = document.createElement('div')
      modal.className = 'prohouse-services-modal'
      modal.onclick = (event) => event.stopPropagation()

      const closeButton = document.createElement('button')
      closeButton.type = 'button'
      closeButton.textContent = '×'
      closeButton.className = 'prohouse-services-close'
      closeButton.setAttribute('aria-label', ru ? 'Закрыть' : 'Yopish')
      closeButton.onclick = close

      const head = document.createElement('div')
      head.className = 'prohouse-services-head'
      const headIcon = document.createElement('div')
      headIcon.className = 'prohouse-services-head-icon'
      headIcon.textContent = '▦'
      const headText = document.createElement('div')
      const title = document.createElement('h2')
      title.className = 'prohouse-services-title'
      title.textContent = ru ? 'Услуги' : 'Xizmatlar'
      const subtitle = document.createElement('p')
      subtitle.className = 'prohouse-services-subtitle'
      subtitle.textContent = ru ? 'Выберите нужное направление' : 'Kerakli xizmat yo‘nalishini tanlang'
      headText.append(title, subtitle)
      head.append(headIcon, headText)

      const tabContainer = document.createElement('div')
      tabContainer.className = 'prohouse-services-tabs'
      const search = document.createElement('input')
      search.className = 'prohouse-services-search'
      search.type = 'search'
      search.placeholder = ru ? 'Поиск услуги...' : 'Xizmat qidirish...'
      search.setAttribute('aria-label', ru ? 'Поиск услуги' : 'Xizmat qidirish')
      const grid = document.createElement('div')
      grid.className = 'prohouse-services-grid'
      let active: Tab['key'] = 'home'

      const render = () => {
        grid.innerHTML = ''
        search.value = ''

        const items: ServiceItem[] = active === 'home'
          ? services.map((service): ServiceItem => ({
              uz: service.name_uz,
              ru: service.name_ru || service.name_uz,
              descUz: 'Xizmat',
              descRu: 'Услуга',
              href: `/listings?tab=all&taxonomy=${encodeURIComponent(service.code)}`,
              icon: icons[service.code] || '🛠️',
            }))
          : active === 'finance'
            ? finance
            : interactive

        items.forEach((item) => {
          const card = document.createElement('a')
          card.href = item.href
          card.className = 'prohouse-service-card'
          if (item.external) {
            card.target = '_blank'
            card.rel = 'noopener noreferrer'
          }
          if (item.href === '/tools/building-shadow.html') {
            card.onclick = (event) => {
              event.preventDefault()
              openBuildingShadow()
            }
          }
          card.dataset.search = `${item.uz} ${item.ru} ${item.descUz} ${item.descRu}`.toLowerCase()

          const icon = document.createElement('span')
          icon.className = 'prohouse-service-icon'
          icon.textContent = item.icon
          const content = document.createElement('span')
          content.className = 'prohouse-service-content'
          const name = document.createElement('strong')
          name.className = 'prohouse-service-name'
          name.textContent = ru ? item.ru : item.uz
          const description = document.createElement('span')
          description.className = 'prohouse-service-sub'
          description.textContent = ru ? item.descRu : item.descUz
          content.append(name, description)
          const arrow = document.createElement('span')
          arrow.className = 'prohouse-service-arrow'
          arrow.textContent = '›'
          card.append(icon, content, arrow)
          grid.appendChild(card)
        })
      }

      tabs.forEach((tab) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = `prohouse-services-tab${tab.key === active ? ' active' : ''}`
        button.innerHTML = `${ru ? tab.ru : tab.uz}<span>${ru ? tab.descRu : tab.descUz}</span>`
        button.onclick = () => {
          active = tab.key
          tabContainer.querySelectorAll('.prohouse-services-tab').forEach((element) => element.classList.remove('active'))
          button.classList.add('active')
          render()
        }
        tabContainer.appendChild(button)
      })

      search.oninput = () => {
        const query = search.value.trim().toLowerCase()
        grid.querySelectorAll<HTMLElement>('.prohouse-service-card').forEach((card) => {
          card.style.display = !query || card.dataset.search?.includes(query) ? 'flex' : 'none'
        })
      }

      const note = document.createElement('div')
      note.className = 'prohouse-services-note'
      note.textContent = ru
        ? 'Существующие услуги для дома сохранены. Страхование подготовлено для будущей API-интеграции с партнёрами.'
        : 'Mavjud uy xizmatlari saqlandi. Sug‘urta hamkor kompaniyalar API integratsiyasiga tayyorlangan.'

      render()
      modal.append(closeButton, head, tabContainer, search, grid, note)
      overlay.appendChild(modal)
      document.body.appendChild(overlay)
      document.body.style.overflow = 'hidden'
    }

    const updateAccount = () => {
      const button = document.querySelector('.account-btn') as HTMLButtonElement | null
      if (!button) return
      const ru = isRu()
      const text = userId
        ? ru ? 'Личный кабинет' : 'Shaxsiy kabinet'
        : ru ? 'Войти / Регистрация' : 'Kirish / Ro‘yxatdan o‘tish'
      if (button.textContent !== text) button.textContent = text
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const link = target?.closest('a') as HTMLAnchorElement | null
      if (link) {
        const text = link.textContent?.trim() || ''
        if (text === 'Услуги' || text === 'Xizmatlar') {
          event.preventDefault()
          void openServices()
          return
        }
      }
      const accountButton = target?.closest('.account-btn') as HTMLButtonElement | null
      if (accountButton) {
        event.preventDefault()
        window.location.assign(userId ? '/account' : '/register')
      }
    }

    const sync = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (mounted) {
          userId = user?.id ?? null
          updateAccount()
        }
      } catch {
        // Keep the current account button state when auth lookup fails.
      }
    }

    document.addEventListener('click', handleClick)
    window.addEventListener('royalhouse-language-change', updateAccount)
    updateAccount()
    void sync()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      userId = session?.user?.id ?? null
      updateAccount()
    })

    return () => {
      mounted = false
      document.removeEventListener('click', handleClick)
      window.removeEventListener('royalhouse-language-change', updateAccount)
      listener.subscription.unsubscribe()
      close()
    }
  }, [])

  return null
}
