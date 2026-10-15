'use client'

import { useEffect, useState } from 'react'
import { useI18n } from './I18nProvider'

const faqUz = [
  ['RoyalHouse nima?', 'RoyalHouse — O‘zbekistonda uy, kvartira, hovli, dacha va boshqa ko‘chmas mulkni topish, sotish va ijaraga olishga yordam beradigan ko‘chmas mulk platformasi.'],
  ['Ipoteka krediti orqali uy olish mumkinmi?', 'Ha. Ipotekaga mos e’lonlarni qidirish va ipoteka imkoniyatlari haqida ma’lumot olish mumkin. Aniq kredit shartlari bank, dastur va mijozning moliyaviy holatiga qarab belgilanadi.'],
  ['Ishonchli profil nima?', 'Ishonchli profil — shaxsini yoki biznes ma’lumotlarini tasdiqlagan e’lon joylovchi profilidir. Bunday profil foydalanuvchiga e’lon egasining tasdiqlanganligini tezroq baholashga yordam beradi.'],
  ['AI qidiruvi qanday ishlaydi?', 'Aqlli qidiruv oddiy tilda yozilgan so‘rovni tushunadi: masalan, “Sergelida 3 xonali kvartira, 800 mln gacha”. U hudud, xona, maydon, mulk turi va budjet kabi parametrlarni ajratib, mos e’lonlarni topishga yordam beradi.'],
  ['Xarita orqali uy qanday topiladi?', 'Xarita bo‘limida e’lonlarni joylashuv bo‘yicha ko‘rish, hududni tanlash va yaqin variantlarni taqqoslash mumkin.'],
  ['E’lon joylashtirish qanday ishlaydi?', 'E’lon berish jarayoni bosqichma-bosqich to‘ldiriladi: mulk turi, joylashuv, narx, tavsif, rasmlar va aloqa ma’lumotlari kiritiladi. Keyin e’lon moderatsiya va platforma qoidalariga muvofiq ko‘rib chiqiladi.'],
  ['Dacha ijarasi qanday bron qilinadi?', 'Dacha e’lonini tanlab, mavjud sanalarni kalendardan ko‘rish va bron qilish mumkin. To‘lov tasdiqlangandan keyin bron holati va zarur aloqa ma’lumotlari ko‘rsatiladi.'],
]

const faqRu = [
  ['Что такое RoyalHouse?', 'RoyalHouse — платформа недвижимости в Узбекистане для поиска, продажи и аренды квартир, домов, дач и другой недвижимости.'],
  ['Можно ли купить жильё в ипотеку?', 'Да. Можно находить объявления, подходящие для ипотеки, и изучать информацию об ипотечных возможностях. Точные условия зависят от банка, программы и финансового положения клиента.'],
  ['Что такое надёжный профиль?', 'Надёжный профиль — профиль продавца или партнёра, подтвердившего личность или данные бизнеса. Такой статус помогает быстрее оценить подтверждённость владельца объявления.'],
  ['Как работает AI-поиск?', 'Умный поиск понимает запросы обычным языком, например: «3-комнатная квартира в Сергели до 800 млн сум». Он выделяет район, комнаты, площадь, тип недвижимости и бюджет и помогает найти подходящие объявления.'],
  ['Как искать недвижимость на карте?', 'В разделе карты можно смотреть объявления по расположению, выбирать нужный район и сравнивать варианты поблизости.'],
  ['Как разместить объявление?', 'Объявление заполняется пошагово: тип недвижимости, расположение, цена, описание, фотографии и контакты. Затем объявление проходит проверку в соответствии с правилами платформы.'],
  ['Как забронировать дачу?', 'Выберите объявление дачи, откройте календарь доступности и выберите подходящие даты. После подтверждения оплаты отображается статус бронирования и необходимые контактные данные.'],
]

