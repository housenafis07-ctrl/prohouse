'use client'

import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

const plans = [
  { code: 'realtor_free', name: 'FREE', price: 0, limit: 20, features: { uz: ['20 ta faol e’lon','Professional rieltor profili','Mijozlardan murojaat qabul qilish','Asosiy statistika'], ru: ['20 активных объявлений','Профессиональный профиль риелтора','Приём обращений клиентов','Базовая статистика'] } },
  { code: 'realtor_pro', name: 'PRO', price: 299900, limit: 100, popular: true, features: { uz: ['100 ta faol e’lon','Oyiga 20 ta TOP va 30 ta UP','Tasdiqlangan rieltor belgisi','CRM va kengaytirilgan statistika','Qidiruvda ustuvor ko‘rinish'], ru: ['100 активных объявлений','20 TOP и 30 UP в месяц','Значок проверенного риелтора','CRM и расширенная статистика','Приоритетное отображение в поиске'] } },
  { code: 'realtor_business', name: 'BUSINESS', price: 599900, limit: 300, features: { uz: ['300 ta faol e’lon','10 tagacha jamoa a’zosi / agent','CRM va murojaatlarni taqsimlash','Kengaytirilgan statistika','Alohida agentlik profili'], ru: ['300 активных объявлений','До 10 участников команды / агентов','CRM и распределение обращений','Расширенная аналитика','Отдельный профиль агентства'] } },
]

export default function RealtorTariffsPage() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const money = (n: number) => n === 0 ? (ru ? 'Бесплатно' : 'Bepul') : new Intl.NumberFormat(ru ? 'ru-RU' : 'uz-UZ').format(n) + (ru ? ' сум/мес.' : ' so‘m/oy')
  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between"><Link href="/realtors" className="text-sm font-bold text-emerald-700">← {ru ? 'Риелторы' : 'Rieltorlar'}</Link><Link href="/realtors/cabinet" className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">{ru ? 'Кабинет риелтора' : 'Rieltor kabineti'}</Link></div>
      <div className="mx-auto mt-10 max-w-3xl text-center"><p className="text-xs font-black tracking-[.2em] text-emerald-600">ROYALHOUSE PROFESSIONAL</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">{ru ? 'Тарифы для риелторов' : 'Rieltorlar uchun tariflar'}</h1><p className="mt-4 text-slate-500">{ru ? 'Выберите подходящий объём объявлений и профессиональных инструментов.' : 'E’lonlar soni va professional vositalar hajmiga mos tarifni tanlang.'}</p></div>
      <div className="mt-10 grid items-stretch gap-5 lg:grid-cols-3">{plans.map(plan => <article key={plan.code} className={`relative flex flex-col rounded-3xl border bg-white p-7 shadow-sm ${plan.popular ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'}`}>{plan.popular && <span className="absolute right-5 top-5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white">{ru ? 'ПОПУЛЯРНЫЙ' : 'OMMABOP'}</span>}<p className="text-sm font-black tracking-widest text-slate-400">{plan.name}</p><p className="mt-4 text-3xl font-black">{money(plan.price)}</p><p className="mt-2 text-sm text-slate-500">{plan.limit} {ru ? 'активных объявлений' : 'ta faol e’lon'}</p><ul className="mt-7 flex-1 space-y-3">{plan.features[ru ? 'ru' : 'uz'].map(feature => <li key={feature} className="flex gap-2 text-sm"><span className="font-black text-emerald-600">✓</span><span>{feature}</span></li>)}</ul>{plan.price === 0 ? <Link href="/realtors/cabinet" className="mt-8 rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-black">{ru ? 'Начать бесплатно' : 'Bepul boshlash'}</Link> : <Link href={`/account/monetization/checkout?product=${plan.code}`} className="mt-8 rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-black text-white hover:bg-emerald-700">{ru ? 'Выбрать тариф' : 'Tarifni tanlash'}</Link>}</article>)}</div>
      <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-slate-500">{ru ? 'Пакеты TOP/UP и инструменты CRM, распределения лидов и команды отображаются как состав тарифа. Перед включением платного тарифа соответствующие функции и права должны быть активированы в системе.' : 'TOP/UP paketlari hamda CRM, murojaatlarni taqsimlash va jamoa vositalari tarif tarkibida ko‘rsatilgan. Pullik tarifni ishga tushirishdan oldin tegishli funksiyalar va huquqlar tizimda faollashtirilishi kerak.'}</p>
    </div>
  </main>
}
