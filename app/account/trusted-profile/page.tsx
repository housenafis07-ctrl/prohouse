'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

const statusText: Record<string, { uzTitle: string; ruTitle: string; uzText: string; ruText: string }> = {
  not_joined: { uzTitle: 'Ulanilmagan', ruTitle: 'Не подключено', uzText: 'Ishonchli profil dasturiga qo‘shilish hali boshlanmagan.', ruText: 'Подключение к программе доверенного профиля ещё не начато.' },
  requested: { uzTitle: 'So‘rov yuborildi', ruTitle: 'Заявка отправлена', uzText: 'Profilingiz tekshiruv navbatiga qo‘yildi.', ruText: 'Ваш профиль поставлен в очередь на проверку.' },
  verification: { uzTitle: 'Tasdiqlash jarayonida', ruTitle: 'На проверке', uzText: 'MyID va boshqa zarur tekshiruvlar yakunlanmoqda.', ruText: 'Проверка через MyID и другие необходимые проверки выполняются.' },
  verified: { uzTitle: 'Ishonchli profil', ruTitle: 'Доверенный профиль', uzText: 'Profilingiz ishonchli sifatida tasdiqlangan.', ruText: 'Ваш профиль подтверждён как доверенный.' },
  rejected: { uzTitle: 'Tasdiqlanmadi', ruTitle: 'Не подтверждено', uzText: 'Tekshiruv natijasida qo‘shimcha ma’lumot talab qilinishi mumkin.', ruText: 'По результатам проверки может потребоваться дополнительная информация.' },
}

type Profile = {
  trusted_profile: boolean
  trusted_profile_opt_in: boolean
  trusted_profile_program_status: string | null
  myid_status: string | null
  myid_verified_at: string | null
  payment_verification_status: string | null
  trusted_profile_rejection_reason: string | null
}

