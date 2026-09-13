'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Lang = 'uz' | 'ru'
type PaymentType = 'annuity' | 'differentiated'

const nf = new Intl.NumberFormat('ru-RU')
const money = (value: number) => `${nf.format(Math.max(0, Math.round(value)))} so‘m`
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function monthlyPayment(principal: number, annualRate: number, months: number, type: PaymentType) {
  if (principal <= 0 || months <= 0) return 0
  const r = annualRate / 100 / 12
  if (type === 'differentiated') {
    return principal / months + principal * r
  }
  if (r === 0) return principal / months
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

function totalPayments(principal: number, annualRate: number, months: number, type: PaymentType) {
  if (principal <= 0 || months <= 0) return 0
  if (type === 'annuity') return monthlyPayment(principal, annualRate, months, type) * months
  const r = annualRate / 100 / 12
  let total = 0
  for (let i = 0; i < months; i++) total += principal / months + Math.max(0, principal - principal * i / months) * r
  return total
}

function formatInput(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? nf.format(Number(digits)).replace(/,/g, ' ') : ''
}

export default function MortgageCalculatorPage() {
  const [lang, setLang] = useState<Lang>('uz')
  const [propertyPrice, setPropertyPrice] = useState('1 000 000 000')
  const [downPayment, setDownPayment] = useState('200 000 000')
  const [rate, setRate] = useState('24')
  const [years, setYears] = useState('15')
  const [paymentType, setPaymentType] = useState<PaymentType>('annuity')
  const [income, setIncome] = useState('')

  useEffect(() => {
    const saved = window.localStorage.getItem('prohouse-lang')
    if (saved === 'ru') setLang('ru')
    const onChange = () => setLang(window.localStorage.getItem('prohouse-lang') === 'ru' ? 'ru' : 'uz')
    window.addEventListener('prohouse-language-change', onChange)
    return () => window.removeEventListener('prohouse-language-change', onChange)
  }, [])

  const t = lang === 'ru' ? {
    back: 'Prohouse',
    eyebrow: 'Ипотека в Узбекистане',
    title: 'Ипотечный калькулятор',
    subtitle: 'Рассчитайте ориентировочный ежемесячный платёж, переплату и общую сумму кредита в сумах.',
    property: 'Стоимость недвижимости',
    down: 'Первоначальный взнос',
    rate: 'Процентная ставка в год',
    term: 'Срок кредита',
    years: 'лет',
    payment: 'Тип платежа',
    annuity: 'Аннуитетный',
    differentiated: 'Дифференцированный',
    income: 'Ваш доход в месяц (необязательно)',
    incomeHint: 'Поможет ориентировочно оценить нагрузку на бюджет.',
    result: 'Результат расчёта',
    loan: 'Сумма кредита',
    monthly: 'Ежемесячный платёж',
    total: 'Всего выплат',
    overpay: 'Переплата по процентам',
    ratio: 'Первоначальный взнос',
    disclaimer: 'Расчёт является предварительным. Реальная ставка, комиссия, требования к доходу и условия кредита определяются банком после рассмотрения заявки.',
    faqTitle: 'Часто задаваемые вопросы об ипотеке',
    faqSub: 'Полезная информация для покупателей жилья в Узбекистане.',
    clear: 'Сбросить',
    calc: 'Расчёт обновляется автоматически',
    subsidy: 'Государственная субсидия',
    subsidyText: 'Для отдельных категорий граждан действуют программы государственной поддержки. Условия и доступность нужно проверять перед подачей заявки.',
    sources: 'Официальные источники',
    mygov: 'Подать заявление на ипотечную субсидию',
  } : {
    back: 'Prohouse',
    eyebrow: 'O‘zbekistonda ipoteka',
    title: 'Ipoteka kalkulyatori',
    subtitle: 'Uy-joy narxi, boshlang‘ich badal, foiz va muddatni kiriting — oylik to‘lov va ortiqcha to‘lovni darhol hisoblang.',
    property: 'Ko‘chmas mulk narxi',
    down: 'Boshlang‘ich badal',
    rate: 'Yillik foiz stavkasi',
    term: 'Kredit muddati',
    years: 'yil',
    payment: 'To‘lov turi',
    annuity: 'Annuitet',
    differentiated: 'Differensial',
    income: 'Oylik daromadingiz (ixtiyoriy)',
    incomeHint: 'Byudjetga tushadigan taxminiy yuklamani baholashga yordam beradi.',
    result: 'Hisob-kitob natijasi',
    loan: 'Kredit summasi',
    monthly: 'Oylik to‘lov',
    total: 'Jami to‘lov',
    overpay: 'Foizlar bo‘yicha ortiqcha to‘lov',
    ratio: 'Boshlang‘ich badal',
    disclaimer: 'Hisob-kitob taxminiy. Amaldagi stavka, komissiya, daromad talablari va kredit shartlarini arizani ko‘rib chiqqandan so‘ng bank belgilaydi.',
    faqTitle: 'Ipoteka bo‘yicha ko‘p beriladigan savollar',
    faqSub: 'O‘zbekistonda uy-joy xarid qiluvchilar uchun foydali ma’lumotlar.',
    clear: 'Tozalash',
    calc: 'Hisob-kitob avtomatik yangilanadi',
    subsidy: 'Davlat subsidiyasi',
    subsidyText: 'Ayrim fuqarolar uchun davlat tomonidan ipoteka bo‘yicha qo‘llab-quvvatlash dasturlari mavjud. Ariza berishdan oldin amaldagi talablarni tekshiring.',
    sources: 'Rasmiy manbalar',
    mygov: 'Ipoteka subsidiyasiga ariza berish',
  }

  const price = Number(propertyPrice.replace(/\D/g, '')) || 0
  const down = clamp(Number(downPayment.replace(/\D/g, '')) || 0, 0, price)
  const annualRate = clamp(Number(rate.replace(',', '.')) || 0, 0, 100)
  const termYears = clamp(Number(years.replace(/\D/g, '')) || 1, 1, 30)
  const months = termYears * 12
  const principal = Math.max(0, price - down)
  const firstMonthly = monthlyPayment(principal, annualRate, months, paymentType)
  const total = totalPayments(principal, annualRate, months, paymentType)
  const overpayment = Math.max(0, total - principal)
  const downPercent = price > 0 ? down / price * 100 : 0
  const incomeValue = Number(income.replace(/\D/g, '')) || 0
  const incomeLoad = incomeValue > 0 ? firstMonthly / incomeValue * 100 : 0

  const faq = useMemo(() => lang === 'ru' ? [
    ['Что такое ипотечный калькулятор?', 'Это инструмент для предварительной оценки кредита: он показывает сумму займа, ориентировочный ежемесячный платёж, общую сумму выплат и переплату по процентам.'],
    ['Какие данные нужны для расчёта ипотеки?', 'Обычно достаточно стоимости недвижимости, первоначального взноса, процентной ставки и срока кредита. При необходимости можно дополнительно учитывать тип платежа и доход.'],
    ['Что такое первоначальный взнос?', 'Это часть стоимости недвижимости, которую покупатель оплачивает собственными средствами до выдачи ипотечного кредита. Чем больше взнос, тем меньше сумма кредита и, как правило, переплата.'],
    ['Чем отличается аннуитетный платёж от дифференцированного?', 'При аннуитетной схеме платёж обычно одинаковый каждый месяц. При дифференцированной схеме основная сумма долга гасится равными частями, поэтому первые платежи выше, а затем уменьшаются.'],
    ['Можно ли доверять результату калькулятора?', 'Результат является ориентировочным. Банк может изменить ставку, срок, сумму, комиссии и требования к заёмщику после проверки документов и кредитоспособности.'],
    ['Какой доход нужен для ипотеки?', 'Это зависит от банка, программы, суммы кредита и других обязательств заёмщика. В калькуляторе можно указать доход и увидеть отношение ориентировочного платежа к доходу, но это не является решением банка.'],
    ['Есть ли государственная субсидия на ипотеку в Узбекистане?', 'Да, действуют государственные программы субсидирования для определённых категорий граждан. Актуальные условия и возможность подачи заявления следует проверять на Едином портале интерактивных государственных услуг.'],
    ['Можно ли купить жильё в новостройке и на вторичном рынке?', 'Да, ипотечные программы могут различаться по типу объекта. Условия первичного и вторичного рынка нужно сравнивать отдельно по конкретному банку и программе.'],
    ['Можно ли досрочно погасить ипотеку?', 'Возможность и порядок досрочного погашения зависят от условий кредитного договора и банка. Перед оформлением кредита стоит проверить соответствующий раздел договора.'],
    ['Почему фактический платёж может отличаться?', 'На итоговую стоимость могут влиять комиссии, страхование, дополнительные услуги, изменение условий программы и другие платежи, которые не включены в базовый расчёт.'],
  ] : [
    ['Ipoteka kalkulyatori nima?', 'Bu kreditni oldindan baholash vositasi bo‘lib, kredit summasi, taxminiy oylik to‘lov, jami to‘lov va foizlar bo‘yicha ortiqcha to‘lovni hisoblashga yordam beradi.'],
    ['Ipotekani hisoblash uchun nimalar kerak?', 'Odatda uy-joy narxi, boshlang‘ich badal, yillik foiz stavkasi va kredit muddati yetarli. Qo‘shimcha ravishda to‘lov turi va daromadni ham kiritish mumkin.'],
    ['Boshlang‘ich badal nima?', 'Bu uy-joy qiymatining xaridor o‘z mablag‘i hisobidan to‘laydigan qismi. Badal qancha katta bo‘lsa, kredit summasi va odatda foizlar bo‘yicha ortiqcha to‘lov shuncha kam bo‘ladi.'],
    ['Annuitet va differensial to‘lovning farqi nima?', 'Annuitetda oylik to‘lov odatda bir xil bo‘ladi. Differensial usulda asosiy qarz teng qismlarda qaytariladi, shu sababli dastlabki to‘lovlar yuqoriroq bo‘lib, keyinchalik kamayadi.'],
    ['Kalkulyator natijasiga ishonish mumkinmi?', 'Natija taxminiy hisob-kitobdir. Bank hujjatlar va qarz oluvchining to‘lov qobiliyatini tekshirgach stavka, muddat, kredit summasi, komissiyalar va boshqa talablarni belgilashi mumkin.'],
    ['Ipoteka olish uchun qancha daromad kerak?', 'Bu bank, dastur, kredit summasi va qarz oluvchining boshqa majburiyatlariga bog‘liq. Daromadni kiritsangiz, taxminiy to‘lovning daromadga nisbatini ko‘rishingiz mumkin, lekin bu bank qarori hisoblanmaydi.'],
    ['O‘zbekistonda ipoteka uchun davlat subsidiyasi bormi?', 'Ha, ayrim toifadagi fuqarolar uchun davlat tomonidan subsidiya dasturlari mavjud. Amaldagi talablar va ariza topshirish imkoniyatini Yagona interaktiv davlat xizmatlari portalidan tekshirish kerak.'],
    ['Yangi qurilish va ikkilamchi bozordan uy olish mumkinmi?', 'Ha, ipoteka dasturlari ko‘chmas mulk turiga qarab farq qilishi mumkin. Birlamchi va ikkilamchi bozor shartlarini konkret bank va dastur bo‘yicha alohida solishtirish kerak.'],
    ['Ipotekani muddatidan oldin yopish mumkinmi?', 'Muddatidan oldin to‘lash imkoniyati va tartibi kredit shartnomasi hamda bank qoidalariga bog‘liq. Kredit olishdan oldin shartnomaning ushbu qismini tekshirish kerak.'],
    ['Nega haqiqiy to‘lov kalkulyatordagi summadan farq qilishi mumkin?', 'Komissiya, sug‘urta, qo‘shimcha xizmatlar, dastur shartlaridagi o‘zgarishlar va bazaviy hisobga kiritilmagan boshqa to‘lovlar yakuniy qiymatga ta’sir qilishi mumkin.'],
  ], [lang])

  const setNumber = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => setter(formatInput(e.target.value))

  return <main className="min-h-screen bg-[#f6f7f8] text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-xl font-black">Pro<span className="text-emerald-500">house</span></Link>
        <Link href="/" className="text-sm font-bold text-slate-500 hover:text-emerald-600">← {t.back}</Link>
      </div>
    </header>

    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-600">{t.eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">{t.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">{t.subtitle}</p>
      </div>
    </section>

    <section className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[1.08fr_.92fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="mb-2 block text-sm font-extrabold">{t.property}</span><div className="relative"><input inputMode="numeric" value={propertyPrice} onChange={setNumber(setPropertyPrice)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-16 text-lg font-black outline-none focus:border-emerald-500 focus:bg-white"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">so‘m</span></div></label>
            <label><span className="mb-2 block text-sm font-extrabold">{t.down}</span><div className="relative"><input inputMode="numeric" value={downPayment} onChange={setNumber(setDownPayment)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-16 font-black outline-none focus:border-emerald-500 focus:bg-white"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">so‘m</span></div><div className="mt-2 text-xs font-bold text-slate-400">{downPercent.toFixed(1)}%</div></label>
            <label><span className="mb-2 block text-sm font-extrabold">{t.rate}</span><div className="relative"><input inputMode="decimal" value={rate} onChange={e=>setRate(e.target.value.replace(/[^0-9.,]/g,''))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-12 font-black outline-none focus:border-emerald-500 focus:bg-white"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span></div></label>
            <label><span className="mb-2 block text-sm font-extrabold">{t.term}</span><div className="relative"><input inputMode="numeric" value={years} onChange={e=>setYears(e.target.value.replace(/\D/g,''))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-12 font-black outline-none focus:border-emerald-500 focus:bg-white"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{t.years}</span></div><input type="range" min="1" max="30" value={termYears} onChange={e=>setYears(e.target.value)} className="mt-3 w-full accent-emerald-600"/></label>
            <label><span className="mb-2 block text-sm font-extrabold">{t.payment}</span><select value={paymentType} onChange={e=>setPaymentType(e.target.value as PaymentType)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-black outline-none focus:border-emerald-500 focus:bg-white"><option value="annuity">{t.annuity}</option><option value="differentiated">{t.differentiated}</option></select></label>
            <label className="sm:col-span-2"><span className="mb-2 block text-sm font-extrabold">{t.income}</span><input inputMode="numeric" value={income} onChange={setNumber(setIncome)} placeholder="0" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-black outline-none focus:border-emerald-500 focus:bg-white"/><span className="mt-2 block text-xs text-slate-400">{t.incomeHint}{incomeValue>0 && <> · {incomeLoad.toFixed(0)}% {lang==='ru'?'дохода':'daromad'}</>}</span></label>
          </div>
          <button type="button" onClick={()=>{setPropertyPrice('');setDownPayment('');setRate('');setYears('15');setIncome('')}} className="mt-6 text-sm font-bold text-slate-500 hover:text-slate-900">{t.clear}</button>
        </div>

        <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-lg sm:p-8">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-400">{t.result}</p><p className="mt-2 text-sm text-slate-400">{t.calc}</p></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">{termYears} {t.years}</span></div>
          <div className="mt-8"><p className="text-sm font-bold text-slate-400">{t.monthly}</p><p className="mt-1 text-4xl font-black tracking-tight text-emerald-400">{money(firstMonthly)}</p></div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-slate-400">{t.loan}</p><p className="mt-1 text-lg font-black">{money(principal)}</p></div><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-slate-400">{t.ratio}</p><p className="mt-1 text-lg font-black">{downPercent.toFixed(1)}%</p></div><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-slate-400">{t.total}</p><p className="mt-1 text-lg font-black">{money(total)}</p></div><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-slate-400">{t.overpay}</p><p className="mt-1 text-lg font-black">{money(overpayment)}</p></div></div>
          <p className="mt-6 text-xs leading-5 text-slate-400">{t.disclaimer}</p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-black text-slate-900">{t.subsidy}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{t.subsidyText}</p></div><a href="https://my.gov.uz/uz/service/325" target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-emerald-700">{t.mygov} →</a></div></div>
    </section>

    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-600">FAQ</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">{t.faqTitle}</h2>
        <p className="mt-2 text-sm text-slate-500">{t.faqSub}</p>
        <div className="mt-8 divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white">
          {faq.map(([q,a],i)=><details key={q} open={i===0} className="group p-5 sm:p-6"><summary className="cursor-pointer list-none pr-8 text-base font-black marker:hidden">{q}<span className="float-right text-slate-400 transition group-open:rotate-180">⌄</span></summary><p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">{a}</p></details>)}
        </div>
        <div className="mt-8 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600"><span className="font-black text-slate-900">{t.sources}:</span> my.gov.uz va banklarning amaldagi kredit shartlari. Kalkulyatordagi raqamlar bank taklifi o‘rnini bosmaydi.</div>
      </div>
    </section>
  </main>
}
