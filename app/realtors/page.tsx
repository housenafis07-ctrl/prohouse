'use client'

import { useMemo, useState } from 'react'

const agents = [
  { name: 'Madina Karimova', agency: 'Prohouse Realty', rating: 5.0, reviews: 48, deals: 37, listings: 19, experience: '8 yil', specialty: 'Kvartira va yangi uylar', verified: true },
  { name: 'Azizbek Rahmonov', agency: 'Toshkent Home', rating: 4.9, reviews: 31, deals: 29, listings: 24, experience: '6 yil', specialty: 'Uylar va yer uchastkalari', verified: true },
  { name: 'Dilnoza Ismoilova', agency: 'Real Estate Pro', rating: 4.8, reviews: 26, deals: 22, listings: 15, experience: '5 yil', specialty: 'Ijara va tijorat ko‘chmas mulki', verified: true },
]

const advice = {
  choice: {
    title: 'Rieltorni qanday tanlash kerak?',
    intro: 'Yaxshi rieltor sizga obyekt topishdan tashqari hujjatlarni tekshirish, muzokara va bitim jarayonini xavfsiz tashkil qilishda yordam beradi.',
    items: [
      { title: 'Reyting va sharhlar', body: 'Mijozlarning real tajribasini ko‘ring. Ko‘p va sifatli sharhlar mutaxassisning tajribasi va xizmat darajasi haqida yaxshi signal beradi.', image: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80' },
      { title: 'Profil', body: 'Tasdiqlangan profil, professional fotosurat, ish tajribasi va mutaxassislik yo‘nalishi ko‘rsatilgan rieltorni tanlang.', image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=900&q=80' },
      { title: 'E’lonlar', body: 'Rieltorning faol e’lonlarini ko‘ring. E’lonlar soni, sifati va yangilanib turishi uning bozordagi faolligini baholashga yordam beradi.', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=80' },
      { title: 'Bitimlar tajribasi', body: 'So‘nggi davrdagi bitimlar soni va aynan siz izlayotgan ko‘chmas mulk turidagi tajribasiga e’tibor bering.', image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=900&q=80' },
      { title: 'Muloqot va shaffoflik', body: 'Komissiya, xizmat doirasi, hujjatlar va bitim bosqichlarini oldindan aniq kelishib oling. Muhim kelishuvlarni yozma ravishda tasdiqlash ma’qul.', image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80' },
    ],
  },
  agent: {
    title: 'Muvaffaqiyatli rieltor bo‘lish uchun nimalarga e’tibor berish kerak?',
    intro: 'Prohouse’da rieltorning ko‘rinishi va ishonchliligini oshirish uchun profil, sharhlar, bitimlar va faol e’lonlar muhim.',
    items: [
      { title: 'Profilni to‘ldiring', body: 'Fotosurat, o‘zingiz haqingizdagi ma’lumot, tajriba va mutaxassislik yo‘nalishlarini to‘liq ko‘rsating. Mijoz sizni birinchi qarashdayoq tushunishi kerak.', image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80' },
      { title: 'Tasdiqlangan profil', body: 'Shaxs va professional ma’lumotlar tasdiqlangan bo‘lsa, mijoz uchun ishonch darajasi yuqoriroq bo‘ladi.', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80' },
      { title: 'Sharhlar', body: 'Har bir muvaffaqiyatli bitimdan keyin mijoz fikrini olishga harakat qiling va sharhlarga professional javob bering.', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80' },
      { title: 'Bitimlar', body: 'So‘nggi 12 oydagi faol bitimlar tajriba va bozorni yaxshi bilishingizni ko‘rsatadi. Mijozga aynan qaysi yo‘nalishda kuchli ekaningizni ko‘rsating.', image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80' },
      { title: 'Faol e’lonlar', body: 'Dolzarb, sifatli va muntazam yangilanadigan e’lonlar mijozga sizning faolligingiz va professional yondashuvingizni ko‘rsatadi.', image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=900&q=80' },
    ],
  },
} as const

type AdviceKey = keyof typeof advice

const ruAdvice = {
  choice: {
    title: 'Как выбрать риелтора?',
    intro: 'Хороший риелтор помогает не только найти объект, но и проверить документы, провести переговоры и безопасно организовать сделку.',
    items: [
      ['Рейтинг и отзывы', 'Изучите реальный опыт клиентов. Большое количество качественных отзывов — хороший сигнал об опыте специалиста.'],
      ['Профиль', 'Выбирайте риелтора с подтверждённым профилем, фотографией, опытом работы и понятной специализацией.'],
      ['Объявления', 'Посмотрите активные объявления риелтора. Их количество и качество помогают оценить активность специалиста на рынке.'],
      ['Опыт сделок', 'Обратите внимание на количество недавних сделок и опыт именно с тем типом недвижимости, который вы ищете.'],
      ['Общение и прозрачность', 'Заранее согласуйте комиссию, объём услуг, документы и этапы сделки. Важные договорённости лучше фиксировать письменно.'],
    ],
  },
  agent: {
    title: 'Что важно знать риелтору?',
    intro: 'На Prohouse профиль, отзывы, сделки и активные объявления помогают риелтору выглядеть профессионально и вызывать доверие клиентов.',
    items: [
      ['Заполните профиль', 'Добавьте фотографию, информацию о себе, опыт и направления специализации. Клиент должен сразу понимать, с кем он работает.'],
      ['Подтверждённый профиль', 'Подтверждённые личные и профессиональные данные повышают уровень доверия со стороны клиента.'],
      ['Отзывы', 'После успешной сделки просите клиента оставить отзыв и профессионально отвечайте на полученные отзывы.'],
      ['Сделки', 'Активные сделки за последние 12 месяцев показывают опыт и знание рынка. Подчеркните направления, в которых вы сильнее всего.'],
      ['Активные объявления', 'Актуальные, качественные и регулярно обновляемые объявления показывают клиенту вашу активность и профессиональный подход.'],
    ],
  },
} as const

export default function RealtorsPage() {
  const [lang, setLang] = useState<'uz' | 'ru'>('uz')
  const [adviceKey, setAdviceKey] = useState<AdviceKey | null>(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')

  const visibleAgents = useMemo(() => agents.filter(a => !search || `${a.name} ${a.agency}`.toLowerCase().includes(search.toLowerCase())), [search])
  const ru = lang === 'ru'
  const currentAdvice = adviceKey ? advice[adviceKey] : null

  return (
    <main className="min-h-screen bg-[#f1f3f5] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[78px] max-w-[1440px] items-center gap-8 px-6">
          <a href="/" className="flex items-center text-2xl font-black">Pro<span className="text-emerald-500">house</span></a>
          <nav className="hidden flex-1 items-center gap-7 text-sm font-semibold lg:flex">
            <a href="/listings?tab=sale">{ru ? 'Покупка' : 'Sotuv'}</a>
            <a href="/listings?tab=rent">{ru ? 'Аренда' : 'Ijara'}</a>
            <a href="/listings?tab=sale&type=new_building">{ru ? 'Новостройки' : 'Yangi uylar'}</a>
            <a href="/listings">{ru ? 'Услуги' : 'Xizmatlar'}</a>
            <a className="font-black text-emerald-600" href="/realtors">{ru ? 'Риелторы' : 'Rieltorlar'}</a>
          </nav>
          <button onClick={() => setLang(ru ? 'uz' : 'ru')} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold">{ru ? 'Ru / O‘z' : 'O‘z / Ru'}</button>
          <a href="/account" className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white">{ru ? 'Личный кабинет' : 'Shaxsiy kabinet'}</a>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto grid max-w-[1320px] gap-2 md:grid-cols-[auto_1fr_1fr_1.5fr]">
          <div className="flex rounded-xl border border-slate-200 p-1 text-sm font-bold"><button className="rounded-lg bg-white px-4 py-2 text-emerald-700">{ru ? 'Риелторы' : 'Rieltorlar'}</button><button className="px-4 py-2 text-slate-400">{ru ? 'Агентства недвижимости' : 'Ko‘chmas mulk agentliklari'}</button></div>
          <select value={type} onChange={e => setType(e.target.value)} className="rounded-xl bg-slate-100 px-4 py-3 text-sm outline-none"><option value="">{ru ? 'Все типы сделок' : 'Barcha bitim turlari'}</option><option>{ru ? 'Покупка' : 'Sotib olish'}</option><option>{ru ? 'Аренда' : 'Ijara'}</option></select>
          <select className="rounded-xl bg-slate-100 px-4 py-3 text-sm outline-none"><option>{ru ? 'Все специализации' : 'Barcha mutaxassisliklar'}</option><option>{ru ? 'Квартиры' : 'Kvartiralar'}</option><option>{ru ? 'Дома' : 'Uylar'}</option><option>{ru ? 'Коммерция' : 'Tijorat'}</option></select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={ru ? 'ФИО риелтора' : 'Rieltor ismi'} className="rounded-xl bg-slate-100 px-4 py-3 text-sm outline-none" />
        </div>
      </div>

      <section className="mx-auto max-w-[840px] px-4 py-9 lg:max-w-[1320px]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black">{ru ? 'Поиск риелторов в Ташкенте' : 'Toshkentdagi rieltorlarni izlash'}</h1>
            <p className="mt-2 text-sm text-slate-500">{ru ? 'Выберите специалиста по рейтингу, отзывам и опыту' : 'Rieltorni reytingi, sharhlari va tajribasiga qarab tanlang'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <button onClick={() => setAdviceKey('choice')} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-emerald-300"><b>{ru ? 'Как выбрать риелтора' : 'Rieltorni qanday tanlash'}</b><span className="mt-1 block text-xs text-slate-500">{ru ? 'Полезные советы' : 'Foydali maslahatlar'}</span></button>
            <button onClick={() => setAdviceKey('agent')} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-emerald-300"><b>{ru ? 'Что нужно знать риелтору' : 'Rieltor nimalarni bilishi kerak'}</b><span className="mt-1 block text-xs text-slate-500">{ru ? 'О рейтинге и профиле' : 'Reyting va profil haqida'}</span></button>
            <div className="hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:block"><b>{ru ? 'Проверенные специалисты' : 'Tasdiqlangan mutaxassislar'}</b><span className="mt-1 block text-xs text-slate-500">{ru ? 'Безопаснее выбирать' : 'Tanlash osonroq'}</span></div>
          </div>
        </div>

        <div className="mt-7 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="grid grid-cols-[1.5fr_1.5fr_.5fr_.5fr_.8fr] border-b border-slate-200 px-6 py-4 text-sm font-semibold text-slate-500"><span>{ru ? 'Риелтор' : 'Rieltor'}</span><span>{ru ? 'Рейтинг' : 'Reyting'}</span><span>{ru ? 'Сделки' : 'Bitimlar'}</span><span>{ru ? 'Объявления' : 'E’lonlar'}</span><span>{ru ? 'Действия' : 'Harakatlar'}</span></div>
          {visibleAgents.map(agent => <div key={agent.name} className="grid grid-cols-[1.5fr_1.5fr_.5fr_.5fr_.8fr] items-center gap-3 border-b border-slate-200 px-6 py-6 last:border-0">
            <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-lg font-black text-emerald-700">{agent.name.split(' ').map(x => x[0]).join('')}</div><div><div className="flex items-center gap-2 font-black">{agent.name}{agent.verified && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">✓ {ru ? 'Проверен' : 'Tasdiqlangan'}</span>}</div><div className="text-xs text-slate-500">{agent.agency}</div><div className="mt-1 text-xs text-slate-400">{agent.experience} · {agent.specialty}</div></div></div>
            <div><div className="font-bold"><span className="text-amber-500">★</span> {agent.rating} <span className="ml-1 text-xs font-normal text-slate-400">{agent.reviews} {ru ? 'оценок' : 'ta baho'}</span></div><div className="mt-2 rounded-xl bg-slate-50 p-2 text-xs text-slate-600">{ru ? 'Клиенты отмечают профессионализм и сопровождение сделки.' : 'Mijozlar professionallik va bitimni kuzatib borishni yuqori baholashadi.'}</div></div>
            <b>{agent.deals}</b><b>{agent.listings}</b><div className="space-y-2"><button className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">{ru ? 'Показать телефон' : 'Telefonni ko‘rsatish'}</button><button className="w-full rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">{ru ? 'Написать в чат' : 'Chatga yozish'}</button></div>
          </div>)}
        </div>
      </section>

      {adviceKey && currentAdvice && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setAdviceKey(null) }}>
        <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
          <div className="relative overflow-hidden rounded-t-3xl bg-slate-950 px-7 py-8 text-white">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center opacity-30" />
            <div className="relative flex items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-400">Prohouse maslahatlari</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{ru ? ruAdvice[adviceKey].title : currentAdvice.title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">{ru ? ruAdvice[adviceKey].intro : currentAdvice.intro}</p></div>
              <button onClick={() => setAdviceKey(null)} className="shrink-0 rounded-full bg-white/15 px-3 py-2 font-bold text-white backdrop-blur hover:bg-white/25">×</button>
            </div>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            {currentAdvice.items.map((item, index) => {
              const translated = ru ? ruAdvice[adviceKey].items[index] : null
              return <article key={item.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <img src={item.image} alt="" className="h-40 w-full object-cover" />
                <div className="p-5"><div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">{index + 1}</span><h3 className="font-black">{translated?.[0] ?? item.title}</h3></div><p className="text-sm leading-6 text-slate-600">{translated?.[1] ?? item.body}</p></div>
              </article>
            })}
          </div>
          <div className="flex justify-end border-t border-slate-200 px-6 py-5"><button onClick={() => setAdviceKey(null)} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white hover:bg-emerald-700">{ru ? 'Закрыть' : 'Yopish'}</button></div>
        </div>
      </div>}
    </main>
  )
}