export default function RoyalhouseMobileFinalPolish() {
  const { lang } = useI18n()
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-royalhouse-final-polish', 'true')
    style.textContent = `
      @media (max-width: 767px) {
        section[aria-label*="Royalhouse reklama"] {
          height: 300px !important;
          min-height: 300px !important;
          max-height: 300px !important;
          overflow: hidden !important;
        }
        section[aria-label*="Royalhouse reklama"] > div,
        section[aria-label*="Royalhouse reklama"] > div > div {
          height: 300px !important;
          min-height: 300px !important;
          max-height: 300px !important;
        }
        section[aria-label*="Royalhouse reklama"] img {
          height: 300px !important;
          min-height: 300px !important;
          object-fit: cover !important;
        }
        section[aria-label*="Royalhouse reklama"] [class*="min-h-"] {
          min-height: 300px !important;
        }
        section[aria-label*="Royalhouse reklama"] [class*="mt-36"] {
          margin-top: 12px !important;
        }
      }
    `
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  useEffect(() => {
    const enhanceFooter = () => {
      const footer = document.querySelector<HTMLElement>('main > footer')
      if (!footer) return false

      footer.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => {
        const text = link.textContent?.replace(/\s+/g, ' ').trim().toLocaleLowerCase('uz-UZ') || ''
        if (
          text.includes('barchasini ko‘rish') ||
          text.includes("e’lon joylashtirish") ||
          text.includes('shaxsiy kabinet') ||
          text.includes('смотреть все') ||
          text.includes('разместить объявление') ||
          text.includes('личный кабинет')
        ) {
          link.style.display = 'none'
        }
      })

      if (footer.querySelector('[data-royalhouse-footer-seo]')) return true

      const contact = footer.querySelector('[data-royalhouse-contact]')
      const section = document.createElement('section')
      section.setAttribute('data-royalhouse-footer-seo', 'true')
      section.style.borderBottom = '1px solid rgba(255,255,255,.08)'
      section.style.padding = '28px 20px'
      section.innerHTML = `
        <div style="max-width:1280px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:28px">
          <div>
            <h2 style="margin:0;font-size:22px;line-height:1.2;font-weight:900;color:#fff">${lang === 'ru' ? 'О нас' : 'Biz haqimizda'}</h2>
            <p style="margin:10px 0 0;max-width:520px;font-size:14px;line-height:1.65;color:#9bb0ba">${lang === 'ru' ? 'RoyalHouse — современная платформа недвижимости Узбекистана. Мы помогаем находить жильё, размещать объявления, сравнивать варианты и получать полезную информацию о покупке, аренде и ипотеке в одном месте.' : 'RoyalHouse — O‘zbekiston ko‘chmas mulk bozori uchun zamonaviy platforma. Biz uy topish, e’lon joylashtirish, variantlarni taqqoslash va sotib olish, ijara hamda ipoteka bo‘yicha foydali ma’lumotlarni bir joyda olishga yordam beramiz.'}</p>
          </div>
          <div>
            <h2 style="margin:0;font-size:22px;line-height:1.2;font-weight:900;color:#fff">${lang === 'ru' ? 'Часто задаваемые вопросы' : 'Tez-tez beriladigan savollar'}</h2>
            <div data-rh-faq-list style="margin-top:12px"></div>
          </div>
        </div>
        <style>
          @media(max-width:767px){
            [data-royalhouse-footer-seo]>div{grid-template-columns:1fr!important;gap:22px!important}
          }
        </style>
      `

      if (contact) contact.insertAdjacentElement('afterend', section)
      else footer.insertBefore(section, footer.firstElementChild)
      return true
    }

    if (!enhanceFooter()) {
      const observer = new MutationObserver(() => {
        if (enhanceFooter()) observer.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
      return () => observer.disconnect()
    }
  }, [lang])

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-rh-faq-list]')
    if (!root) return
    const items = lang === 'ru' ? faqRu : faqUz
    root.innerHTML = ''
    items.forEach(([question, answer], index) => {
      const row = document.createElement('div')
      row.style.borderTop = '1px solid rgba(255,255,255,.08)'
      row.style.padding = '12px 0'
      const button = document.createElement('button')
      button.type = 'button'
      button.style.width = '100%'
      button.style.display = 'flex'
      button.style.alignItems = 'center'
      button.style.justifyContent = 'space-between'
      button.style.gap = '12px'
      button.style.border = '0'
      button.style.background = 'transparent'
      button.style.padding = '0'
      button.style.color = '#fff'
      button.style.textAlign = 'left'
      button.style.fontSize = '14px'
      button.style.fontWeight = '800'
      button.innerHTML = `<span>${question}</span><span style="color:#08d878;font-size:20px;line-height:1">${open === index ? '−' : '+'}</span>`
      button.addEventListener('click', () => setOpen(current => current === index ? null : index))
      row.appendChild(button)
      if (open === index) {
        const answerEl = document.createElement('p')
        answerEl.style.margin = '9px 28px 0 0'
        answerEl.style.color = '#9bb0ba'
        answerEl.style.fontSize = '13px'
        answerEl.style.lineHeight = '1.6'
        answerEl.textContent = answer
        row.appendChild(answerEl)
      }
      root.appendChild(row)
    })
  }, [lang, open])

  return null
}
