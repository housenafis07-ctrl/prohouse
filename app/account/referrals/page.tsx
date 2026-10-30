'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/app/components/I18nProvider'

type Reward = { id: string; invitee_id: string; amount_uzs: number; created_at: string; status: string }
type ReferralData = { code: string | null; referredBy: boolean; invitedCount: number; rewards: Reward[]; bonusBalance: number }

const money = (value: number) => new Intl.NumberFormat('uz-UZ').format(value) + ' so‘m'

export default function ReferralsPage() {
  const router = useRouter()
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, rr: string) => ru ? rr : uz
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [codeInput, setCodeInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  async function load() {
    const response = await fetch('/api/account/referrals', { cache: 'no-store', credentials: 'same-origin' })
    const result = await response.json().catch(() => ({}))
    if (response.status === 401) { const code = new URLSearchParams(window.location.search).get('code'); const next = '/account/referrals' + (code ? '?code=' + encodeURIComponent(code) : ''); router.replace('/register?next=' + encodeURIComponent(next)); return }
    if (!response.ok) throw new Error(result.error || 'REFERRAL_LOAD_FAILED')
    setData(result)
  }
  useEffect(() => { load().catch(e => setError(e instanceof Error ? e.message : 'Xatolik')).finally(() => setLoading(false)) }, [router])

  async function claimCode(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/account/referrals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: codeInput }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Taklif kodini qo‘shib bo‘lmadi.')
      setMessage(t('Taklif kodi biriktirildi. Birinchi faol e’loningiz tasdiqlangach, taklif qilgan foydalanuvchiga bonus beriladi.', 'Промокод привязан. Бонус пригласившему будет начислен после публикации вашего первого объявления.'))
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Xatolik') } finally { setBusy(false) }
  }

  async function copyValue(value: string, type: 'code' | 'link') {
    if (!value) return
    setError('')
    setMessage('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE')
      await navigator.clipboard.writeText(value)
      setCopied(type)
      window.setTimeout(() => setCopied(current => current === type ? null : current), 2000)
    } catch {
      setError(t('Nusxalash amalga oshmadi. Brauzer ruxsatlarini tekshiring yoki matnni qo‘lda belgilang.', 'Не удалось скопировать. Проверьте разрешения браузера или выделите текст вручную.'))
    }
  }

  function referralUrl() {
    return data?.code ? `${window.location.origin}/account/referrals?code=${encodeURIComponent(data.code)}` : ''
  }

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) setCodeInput(code.toUpperCase())
  }, [])

  if (loading) return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 text-center">{t('Yuklanmoqda…','Загрузка…')}</div></main>

  return <main className="min-h-screen bg-slate-50 px-4 py-8">
    <div className="mx-auto max-w-4xl">
      <header className="flex items-center justify-between"><Link href="/account" className="font-bold text-emerald-700">← {t('Shaxsiy kabinet','Личный кабинет')}</Link><span className="font-black">RoyalHouse.uz</span></header>
      <section className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="bg-slate-900 p-7 text-white sm:p-9"><p className="text-xs font-black tracking-[.18em] text-emerald-400">ROYALHOUSE REFERRALS</p><h1 className="mt-2 text-3xl font-black">{t('Do‘stingni taklif qil','Пригласи друга')}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{t('Do‘stingiz haqiqiy e’lonini joylashtirib, e’lon moderatsiyadan o‘tib faol bo‘lsa, sizga 15 000 so‘m reklama bonusi beriladi.','Получите бонус 15 000 сум на продвижение, когда приглашённый друг опубликует настоящее объявление и оно пройдёт модерацию.')}</p></div>
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-800">{t('Bonus balansi','Бонусный баланс')}</p><p className="mt-2 text-2xl font-black text-emerald-900">{money(data?.bonusBalance || 0)}</p><p className="mt-1 text-xs text-emerald-800">{t('Faqat ilgari surish uchun','Только на продвижение')}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">{t('Taklif qilganlaringiz','Приглашено')}</p><p className="mt-2 text-2xl font-black">{data?.invitedCount || 0}</p></div>
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">{t('Bonuslar soni','Начислено бонусов')}</p><p className="mt-2 text-2xl font-black">{data?.rewards?.length || 0}</p></div>
        </div>
        <div className="space-y-6 px-6 pb-7">
          <section className="rounded-2xl border p-5"><h2 className="font-extrabold">{t('Sizning taklif kodingiz','Ваш код приглашения')}</h2><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch"><div className="flex-1 rounded-xl bg-slate-50 px-4 py-3 font-mono text-lg font-black tracking-widest">{data?.code || '—'}</div><button type="button" disabled={!data?.code} onClick={() => data?.code && copyValue(data.code, 'code')} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{copied === 'code' ? t('Kod nusxalandi ✓','Код скопирован ✓') : t('Kodni nusxalash','Скопировать код')}</button><button type="button" disabled={!data?.code} onClick={() => copyValue(referralUrl(), 'link')} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{copied === 'link' ? t('Havola nusxalandi ✓','Ссылка скопирована ✓') : t('Havolani nusxalash','Скопировать ссылку')}</button></div><p className="mt-2 text-xs leading-5 text-slate-500">{t('Kodni alohida yuborishingiz yoki do‘stingizga tayyor taklif havolasini jo‘natishingiz mumkin. Bir oyda ko‘pi bilan 5 ta muvaffaqiyatli taklif uchun bonus beriladi. Bonus naqd pulga yechilmaydi va boshqa hisobga o‘tkazilmaydi.','Отправьте код отдельно или поделитесь готовой ссылкой-приглашением. Не более 5 успешных приглашений в месяц. Бонус нельзя вывести или перевести на другой счёт.')}</p></section>
          {!data?.referredBy && <form onSubmit={claimCode} className="rounded-2xl border p-5"><h2 className="font-extrabold">{t('Do‘stingizning kodini kiriting','Введите код друга')}</h2><p className="mt-1 text-sm text-slate-500">{t('Kodni birinchi faol e’loningizdan oldin kiriting.','Введите код до публикации первого активного объявления.')}</p><div className="mt-3 flex gap-2"><input value={codeInput} onChange={e=>setCodeInput(e.target.value.toUpperCase())} maxLength={12} placeholder="ABC123XYZ" className="min-w-0 flex-1 rounded-xl border px-4 py-3 font-mono uppercase"/><button disabled={busy || !codeInput.trim()} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? '…' : t('Qo‘llash','Применить')}</button></div></form>}
          {data?.referredBy && <div className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{t('Taklif kodi akkauntingizga biriktirilgan.','Код приглашения привязан к аккаунту.')}</div>}
          {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
          {message && <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 break-words">{message}</div>}
          <section><div className="flex items-center justify-between"><h2 className="font-extrabold">{t('Bonuslar tarixi','История бонусов')}</h2><Link href="/account/wallet" className="text-sm font-bold text-emerald-700">{t('Hisobni ko‘rish','Открыть счёт')} →</Link></div><div className="mt-3 divide-y rounded-2xl border">{!data?.rewards?.length ? <p className="p-5 text-sm text-slate-500">{t('Hozircha bonuslar berilmagan.','Пока бонусы не начислялись.')}</p> : data.rewards.map(item=><div key={item.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-bold">{t('Do‘st taklif qilgani uchun bonus','Бонус за приглашение друга')}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString(ru ? 'ru-RU' : 'uz-UZ')}</p></div><span className="font-black text-emerald-700">+{money(Number(item.amount_uzs))}</span></div>)}</div></section>
        </div>
      </section>
    </div>
  </main>
}
