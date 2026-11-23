'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useI18n } from '@/app/components/I18nProvider'

type Copy = { uz: string; ru: string }

type PartnerGroup = {
  id: string
  label: Copy
  title: Copy
  description: Copy
  bullets: Copy[]
}

const groups: PartnerGroup[] = [
  {
    id: 'realtor',
    label: { uz: 'Rieltorlar va agentliklar', ru: 'Риелторы и агентства' },
    title: { uz: 'Ko‘proq mijoz, qulayroq ish jarayoni', ru: 'Больше клиентов, удобнее рабочий процесс' },
    description: { uz: 'Royalhouse’da ko‘chmas mulk e’lonlaringizni joylashtiring, murojaatlarni bir joyda boshqaring va mijozlar bilan ishlashni soddalashtiring.', ru: 'Размещайте объявления о недвижимости на Royalhouse, управляйте обращениями в одном месте и упрощайте работу с клиентами.' },
    bullets: [
      { uz: 'E’lonlarni joylashtirish va boshqarish', ru: 'Размещение и управление объявлениями' },
      { uz: 'Mijozlar murojaatlarini qabul qilish', ru: 'Получение обращений от клиентов' },
      { uz: 'Rieltor profilini to‘ldirish va ishonchni oshirish', ru: 'Заполнение профиля риелтора и повышение доверия' },
      { uz: 'Sotuv va ijara takliflarini bitta platformada yuritish', ru: 'Управление предложениями по продаже и аренде на одной платформе' },
    ],
  },
  {
    id: 'developer',
    label: { uz: 'Quruvchilar va developerlar', ru: 'Застройщики и девелоперы' },
    title: { uz: 'Yangi qurilish loyihalarini namoyish qiling', ru: 'Представляйте проекты новостроек' },
    description: { uz: 'Yangi uylar va qurilish loyihalarini xaridorlarga tushunarli ko‘rinishda taqdim eting va loyihaga qiziqqan mijozlardan murojaat oling.', ru: 'Представляйте новые дома и строительные проекты покупателям в удобном формате и получайте обращения от заинтересованных клиентов.' },
    bullets: [
      { uz: 'Yangi qurilish e’lonlarini joylashtirish', ru: 'Размещение объявлений о новостройках' },
      { uz: 'Loyiha va obyektlarni alohida ko‘rsatish', ru: 'Отдельная презентация проектов и объектов' },
      { uz: 'Xonadonlar haqidagi ma’lumotlarni taqdim etish', ru: 'Предоставление информации о квартирах' },
      { uz: 'Mijozlar bilan to‘g‘ridan-to‘g‘ri aloqa qilish', ru: 'Прямая связь с клиентами' },
    ],
  },
  {
    id: 'contractor',
    label: { uz: 'Pudratchilar', ru: 'Подрядчики' },
    title: { uz: 'Qurilish xizmatlaringizni topiladigan qiling', ru: 'Сделайте строительные услуги заметными' },
    description: { uz: 'Uy qurish, ta’mirlash va boshqa ko‘chmas mulk bilan bog‘liq xizmatlaringizni Royalhouse foydalanuvchilariga taqdim eting.', ru: 'Предлагайте пользователям Royalhouse услуги по строительству, ремонту и другие услуги, связанные с недвижимостью.' },
    bullets: [
      { uz: 'Xizmatlar uchun professional profil', ru: 'Профессиональный профиль для услуг' },
      { uz: 'Xizmat e’lonlarini joylashtirish', ru: 'Размещение объявлений об услугах' },
      { uz: 'Xizmat turiga mos mijozlardan murojaatlar', ru: 'Обращения от клиентов, заинтересованных в ваших услугах' },
      { uz: 'Ishlaringiz va takliflaringizni namoyish qilish', ru: 'Презентация работ и предложений' },
    ],
  },
  {
    id: 'service',
    label: { uz: 'Xizmat ko‘rsatuvchilar', ru: 'Поставщики услуг' },
    title: { uz: 'Ko‘chmas mulk atrofidagi xizmatlarni taklif qiling', ru: 'Предлагайте услуги для владельцев и покупателей недвижимости' },
    description: { uz: 'Tozalash, ta’mirlash, ko‘chirish va boshqa tegishli xizmatlarni izlayotgan mijozlarga o‘z xizmatlaringizni ko‘rsating.', ru: 'Предлагайте свои услуги клиентам, которые ищут уборку, ремонт, переезд и другие услуги, связанные с недвижимостью.' },
    bullets: [
      { uz: 'Xizmat kategoriyasini tanlash', ru: 'Выбор категории услуги' },
      { uz: 'Xizmat e’lonini joylashtirish', ru: 'Размещение объявления об услуге' },
      { uz: 'Mijoz murojaatlarini olish', ru: 'Получение обращений от клиентов' },
      { uz: 'Profil va xizmat ma’lumotlarini boshqarish', ru: 'Управление профилем и информацией об услугах' },
    ],
  },
]