export default function TrustedProfilePage() {
  const router = useRouter()
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, rr: string) => ru ? rr : uz
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { router.replace('/register'); return }
    const { data, error: queryError } = await db.from('profiles').select('trusted_profile,trusted_profile_opt_in,trusted_profile_program_status,myid_status,myid_verified_at,payment_verification_status,trusted_profile_rejection_reason').eq('id', user.id).maybeSingle()
    if (queryError) setError(queryError.message)
    setProfile((data ?? { trusted_profile: false, trusted_profile_opt_in: false, trusted_profile_program_status: 'not_joined', myid_status: 'not_started', myid_verified_at: null, payment_verification_status: null, trusted_profile_rejection_reason: null }) as Profile)
    setLoading(false)
  }

  useEffect(() => { void load() }, [router])

  const request = async () => {
    setWorking(true); setError(''); setMessage('')
    try {
      const db = createClient()
      const { data, error: rpcError } = await db.rpc('request_trusted_profile')
      if (rpcError) throw rpcError
      setMessage(data?.status === 'verified' ? t('Ishonchli profil allaqachon tasdiqlangan.','Доверенный профиль уже подтверждён.') : t('Ishonchli profil uchun so‘rovingiz qabul qilindi.','Заявка на доверенный профиль принята.'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('So‘rov yuborishda xatolik','Ошибка при отправке заявки'))
    } finally { setWorking(false) }
  }

  const startMyId = async () => {
    setWorking(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/verification/myid/start', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || t('MyID tekshiruvini boshlashda xatolik','Ошибка запуска проверки MyID'))
      if (data.redirectUrl) window.location.assign(data.redirectUrl)
      else setMessage(data.message || t('MyID integratsiyasi konfiguratsiya qilinmagan.','Интеграция MyID не настроена.'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('MyID tekshiruvini boshlashda xatolik','Ошибка запуска проверки MyID'))
    } finally { setWorking(false) }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-8 text-center text-slate-500">{t('Yuklanmoqda...','Загрузка...')}</main>
  if (!profile) return null

  const status = profile.trusted_profile ? 'verified' : (profile.trusted_profile_program_status || 'not_joined')
  const meta = statusText[status] || statusText.not_joined
  const metaTitle = ru ? meta.ruTitle : meta.uzTitle
  const metaText = ru ? meta.ruText : meta.uzText
  const myIdVerified = profile.myid_status === 'verified'
  const paymentVerified = profile.payment_verification_status === 'verified'

  return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Link href="/account" className="text-sm font-extrabold text-emerald-700">← {t('Shaxsiy kabinet','Личный кабинет')}</Link><Link href="/" className="text-sm font-bold text-slate-500">Royalhouse</Link></div></header>
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12"><div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"><div className="bg-slate-900 px-6 py-8 text-white sm:px-8"><p className="text-sm font-semibold text-slate-300">{t('Royalhouse xavfsizlik tizimi','Система безопасности Royalhouse')}</p><h1 className="mt-2 text-3xl font-black">{t('Ishonchli profil','Доверенный профиль')}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{t('Ixtiyoriy tasdiqlash orqali foydalanuvchining haqiqiyligini kuchaytirish va e’lonlarda ishonchli sotuvchini ajratib ko‘rsatish.','Добровольная проверка помогает подтвердить подлинность пользователя и выделить надёжного продавца в объявлениях.')}</p><div className="mt-5">{profile.trusted_profile && <TrustedBadge label={t('Ishonchli profil','Доверенный профиль')}/>}</div></div>
      <div className="p-6 sm:p-8"><div className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-600">{t('Holat','Статус')}</p><h2 className="mt-1 text-xl font-black text-emerald-900">{metaTitle}</h2><p className="mt-1 text-sm leading-6 text-emerald-800">{metaText}</p></div>{profile.trusted_profile && <TrustedBadge small label={t('Ishonchli profil','Доверенный профиль')}/>}</div>
        {profile.trusted_profile_rejection_reason && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{profile.trusted_profile_rejection_reason}</div>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-100 bg-slate-50 p-5"><div className="flex items-center justify-between"><h3 className="font-black">MyID</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${myIdVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{myIdVerified ? t('Tasdiqlangan','Подтверждено') : t('Tasdiqlanmagan','Не подтверждено')}</span></div><p className="mt-2 text-sm leading-6 text-slate-500">{t('Shaxsni biometrik identifikatsiya qilish orqali profilni tasdiqlash.','Подтверждение профиля с помощью биометрической идентификации.')}</p>{!myIdVerified && <button onClick={startMyId} disabled={working} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{working ? t('Yuklanmoqda...','Загрузка...') : t('MyID orqali tasdiqlash','Подтвердить через MyID')}</button>}</div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5"><div className="flex items-center justify-between"><h3 className="font-black">{t('To‘lov hisobi','Платёжный аккаунт')}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${paymentVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{paymentVerified ? t('Tasdiqlangan','Подтверждено') : t('Kutilmoqda','Ожидается')}</span></div><p className="mt-2 text-sm leading-6 text-slate-500">{t('Ishonchli profilni kuchaytirish uchun bog‘langan to‘lov hisobining tasdiqlangan holati.','Подтверждённый статус привязанного платёжного аккаунта для повышения доверия к профилю.')}</p></div></div>
        {!profile.trusted_profile && <div className="mt-6 rounded-2xl border border-slate-200 p-5"><h3 className="font-black">{t('Ixtiyoriy dastur','Добровольная программа')}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{t('Qo‘shilish majburiy emas. So‘rov yuborilgach, MyID tasdig‘i va mavjud xavfsizlik tekshiruvlari asosida profilga yashil belgi beriladi.','Участие необязательно. После заявки зелёный знак выдаётся на основании подтверждения MyID и доступных проверок безопасности.')}</p><button onClick={request} disabled={working || status === 'requested' || status === 'verification'} className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700 disabled:opacity-50">{status === 'requested' || status === 'verification' ? t('Tekshiruv kutilmoqda','Ожидается проверка') : t('Ishonchli profilga qo‘shilish','Подключиться к доверенному профилю')}</button></div>}
        {message && <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}{error && <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-black">{t('Belgi qayerda ko‘rinadi?','Где отображается знак?')}</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600"><li>✓ {t('Shaxsiy kabinet','Личный кабинет')}dagi profil holatida</li><li>✓ Hamkorning e’lonlarida “{t('Ishonchli profil','Доверенный профиль')}” belgisi sifatida</li><li>✓ {t('E’lon tafsilotlarida sotuvchi/beruvchi ma’lumotlari yonida','В деталях объявления рядом с данными продавца/арендодателя')}</li><li>✓ {t('Keyingi bosqichda Rieltorlar profilida ham','На следующем этапе также в профилях риелторов')}</li></ul></div>
        <p className="mt-6 text-xs leading-5 text-slate-400">{t('MyID biometrik identifikatsiyasi faqat foydalanuvchining tasdiqlangan roziligi bilan amalga oshirilishi kerak. Real MyID ulanishi uchun Royalhouse MyID bilan shartnoma va beriladigan test/tijoriy credentials asosida konfiguratsiya qilinadi.','Биометрическая идентификация MyID должна выполняться только с подтверждённого согласия пользователя. Для реального подключения MyID Royalhouse потребуется договор и настройка на основе тестовых/коммерческих учётных данных.')}</p>
      </div></div></div></main>
}
