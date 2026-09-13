'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Lang = 'uz' | 'ru'
type PaymentType = 'annuity' | 'differentiated'

type ScheduleRow = {
  month: number
  payment: number
  principalPaid: number
  interest: number
  balance: number
}

const nf = new Intl.NumberFormat('ru-RU')
const money = (value: number) => `${nf.format(Math.max(0, Math.round(value)))} so‘m`
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function monthlyPayment(principal: number, annualRate: number, months: number, type: PaymentType) {
  if (principal <= 0 || months <= 0) return 0
  const r = annualRate / 100 / 12
  if (type === 'differentiated') return principal / months + principal * r
  if (r === 0) return principal / months
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

function totalPayments(principal: number, annualRate: number, months: number, type: PaymentType, graceMonths = 0) {
  if (principal <= 0 || months <= 0) return 0
  const grace = clamp(graceMonths, 0, Math.max(0, months - 1))
  const remaining = months - grace
  const r = annualRate / 100 / 12
  const graceInterest = principal * r * grace
  if (remaining <= 0) return graceInterest
  if (type === 'annuity') return graceInterest + monthlyPayment(principal, annualRate, remaining, type) * remaining
  let total = graceInterest
  for (let i = 0; i < remaining; i++) total += principal / remaining + Math.max(0, principal - principal * i / remaining) * r
  return total
}

function buildSchedule(principal: number, annualRate: number, months: number, type: PaymentType, graceMonths: number): ScheduleRow[] {
  if (principal <= 0 || months <= 0) return []
  const grace = clamp(graceMonths, 0, Math.max(0, months - 1))
  const remainingMonths = Math.max(1, months - grace)
  const r = annualRate / 100 / 12
  const regularPayment = monthlyPayment(principal, annualRate, remainingMonths, type)
  const rows: ScheduleRow[] = []
  let balance = principal

  for (let month = 1; month <= months; month++) {
    const interest = balance * r
    let principalPaid = 0
    let payment = interest

    if (month > grace) {
      const amortizationMonth = month - grace
      if (type === 'differentiated') {
        principalPaid = Math.min(balance, principal / remainingMonths)
        payment = principalPaid + interest
      } else {
        principalPaid = Math.min(balance, Math.max(0, regularPayment - interest))
        payment = principalPaid + interest
      }
    }

    balance = Math.max(0, balance - principalPaid)
    rows.push({ month, payment, principalPaid, interest, balance })
  }

  return rows
}

function formatInput(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? nf.format(Number(digits)).replace(/,/g, ' ') : ''
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export default function MortgageCalculatorPage() {
  const [lang, setLang] = useState<Lang>('uz')
  const [propertyPrice, setPropertyPrice] = useState('1 000 000 000')
  const [downPayment, setDownPayment] = useState('200 000 000')
  const [downPercent, setDownPercent] = useState('20')
  const [rate, setRate] = useState('24')
  const [years, setYears] = useState('15')
  const [graceMonths, setGraceMonths] = useState('0')
  const [paymentType, setPaymentType] = useState<PaymentType>('annuity')
  const [income, setIncome] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('prohouse-lang')
    if (saved === 'ru') setLang('ru')
    const onChange = () => setLang(window.localStorage.getItem('prohouse-lang') === 'ru' ? 'ru' : 'uz')
    window.addEventListener('prohouse-language-change', onChange)
    return () => window.removeEventListener('prohouse-language-change', onChange)
  }, [])

  const t = lang === 'ru' ? {
    back: 'Prohouse', eyebrow: 'Ипотека в Узбекистане', title: 'Ипотечный калькулятор',
    subtitle: 'Рассчитайте ориентировочный ежемесячный платёж, переплату и общую сумму кредита в сумах.',
    property: 'Стоимость недвижимости', downSum: 'Сумма взноса', downPercent: 'Процент взноса',
    rate: 'Процентная ставка в год', term: 'Срок кредита', years: 'лет', grace: 'Льготный период', graceHint: 'месяцев только выплата процентов',
    payment: 'Тип платежа', annuity: 'Аннуитетный', differentiated: 'Дифференцированный', income: 'Ваш доход в месяц (необязательно)',
    incomeHint: 'Поможет ориентировочно оценить нагрузку на бюджет.', result: 'Результат расчёта', loan: 'Сумма кредита', monthly: 'Ежемесячный платёж',
    monthlyAfterGrace: 'Платёж после льготного периода', total: 'Всего выплат', overpay: 'Переплата по процентам', ratio: 'Первоначальный взнос',
    disclaimer: 'Расчёт является предварительным. Реальная ставка, комиссия, требования к доходу и условия кредита определяются банком после рассмотрения заявки.',
    faqTitle: 'Часто задаваемые вопросы об ипотеке', faqSub: 'Полезная информация для покупателей жилья в Узбекистане.', clear: 'Сбросить',
    calc: 'Расчёт обновляется автоматически', subsidy: 'Государственная субсидия', subsidyText: 'Для отдельных категорий граждан действуют программы государственной поддержки. Условия и доступность нужно проверять перед подачей заявки.',
    sources: 'Официальные источники', mygov: 'Подать заявление на ипотечную субсидию',
    details: 'Подробный расчёт', hideDetails: 'Скрыть расчёт', excel: 'Скачать Excel', month: 'Месяц', paymentCol: 'Платёж', principalCol: 'Основной долг', interestCol: 'Проценты', balanceCol: 'Остаток долга',
    graceMark: 'Льготный период', scheduleTitle: 'График платежей', scheduleHint: 'Полный расчёт кредита от первого до последнего месяца.',
    excelReady: 'Excel-файл сформирован',
  } : {
    back: 'Prohouse', eyebrow: 'O‘zbekistonda ipoteka', title: 'Ipoteka kalkulyatori',
    subtitle: 'Uy-joy narxi, boshlang‘ich badal, foiz va muddatni kiriting — oylik to‘lov va ortiqcha to‘lovni darhol hisoblang.',
    property: 'Ko‘chmas mulk narxi', downSum: 'Badal summasi', downPercent: 'Badal foizi',
    rate: 'Yillik foiz stavkasi', term: 'Kredit muddati', years: 'yil', grace: 'Imtiyozli davr', graceHint: 'oy faqat foiz to‘lanadi',
    payment: 'To‘lov turi', annuity: 'Annuitet', differentiated: 'Differensial', income: 'Oylik daromadingiz (ixtiyoriy)',
    incomeHint: 'Byudjetga tushadigan taxminiy yuklamani baholashga yordam beradi.', result: 'Hisob-kitob natijasi', loan: 'Kredit summasi', monthly: 'Oylik to‘lov',
    monthlyAfterGrace: 'Imtiyozli davrdan keyingi to‘lov', total: 'Jami to‘lov', overpay: 'Foizlar bo‘yicha ortiqcha to‘lov', ratio: 'Boshlang‘ich badal',
    disclaimer: 'Hisob-kitob taxminiy. Amaldagi stavka, komissiya, daromad talablari va kredit shartlarini arizani ko‘rib chiqqandan so‘ng bank belgilaydi.',
    faqTitle: 'Ipoteka bo‘yicha ko‘p beriladigan savollar', faqSub: 'O‘zbekistonda uy-joy xarid qiluvchilar uchun foydali ma’lumotlar.', clear: 'Tozalash',
    calc: 'Hisob-kitob avtomatik yangilanadi', subsidy: 'Davlat subsidiyasi', subsidyText: 'Ayrim fuqarolar uchun davlat tomonidan ipoteka bo‘yicha qo‘llab-quvvatlash dasturlari mavjud. Ariza berishdan oldin amaldagi talablarni tekshiring.',
    sources: 'Rasmiy manbalar', mygov: 'Ipoteka subsidiyasiga ariza berish',
    details: 'Batafsil hisob-kitob', hideDetails: 'Hisob-kitobni yopish', excel: 'Excel yuklash', month: 'Oy', paymentCol: 'To‘lov', principalCol: 'Asosiy qarz', interestCol: 'Foiz', balanceCol: 'Qoldiq qarz',
    graceMark: 'Imtiyozli davr', scheduleTitle: 'To‘lovlar jadvali', scheduleHint: 'Kreditning birinchi oyidan oxirgi oyigacha to‘liq hisob-kitob.',
    excelReady: 'Excel fayl tayyorlandi',
  }

  const price = Number(propertyPrice.replace(/\D/g, '')) || 0
  const parsedDownPercent = clamp(Number(downPercent.replace(',', '.')) || 0, 0, 100)
  const down = clamp(Number(downPayment.replace(/\D/g, '')) || 0, 0, price)
  const annualRate = clamp(Number(rate.replace(',', '.')) || 0, 0, 100)
  const termYears = clamp(Number(years.replace(/\D/g, '')) || 1, 1, 30)
  const months = termYears * 12
  const grace = clamp(Number(graceMonths.replace(/\D/g, '')) || 0, 0, Math.max(0, months - 1))
  const principal = Math.max(0, price - down)
  const remainingMonths = Math.max(1, months - grace)
  const r = annualRate / 100 / 12
  const gracePayment = grace > 0 ? principal * r : 0
  const regularMonthly = monthlyPayment(principal, annualRate, remainingMonths, paymentType)
  const firstMonthly = grace > 0 ? gracePayment : regularMonthly
  const total = totalPayments(principal, annualRate, months, paymentType, grace)
  const overpayment = Math.max(0, total - principal)
  const incomeValue = Number(income.replace(/\D/g, '')) || 0
  const incomeLoad = incomeValue > 0 ? firstMonthly / incomeValue * 100 : 0
  const schedule = useMemo(() => buildSchedule(principal, annualRate, months, paymentType, grace), [principal, annualRate, months, paymentType, grace])

  const syncDownFromPercent = (value: string) => {
    const cleaned = value.replace(',', '.').replace(/[^0-9.]/g, '')
    const numeric = clamp(Number(cleaned) || 0, 0, 100)
    setDownPercent(cleaned)
    if (price > 0) setDownPayment(formatInput(String(Math.round(price * numeric / 100))))
  }

  const syncDownFromSum = (value: string) => {
    const formatted = formatInput(value)
    const numeric = clamp(Number(formatted.replace(/\D/g, '')) || 0, 0, price)
    setDownPayment(formatted)
    setDownPercent(price > 0 ? (numeric / price * 100).toFixed(1).replace(/\.0$/, '') : '0')
  }

  const downloadExcel = () => {
    if (!schedule.length) return
    const rows = schedule.map(row => `<Row><Cell><Data ss:Type="Number">${row.month}</Data></Cell><Cell><Data ss:Type="Number">${Math.round(row.payment)}</Data></Cell><Cell><Data ss:Type="Number">${Math.round(row.principalPaid)}</Data></Cell><Cell><Data ss:Type="Number">${Math.round(row.interest)}</Data></Cell><Cell><Data ss:Type="Number">${Math.round(row.balance)}</Data></Cell></Row>`).join('')
    const title = lang === 'ru' ? 'График ипотечных платежей' : 'Ipoteka to‘lovlar jadvali'
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${escapeXml(title.slice(0,31))}"><Table><Row><Cell><Data ss:Type="String">${escapeXml(t.month)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t.paymentCol)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t.principalCol)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t.interestCol)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(t.balanceCol)}</Data></Cell></Row>${rows}</Table></Worksheet></Workbook>`
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `prohouse-ipoteka-${termYears}-yil.xls`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const faq = useMemo(() => lang === 'ru' ? [
    ['Что такое ипотечный калькулятор?', 'Это инструмент для предварительной оценки кредита: он показывает сумму займа, ориентировочный ежемесячный платёж, общую сумму выплат и переплату по процентам.'],
    ['Какие данные нужны для расчёта ипотеки?', 'Обычно достаточно стоимости недвижимости, первоначального взноса, процентной ставки и срока кредита. При необходимости можно дополнительно учитывать льготный период, тип платежа и доход.'],
    ['Что такое первоначальный взнос?', 'Это часть стоимости недвижимости, которую покупатель оплачивает собственными средствами до выдачи ипотечного кредита. Чем больше взнос, тем меньше сумма кредита и, как правило, переплата.'],
    ['Что такое льготный период?', 'Это период, в течение которого заёмщик выплачивает только начисленные проценты. После него начинается погашение основного долга по выбранной схеме.'],
    ['Чем отличается аннуитетный платёж от дифференцированного?', 'При аннуитетной схеме платёж обычно одинаковый каждый месяц. При дифференцированной схеме основная сумма долга гасится равными частями, поэтому первые платежи выше, а затем уменьшаются.'],
    ['Можно ли доверять результату калькулятора?', 'Результат является ориентировочным. Банк может изменить ставку, срок, сумму, комиссии и требования к заёмщику после проверки документов и кредитоспособности.'],
    ['Какой доход нужен для ипотеки?', 'Это зависит от банка, программы, суммы кредита и других обязательств заёмщика. В калькуляторе можно указать доход и увидеть отношение ориентировочного платежа к доходу, но это не является решением банка.'],
    ['Есть ли государственная субсидия на ипотеку в Узбекистане?', 'Да, действуют государственные программы субсидирования для определённых категорий граждан. Актуальные условия и возможность подачи заявления следует проверять на Едином портале интерактивных государственных услуг.'],
    ['Можно ли купить жильё в новостройке и на вторичном рынке?', 'Да, ипотечные программы могут различаться по типу объекта. Условия первичного и вторичного рынка нужно сравнивать отдельно по конкретному банку и программе.'],
    ['Можно ли досрочно погасить ипотеку?', 'Возможность и порядок досрочного погашения зависят от условий кредитного договора и банка. Перед оформлением кредита стоит проверить соответствующий раздел договора.'],
    ['Почему фактический платёж может отличаться?', 'На итоговую стоимость могут влиять комиссии, страхование, дополнительные услуги, изменение условий программы и другие платежи, которые не включены в базовый расчёт.'],
  ] : [
    ['Ipoteka kalkulyatori nima?', 'Bu kreditni oldindan baholash vositasi bo‘lib, kredit summasi, taxminiy oylik to‘lov, jami to‘lov va foizlar bo‘yicha ortiqcha to‘lovni hisoblashga yordam beradi.'],
    ['Ipotekani hisoblash uchun nimalar kerak?', 'Odatda uy-joy narxi, boshlang‘ich badal, yillik foiz stavkasi va kredit muddati yetarli. Qo‘shimcha ravishda imtiyozli davr, to‘lov turi va daromadni ham kiritish mumkin.'],
    ['Boshlang‘ich badal nima?', 'Bu uy-joy qiymatining xaridor o‘z mablag‘i hisobidan to‘laydigan qismi. Badal qancha katta bo‘lsa, kredit summasi va odatda foizlar bo‘yicha ortiqcha to‘lov shuncha kam bo‘ladi.'],
    ['Imtiyozli davr nima?', 'Bu davrda qarz oluvchi faqat hisoblangan foizlarni to‘laydi. Davr tugagach, tanlangan to‘lov sxemasi bo‘yicha asosiy qarz ham qaytarila boshlaydi.'],
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
            <label className="sm:col-span-2"><span className="mb-2 block text-sm font-extrabold">{t.property}</span><div className="relative"><input inputMode="numeric" value={propertyPrice} onChange={e=>{const value=formatInput(e.target.value);setPropertyPrice(value);const p=Number(value.replace(/\D/g,''))||0;const pct=clamp(Number(downPercent.replace(',','.'))||0,0,100);setDownPayment(formatInput(String(Math.round(p*pct/100))))}} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-16 text-lg font-black outline-none focus:border-emerald-500 focus:bg-white"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">so‘m</span></div></label>

            <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="mb-2 block text-sm font-extrabold">{t.downSum}</span><div className="relative"><input inputMode="numeric" value={downPayment} onChange={e=>syncDownFromSum(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-16 font-black outline-none focus:border-emerald-500"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">so‘m</span></div></label>
                <label><span className="mb-2 block text-sm font-extrabold">{t.downPercent}</span><div className="relative"><input inputMode="decimal" value={downPercent} onChange={e=>syncDownFromPercent(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 font-black outline-none focus:border-emerald-500"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span></div></label>
              </div>
              <input type="range" min="0" max="100" step="1" value={parsedDownPercent} onChange={e=>syncDownFromPercent(e.target.value)} className="mt-4 w-full accent-emerald-600" aria-label={t.downPercent}/>
              <div className="mt-1 flex justify-between text-xs font-bold text-slate-400"><span>0%</span><span>15%</span><span>30%</span><span>50%</span><span>75%</span><span>100%</span></div>
            </div>

            <label><span className="mb-2 block text-sm font-extrabold">{t.rate}</span><div className="relative"><input inputMode="decimal" value={rate} onChange={e=>setRate(e.target.value.replace(/[^0-9.,]/g,''))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-12 font-black outline-none focus:border-emerald-500 focus:bg-white"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span></div></label>
            <label><span className="mb-2 block text-sm font-extrabold">{t.term}</span><div className="relative"><input inputMode="numeric" value={years} onChange={e=>setYears(e.target.value.replace(/\D/g,''))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-12 font-black outline-none focus:border-emerald-500 focus:bg-white"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{t.years}</span></div><input type="range" min="1" max="30" value={termYears} onChange={e=>setYears(e.target.value)} className="mt-3 w-full accent-emerald-600"/></label>
            <label><span className="mb-2 block text-sm font-extrabold">{t.grace}</span><div className="relative"><input inputMode="numeric" value={graceMonths} onChange={e=>setGraceMonths(e.target.value.replace(/\D/g,''))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-20 font-black outline-none focus:border-emerald-500 focus:bg-white"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{lang==='ru'?'мес.':'oy'}</span></div><input type="range" min="0" max={Math.max(0, months - 1)} value={grace} onChange={e=>setGraceMonths(e.target.value)} className="mt-3 w-full accent-emerald-600"/><span className="mt-1 block text-xs text-slate-400">{t.graceHint}</span></label>
            <label><span className="mb-2 block text-sm font-extrabold">{t.payment}</span><select value={paymentType} onChange={e=>setPaymentType(e.target.value as PaymentType)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-black outline-none focus:border-emerald-500 focus:bg-white"><option value="annuity">{t.annuity}</option><option value="differentiated">{t.differentiated}</option></select></label>
            <label className="sm:col-span-2"><span className="mb-2 block text-sm font-extrabold">{t.income}</span><input inputMode="numeric" value={income} onChange={setNumber(setIncome)} placeholder="0" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-black outline-none focus:border-emerald-500 focus:bg-white"/><span className="mt-2 block text-xs text-slate-400">{t.incomeHint}{incomeValue>0 && <> · {incomeLoad.toFixed(0)}% {lang==='ru'?'дохода':'daromad'}</>}</span></label>
          </div>
          <button type="button" onClick={()=>{setPropertyPrice('');setDownPayment('');setDownPercent('0');setRate('');setYears('15');setGraceMonths('0');setIncome('');setShowSchedule(false)}} className="mt-6 text-sm font-bold text-slate-500 hover:text-slate-900">{t.clear}</button>
        </div>

        <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-lg sm:p-8">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-400">{t.result}</p><p className="mt-2 text-sm text-slate-400">{t.calc}</p></div><div className="flex shrink-0 flex-col items-end gap-2"><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">{termYears} {t.years}</span><button type="button" onClick={()=>setShowSchedule(v=>!v)} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-white/10"><span>{showSchedule ? t.hideDetails : t.details}</span><span className={`text-base transition-transform ${showSchedule ? 'rotate-180' : ''}`}>⌄</span></button></div></div>
          <div className="mt-8"><p className="text-sm font-bold text-slate-400">{t.monthly}</p><p className="mt-1 text-4xl font-black tracking-tight text-emerald-400">{money(firstMonthly)}</p>{grace>0 && <p className="mt-2 text-xs text-slate-400">{grace} {lang==='ru'?'мес.':'oy'} → {t.monthlyAfterGrace}: <span className="font-bold text-white">{money(regularMonthly)}</span></p>}</div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-slate-400">{t.loan}</p><p className="mt-1 text-lg font-black">{money(principal)}</p></div><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-slate-400">{t.ratio}</p><p className="mt-1 text-lg font-black">{parsedDownPercent.toFixed(1)}%</p></div><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-slate-400">{t.total}</p><p className="mt-1 text-lg font-black">{money(total)}</p></div><div className="rounded-2xl bg-white/5 p-4"><p className="text-xs text-slate-400">{t.overpay}</p><p className="mt-1 text-lg font-black">{money(overpayment)}</p></div></div>
          <p className="mt-6 text-xs leading-5 text-slate-400">{t.disclaimer}</p>

          {showSchedule && <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"><div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-white">{t.scheduleTitle}</p><p className="mt-1 text-xs text-slate-400">{t.scheduleHint}</p></div><button type="button" onClick={downloadExcel} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-emerald-400">↓ {t.excel}</button></div><div className="max-h-[520px] overflow-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="sticky top-0 bg-slate-800 text-slate-300"><tr><th className="px-3 py-3">{t.month}</th><th className="px-3 py-3">{t.paymentCol}</th><th className="px-3 py-3">{t.principalCol}</th><th className="px-3 py-3">{t.interestCol}</th><th className="px-3 py-3">{t.balanceCol}</th></tr></thead><tbody className="divide-y divide-white/5">{schedule.map(row=><tr key={row.month} className="text-slate-200"><td className="px-3 py-2.5 font-bold">{row.month}{row.month<=grace && <span className="ml-1 text-emerald-400">*</span>}</td><td className="px-3 py-2.5 font-bold">{money(row.payment)}</td><td className="px-3 py-2.5">{money(row.principalPaid)}</td><td className="px-3 py-2.5">{money(row.interest)}</td><td className="px-3 py-2.5">{money(row.balance)}</td></tr>)}</tbody></table></div>{grace>0 && <p className="border-t border-white/10 px-4 py-3 text-[11px] text-slate-400">* {t.graceMark}: faqat foiz to‘lovi.</p>}</div>}
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-black text-slate-900">{t.subsidy}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{t.subsidyText}</p></div><a href="https://my.gov.uz/uz/service/325" target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-emerald-700">{t.mygov} →</a></div></div>
    </section>

    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-600">FAQ</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">{t.faqTitle}</h2>
        <p className="mt-2 text-sm text-slate-500">{t.faqSub}</p>
        <div className="mt-8 divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white">{faq.map(([q,a],i)=><details key={q} open={i===0} className="group p-5 sm:p-6"><summary className="cursor-pointer list-none pr-8 text-base font-black marker:hidden">{q}<span className="float-right text-slate-400 transition group-open:rotate-180">⌄</span></summary><p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">{a}</p></details>)}</div>
        <div className="mt-8 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600"><span className="font-black text-slate-900">{t.sources}:</span> my.gov.uz va banklarning amaldagi kredit shartlari. Kalkulyatordagi raqamlar bank taklifi o‘rnini bosmaydi.</div>
      </div>
    </section>
  </main>
}
