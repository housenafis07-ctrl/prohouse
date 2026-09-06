'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function GlobalNavigationFix() {
  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    let currentUserId: string | null = null

    const closeServices = () => {
      document.querySelector('.prohouse-services-overlay')?.remove()
      document.body.style.overflow = ''
    }

    const openServices = () => {
      if (document.querySelector('.prohouse-services-overlay')) return
      const isRussian = (document.body?.innerText || '').includes('Купить') || (document.body?.innerText || '').includes('Недвижимость')

      const overlay = document.createElement('div')
      overlay.className = 'prohouse-services-overlay'
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.58);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;padding:84px 20px 30px;overflow-y:auto;'

      const modal = document.createElement('div')
      modal.style.cssText = 'position:relative;width:min(1180px,100%);background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:32px;box-sizing:border-box;'
      modal.addEventListener('click', (e) => e.stopPropagation())

      const title = document.createElement('h2')
      title.textContent = isRussian ? 'Услуги' : 'Xizmatlar'
      title.style.cssText = 'margin:0 0 26px;font-size:28px;line-height:1.2;font-weight:900;color:#0f172a;'

      const close = document.createElement('button')
      close.type = 'button'
      close.textContent = '×'
      close.setAttribute('aria-label', isRussian ? 'Закрыть' : 'Yopish')
      close.style.cssText = 'position:absolute;right:14px;top:10px;border:0;background:transparent;color:#94a3b8;font-size:32px;line-height:1;cursor:pointer;padding:6px 10px;'
      close.onclick = closeServices

      const grid = document.createElement('div')
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;'

      const cards = isRussian
        ? [
            ['🔑','Сдача жилья в аренду','Сервис для собственников','/listings/new'],
            ['🏷️','Оценка недвижимости','Быстрая оценка стоимости',''],
            ['🔎','Оценка недвижимости для ипотеки','Оценка объекта для банка',''],
            ['🛡️','Сделка с гарантией','Безопасное проведение сделки',''],
            ['💵','Сделка за свои средства','Покупка и продажа без ипотеки',''],
            ['🏠','Ипотечное страхование','Страхование недвижимости',''],
          ]
        : [
            ['🔑','Uy-joyni ijaraga berish','Mulk egalari uchun xizmat','/listings/new'],
            ['🏷️','Ko‘chmas mulkni baholash','Mulk qiymatini tez baholash',''],
            ['🔎','Ipoteka uchun baholash','Bank uchun obyekt bahosi',''],
            ['🛡️','Kafolatli bitim','Bitimni xavfsiz amalga oshirish',''],
            ['💵','O‘z mablag‘iga bitim','Ipotekasiz sotib olish va sotish',''],
            ['🏠','Ipoteka sug‘urtasi','Ko‘chmas mulkni sug‘urtalash',''],
          ]

      cards.forEach(([icon, name, sub, href]) => {
        const card = document.createElement(href ? 'a' : 'button') as HTMLAnchorElement | HTMLButtonElement
        if (href) {
          ;(card as HTMLAnchorElement).href = href
        } else {
          ;(card as HTMLButtonElement).type = 'button'
          card.onclick = () => {
            const message = isRussian ? 'Этот сервис скоро будет доступен на Prohouse.' : 'Bu xizmat tez orada Prohouse’da ishga tushadi.'
            window.alert(message)
          }
        }
        card.style.cssText = 'display:flex;align-items:center;gap:16px;min-height:88px;padding:18px;border:1px solid #dbe3ea;border-radius:12px;background:#fff;text-align:left;text-decoration:none;color:#0f172a;cursor:pointer;box-sizing:border-box;transition:.15s;'
        card.onmouseenter = () => { card.style.borderColor = '#10b981'; card.style.background = '#f8fffb' }
        card.onmouseleave = () => { card.style.borderColor = '#dbe3ea'; card.style.background = '#fff' }

        const iconEl = document.createElement('span')
        iconEl.textContent = icon
        iconEl.style.cssText = 'display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#ecfdf5;font-size:24px;flex:none;'
        const copy = document.createElement('span')
        const nameEl = document.createElement('strong')
        nameEl.textContent = name
        nameEl.style.cssText = 'display:block;font-size:15px;font-weight:800;line-height:1.3;'
        const subEl = document.createElement('span')
        subEl.textContent = sub
        subEl.style.cssText = 'display:block;margin-top:5px;color:#64748b;font-size:13px;line-height:1.35;'
        copy.appendChild(nameEl)
        copy.appendChild(subEl)
        card.appendChild(iconEl)
        card.appendChild(copy)
        grid.appendChild(card)
      })

      const bottom = document.createElement('div')
      bottom.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px;'
      const makeGroup = (headingText: string, items: string[]) => {
        const box = document.createElement('div')
        box.style.cssText = 'border:1px solid #dbe3ea;border-radius:12px;padding:20px;min-height:108px;box-sizing:border-box;'
        const heading = document.createElement('h3')
        heading.textContent = headingText
        heading.style.cssText = 'margin:0 0 14px;font-size:17px;font-weight:800;color:#334155;'
        const links = document.createElement('div')
        links.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px 18px;'
        items.forEach((item) => {
          const a = document.createElement('button')
          a.type = 'button'
          a.textContent = item
          a.style.cssText = 'border:0;background:transparent;padding:0;color:#334155;text-decoration:underline;text-underline-offset:3px;font-size:14px;cursor:pointer;'
          a.onclick = () => window.alert(isRussian ? 'Этот сервис скоро будет доступен на Prohouse.' : 'Bu xizmat tez orada Prohouse’da ishga tushadi.')
          links.appendChild(a)
        })
        box.appendChild(heading)
        box.appendChild(links)
        return box
      }

      bottom.appendChild(makeGroup(isRussian ? 'Проведение сделки' : 'Bitimni amalga oshirish', isRussian ? ['Договор купли-продажи','Регистрация и расчёты','Электронная регистрация','Безопасные расчёты'] : ['Oldi-sotdi shartnomasi','Ro‘yxatdan o‘tkazish va hisob-kitob','Elektron ro‘yxatdan o‘tkazish','Xavfsiz hisob-kitob']))
      bottom.appendChild(makeGroup(isRussian ? 'Сервисы для дома' : 'Uy uchun xizmatlar', isRussian ? ['Товары','Ремонт','Клининг','Дизайн-проект','Мастер на час'] : ['Tovarlar','Ta’mirlash','Klining','Dizayn-loyiha','Soatbay usta']))

      modal.appendChild(close)
      modal.appendChild(title)
      modal.appendChild(grid)
      modal.appendChild(bottom)
      overlay.appendChild(modal)
      overlay.addEventListener('click', closeServices)
      document.body.appendChild(overlay)
      document.body.style.overflow = 'hidden'
    }

    const applyNavigation = () => {
      if (!mounted) return

      const loggedIn = Boolean(currentUserId)
      const bodyText = document.body?.innerText || ''
      const isRussian = bodyText.includes('Купить') || bodyText.includes('Недвижимость') || bodyText.includes('Найдите дом мечты')

      document.querySelectorAll('.global-post-listing').forEach((el) => el.remove())

      const listingLinks = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[]
      const topListingLink = listingLinks.find((link) => {
        const text = link.textContent?.trim() || ''
        return text === 'Разместить объявление' || text === 'E’lon joylashtirish'
      })
      if (topListingLink) {
        topListingLink.href = '/listings/new'
        topListingLink.onclick = () => {
          window.location.assign('/listings/new')
        }
      }

      // Xizmatlar / Услуги opens a Domclick-style service menu instead of /listings.
      listingLinks.forEach((link) => {
        const text = link.textContent?.trim() || ''
        if (text === 'Услуги' || text === 'Xizmatlar') {
          link.href = '#services'
          link.onclick = (event) => {
            event.preventDefault()
            openServices()
          }
        }
      })

      const button = document.querySelector('.account-btn') as HTMLButtonElement | null
      if (button) {
        const desiredText = loggedIn
          ? (isRussian ? 'Личный кабинет' : 'Shaxsiy kabinet')
          : (isRussian ? 'Войти / Регистрация' : 'Kirish / Ro‘yxatdan o‘tish')

        if (button.textContent !== desiredText) button.textContent = desiredText

        const desiredAction = loggedIn ? 'account' : 'login'
        if (button.dataset.authAction !== desiredAction) {
          button.dataset.authAction = desiredAction
          button.onclick = (event) => {
            event.preventDefault()
            window.location.assign(loggedIn ? '/account' : '/register')
          }
        }
      }

      if (loggedIn && window.location.pathname === '/account') {
        const existing = document.querySelector('.account-post-listing') as HTMLAnchorElement | null
        if (!existing) {
          const heading = Array.from(document.querySelectorAll('h2')).find(
            (h) => h.textContent?.trim() === 'Keyingi qadamlar' || h.textContent?.trim() === 'Следующие шаги'
          )
          const section = heading?.closest('section')
          const container = section?.querySelector('div.mt-4')
          if (container) {
            const link = document.createElement('a')
            link.className = 'account-post-listing'
            link.href = '/listings/new'
            link.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;border:1px solid #a7f3d0;border-radius:16px;padding:16px;background:#ecfdf5;color:#065f46;font-size:14px;font-weight:800;text-decoration:none;margin-bottom:12px;'

            const icon = document.createElement('span')
            icon.textContent = '+'
            icon.style.cssText = 'display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:#d1fae5;color:#059669;font-size:22px;font-weight:900;flex:none;'

            const text = document.createElement('span')
            text.innerHTML = isRussian
              ? '<span style="display:block">Разместить объявление</span><span style="display:block;margin-top:3px;font-size:12px;font-weight:500;color:#047857">Продайте или сдайте недвижимость на Prohouse.</span>'
              : '<span style="display:block">E’lon joylashtirish</span><span style="display:block;margin-top:3px;font-size:12px;font-weight:500;color:#047857">Mulkingizni Prohouse’da soting yoki ijaraga bering.</span>'

            link.appendChild(icon)
            link.appendChild(text)
            container.insertBefore(link, container.firstChild)
          }
        }
      }
    }

    const syncAuthState = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      currentUserId = user?.id ?? null
      applyNavigation()
    }

    const observer = new MutationObserver(() => applyNavigation())
    observer.observe(document.body, { childList: true, subtree: true })

    void syncAuthState()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      currentUserId = session?.user?.id ?? null
      applyNavigation()
    })

    return () => {
      mounted = false
      observer.disconnect()
      listener.subscription.unsubscribe()
      closeServices()
    }
  }, [])

  return null
}