const steps: Array<[string, Copy, Copy]> = [
  ['01', { uz: 'Ro‘yxatdan o‘ting', ru: 'Зарегистрируйтесь' }, { uz: 'Royalhouse’da hamkor akkauntini yarating va faoliyat turini belgilang.', ru: 'Создайте партнёрский аккаунт на Royalhouse и укажите направление деятельности.' }],
  ['02', { uz: 'Profilni to‘ldiring', ru: 'Заполните профиль' }, { uz: 'Kontaktlar va biznes haqidagi asosiy ma’lumotlarni kiriting.', ru: 'Укажите контактные данные и основную информацию о бизнесе.' }],
  ['03', { uz: 'E’lon yoki xizmat joylang', ru: 'Разместите объявление или услугу' }, { uz: 'Ko‘chmas mulk yoki xizmat haqidagi ma’lumotlarni kiriting.', ru: 'Добавьте информацию о недвижимости или услуге.' }],
  ['04', { uz: 'Mijozlar bilan ishlang', ru: 'Работайте с клиентами' }, { uz: 'Kelgan murojaatlarni qabul qiling va kelishuvni davom ettiring.', ru: 'Принимайте обращения и продолжайте работу с клиентами.' }],
]

export default function PartnersPage() {
  const { lang, tx } = useI18n()
  const [active, setActive] = useState('realtor')
  const current = groups.find((item) => item.id === active) ?? groups[0]
  const text = (copy: Copy) => lang === 'ru' ? copy.ru : copy.uz

  return (
    <main className="min-h-screen bg-[#f6f8f8] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-6 px-5 lg:px-8">
          <Link href="/" className="flex items-center text-2xl font-black tracking-tight"><span className="mr-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl text-white">⌂</span>Royal<span className="text-emerald-500">house</span></Link>
          <div className="flex items-center gap-3"><Link href="/" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{tx('Bosh sahifa', 'Главная')}</Link><Link href="/account" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">{tx('Shaxsiy kabinet', 'Личный кабинет')}</Link></div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#07232d]">
        <div className="absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="absolute -bottom-56 left-1/3 h-[500px] w-[500px] rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1280px] gap-12 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
          <div className="flex flex-col justify-center"><div className="mb-6 inline-flex w-fit rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">{tx('Royalhouse hamkorlari', 'Партнёры Royalhouse')}</div><h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">{tx('Biznesingizni Royalhouse bilan birga rivojlantiring', 'Развивайте свой бизнес вместе с Royalhouse')}</h1><p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{tx('Ko‘chmas mulk, yangi qurilish va tegishli xizmatlar bo‘yicha professional hamkor sifatida o‘z takliflaringizni O‘zbekiston bozoridagi foydalanuvchilarga taqdim eting.', 'Предлагайте свои услуги и объекты пользователям рынка недвижимости Узбекистана как профессиональный партнёр Royalhouse.')}</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/register?type=partner" className="rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-950/20 hover:bg-emerald-400">{tx('Hamkor sifatida boshlash →', 'Стать партнёром →')}</Link><Link href="/listings/new" className="rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-black text-white hover:bg-white/10">{tx('E’lon joylashtirish', 'Разместить объявление')}</Link></div></div>
          <div className="relative flex items-center justify-center"><div className="w-full max-w-[500px] rounded-[32px] border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur"><div className="rounded-[25px] bg-white p-6 sm:p-8"><div className="flex items-center justify-between border-b border-slate-100 pb-5"><div><div className="text-xs font-bold text-slate-400">ROYALHOUSE</div><div className="mt-1 text-xl font-black">{tx('Hamkor kabineti', 'Кабинет партнёра')}</div></div><div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">PRO</div></div><div className="grid gap-3 pt-5 sm:grid-cols-2">{['E’lonlarim', 'Murojaatlar', 'Profil', 'Xizmatlar'].map((item, index) => { const ru = ['Мои объявления', 'Обращения', 'Профиль', 'Услуги'][index]; return <div key={item} className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-bold text-slate-400">0{index + 1}</div><div className="mt-3 font-black">{lang === 'ru' ? ru : item}</div><div className="mt-1 text-xs text-slate-500">{tx('Boshqarish', 'Управление')}</div></div> })}</div></div></div></div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 py-16 lg:px-8 lg:py-20">
        <div className="text-center"><div className="text-sm font-black uppercase tracking-[.18em] text-emerald-600">{tx('Kimlar uchun?', 'Для кого?')}</div><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{tx('Faoliyatingizga mos hamkorlik', 'Партнёрство под вашу деятельность')}</h2><p className="mx-auto mt-4 max-w-2xl text-slate-500">{tx('Royalhouse’da turli professional hamkorlar uchun alohida ish ssenariylari mavjud.', 'На Royalhouse предусмотрены отдельные сценарии работы для разных профессиональных партнёров.')}</p></div>
        <div className="mt-10 flex flex-wrap justify-center gap-2">{groups.map((group) => <button key={group.id} type="button" onClick={() => setActive(group.id)} className={`rounded-full px-5 py-3 text-sm font-black transition ${active === group.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{text(group.label)}</button>)}</div>
        <div className="mt-8 grid overflow-hidden rounded-[28px] bg-white ring-1 ring-slate-200 lg:grid-cols-[.9fr_1.1fr]"><div className="bg-emerald-600 p-8 text-white sm:p-10"><div className="text-sm font-bold text-emerald-100">{tx('Royalhouse hamkori', 'Партнёр Royalhouse')}</div><h3 className="mt-3 text-3xl font-black leading-tight">{text(current.title)}</h3><p className="mt-5 leading-7 text-emerald-50">{text(current.description)}</p></div><div className="p-8 sm:p-10"><h4 className="text-xl font-black">{tx('Siz nimalardan foydalanishingiz mumkin?', 'Что вы получаете?')}</h4><div className="mt-6 grid gap-4 sm:grid-cols-2">{current.bullets.map((bullet) => <div key={bullet.uz} className="flex gap-3 rounded-2xl bg-slate-50 p-4"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">✓</span><span className="text-sm font-bold leading-6 text-slate-700">{text(bullet)}</span></div>)}</div></div></div>
      </section>

      <section className="bg-white py-16 lg:py-20"><div className="mx-auto max-w-[1280px] px-5 lg:px-8"><div className="text-center"><h2 className="text-3xl font-black tracking-tight sm:text-4xl">{tx('Qanday boshlanadi?', 'Как начать?')}</h2><p className="mt-3 text-slate-500">{tx('Hamkorlik jarayoni oddiy va tushunarli.', 'Процесс партнёрства простой и понятный.')}</p></div><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{steps.map(([number, title, stepText]) => <div key={number} className="rounded-3xl border border-slate-200 p-6"><div className="text-4xl font-black text-emerald-500">{number}</div><h3 className="mt-5 text-lg font-black">{text(title)}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text(stepText)}</p></div>)}</div></div></section>

      <section className="mx-auto max-w-[1000px] px-5 py-16 text-center lg:py-20"><div className="rounded-[32px] bg-[#07232d] px-6 py-12 text-white sm:px-12"><h2 className="text-3xl font-black sm:text-4xl">{tx('Royalhouse’da hamkor bo‘ling', 'Станьте партнёром Royalhouse')}</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-300">{tx('Faoliyatingizga mos profil yarating va o‘z e’lon yoki xizmatlaringizni platformada boshqarishni boshlang.', 'Создайте профиль под свою деятельность и начните управлять объявлениями или услугами на платформе.')}</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/register?type=partner" className="rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-black hover:bg-emerald-400">{tx('Hamkor sifatida ro‘yxatdan o‘tish', 'Зарегистрироваться как партнёр')}</Link><Link href="/" className="rounded-xl border border-white/15 px-6 py-3.5 text-sm font-black">{tx('Bosh sahifaga qaytish', 'Вернуться на главную')}</Link></div></div></section>

      <footer className="bg-[#07232d] text-white"><div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div><div className="text-xl font-black">Royal<span className="text-emerald-400">house</span></div><p className="mt-2 text-xs text-slate-400">© 2026 Royalhouse. {tx('Barcha huquqlar himoyalangan.', 'Все права защищены.')}</p></div><div className="flex gap-5 text-sm font-bold text-slate-300"><Link href="/listings">{tx('E’lonlar', 'Объявления')}</Link><Link href="/account">{tx('Shaxsiy kabinet', 'Личный кабинет')}</Link></div></div></footer>
    </main>
  )
}
