'use client'
import Link from 'next/link'
import { getMortgagePrograms } from '@/lib/mortgage-programs'
import { useI18n } from '@/app/components/I18nProvider'

export default function IpotekaPage() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const secondary = getMortgagePrograms('secondary')
  const primary = getMortgagePrograms('primary')
  const t = ru ? {
    title: 'Ипотечные кредиты',
    subtitle: 'Смотрите актуальные банковские программы, сравнивайте условия и рассчитывайте подходящий объект с ипотечным калькулятором.',
    secondary: 'Ипотека на вторичном рынке',
    primary: 'Ипотека на новостройку',
    view: 'Подробнее',
    secondaryDesc: 'готовое жильё · карта объектов, подходящих под ипотеку',
    primaryDesc: 'новостройки · карта объектов, подходящих под ипотеку',
    toolsTitle: '6 функций для удобного выбора жилья',
    toolsSub: 'Сначала рассчитайте возможности, затем найдите, сохраните, отслеживайте и сравните подходящее жильё.',
    cards: [
      ['Сколько жилья вы можете купить?', 'Рассчитайте ориентировочный бюджет жилья на основе дохода и первоначального взноса.', 'Рассчитать'],
      ['Мои ипотечные возможности', 'Посмотрите банки, ставки, первоначальный взнос и ориентировочный платёж.', 'Проверить'],
      ['Подходящее мне жильё', 'Найдите подходящие для ипотеки объекты на карте и в списке.', 'Смотреть жильё'],
      ['Сохранённые объекты', 'Сохраняйте понравившиеся объекты вместе с их ценой и статусом.', 'Мои объекты'],
      ['Уведомления о цене и новых объектах', 'Включите уведомления по сохранённым поискам и объектам.', 'Настроить'],
      ['Сравнение объектов', 'Сравните до 3 объектов по цене, площади и ипотеке.', 'Сравнить'],
    ],
  } : {
    title: 'Ipoteka kreditlari',
    subtitle: 'Amaldagi bank dasturlarini ko‘ring, shartlarini solishtiring va mos obyektni ipoteka kalkulyatori bilan hisoblang.',
    secondary: 'Ipoteka ikkilamchi bozorda',
    primary: 'Ipoteka yangi qurilishga',
    view: 'Ko‘rish',
    secondaryDesc: 'tayyor uy-joylar · ipotekaga mos obyektlar xaritasi',
    primaryDesc: 'yangi qurilish · ipotekaga mos obyektlar xaritasi',
    toolsTitle: 'Uy tanlashni osonlashtiradigan 6 ta funksiya',
    toolsSub: 'Avval imkoniyatingizni hisoblang, keyin mos uylarni toping, saqlang, kuzating va solishtiring.',
    cards: [
      ['1. Siz qancha uy olishingiz mumkin?', 'Daromad va badal asosida taxminiy uy budjetini hisoblang.', 'Hisoblash'],
      ['2. Ipoteka imkoniyatim', 'Banklar, stavkalar, badal va taxminiy to‘lovlarni ko‘ring.', 'Tekshirish'],
      ['3. Menga mos uylar', 'Ipotekaga mumkin bo‘lgan obyektlarni xaritada va ro‘yxatda toping.', 'Uylarni ko‘rish'],
      ['4. Saqlangan uylar', 'Yoqtirgan uylaringizni narxi va holati bilan saqlang.', 'Mening uylarim'],
      ['5. Narx va yangi uy xabarnomasi', 'Saqlangan qidiruv va uylar bo‘yicha xabarlarni yoqing.', 'Sozlash'],
      ['6. Uylarni solishtirish', '3 tagacha uyni narx, maydon va ipoteka bo‘yicha taqqoslang.', 'Solishtirish'],
    ],
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Royalhouse — bosh sahifa">
            <img src="/royalhouse-icon.svg" alt="Royalhouse" className="h-10 w-10 rounded-xl object-cover" />
            <span className="text-2xl font-black tracking-tight text-slate-900">
              Royal<span className="text-emerald-500">house</span>
            </span>
          </Link>
        </div>
      </header>

      <section className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
          <p className="text-sm font-black uppercase tracking-[.2em] text-emerald-100">ROYALHOUSE</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{t.title}</h1>
          <p className="mt-4 max-w-2xl text-base text-emerald-50 sm:text-lg">{t.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/ipoteka/vtorichnyy-rynok" className="rounded-2xl bg-white px-5 py-3 font-black text-emerald-700">{t.secondary}</Link>
            <Link href="/ipoteka/novostroyka" className="rounded-2xl border border-white/40 px-5 py-3 font-black text-white">{t.primary}</Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-5 md:grid-cols-2">
          <Link href="/ipoteka/vtorichnyy-rynok" className="group rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg">
            <div className="text-3xl">🏠</div>
            <h2 className="mt-5 text-2xl font-black">{t.secondary}</h2>
            <p className="mt-2 text-slate-500">{secondary.length} {ru ? "банковские программы · " : "ta bank dasturi · "}{t.secondaryDesc}</p>
            <span className="mt-6 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white">{t.view}</span>
          </Link>

          <Link href="/ipoteka/novostroyka" className="group rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg">
            <div className="text-3xl">🏗️</div>
            <h2 className="mt-5 text-2xl font-black">{t.primary}</h2>
            <p className="mt-2 text-slate-500">{primary.length} {ru ? "банковские программы · " : "ta bank dasturi · "}{t.primaryDesc}</p>
            <span className="mt-6 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white">{t.view}</span>
          </Link>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">ROYALHOUSE SMART HOME TOOLS</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">{t.toolsTitle}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{t.toolsSub}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/ipoteka/uy-qancha" className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-2xl">💰</span><h3 className="mt-3 font-black">{t.cards[0][0]}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-300">{t.cards[0][1]}</p>
            <span className="mt-3 inline-flex text-sm font-black text-emerald-300">{t.cards[0][2]} →</span>
          </Link>

          <Link href="/ipoteka/imkoniyatlari" className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-2xl">💳</span><h3 className="mt-3 font-black">{t.cards[1][0]}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{t.cards[1][1]}</p>
            <span className="mt-3 inline-flex text-sm font-black text-emerald-700">{t.cards[1][2]} →</span>
          </Link>

          <Link href="/listings?tab=sale&mortgage=true" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-2xl">🗺️</span><h3 className="mt-3 font-black">{t.cards[2][0]}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{t.cards[2][1]}</p>
            <span className="mt-3 inline-flex text-sm font-black text-emerald-700">{t.cards[2][2]} →</span>
          </Link>

          <Link href="/account/favorites" className="rounded-2xl border border-rose-100 bg-rose-50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-2xl">❤️</span><h3 className="mt-3 font-black">{t.cards[3][0]}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{t.cards[3][1]}</p>
            <span className="mt-3 inline-flex text-sm font-black text-rose-700">{t.cards[3][2]} →</span>
          </Link>

          <Link href="/account/saved-searches" className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-2xl">🔔</span><h3 className="mt-3 font-black">{t.cards[4][0]}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{t.cards[4][1]}</p>
            <span className="mt-3 inline-flex text-sm font-black text-amber-700">{t.cards[4][2]} →</span>
          </Link>

          <Link href="/solishtirish" className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-2xl">⚖️</span><h3 className="mt-3 font-black">{t.cards[5][0]}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{t.cards[5][1]}</p>
            <span className="mt-3 inline-flex text-sm font-black text-slate-700">{t.cards[5][2]} →</span>
          </Link>
        </div>
      </section>
    </main>
  )
}
