'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

const statusText: Record<string, { uzTitle: string; ruTitle: string; uzText: string; ruText: string }> = {
  not_joined: { uzTitle: 'Ulanilmagan', ruTitle: 'Не подключено', uzText: 'Ishonchli profil dasturiga qo‘shilish hali boshlanmagan.', ruText: 'Подключение к программе доверенного профиля ещё не начато.' },
  requested: { uzTitle: 'So‘rov yuborildi', ruTitle: 'Заявка отправлена', uzText: 'Profilingiz tekshiruv navbatiga qo‘yildi.', ruText: 'Ваш профиль поставлен в очередь на проверку.' },
  under_review: { uzTitle: 'Tekshiruvda', ruTitle: 'На проверке', uzText: 'Admin hujjatlaringizni tekshirmoqda.', ruText: 'Администратор проверяет ваши документы.' },
  verification: { uzTitle: 'Tasdiqlash jarayonida', ruTitle: 'На проверке', uzText: 'Tasdiqlash jarayoni davom etmoqda.', ruText: 'Проверка продолжается.' },
  verified: { uzTitle: 'Ishonchli profil', ruTitle: 'Доверенный профиль', uzText: 'Profilingiz ishonchli sifatida tasdiqlangan.', ruText: 'Ваш профиль подтверждён как доверенный.' },
  rejected: { uzTitle: 'Tasdiqlanmadi', ruTitle: 'Не подтверждено', uzText: 'Qo‘shimcha ma’lumot yoki hujjat talab qilinishi mumkin.', ruText: 'Может потребоваться дополнительная информация или документы.' },
}

type Profile = {
  account_type: 'individual' | 'partner'
  partner_type: string | null
  trusted_profile: boolean
  trusted_profile_opt_in: boolean
  trusted_profile_program_status: string | null
  myid_status: string | null
  myid_verified_at: string | null
  payment_verification_status: string | null
  trusted_profile_rejection_reason: string | null
  manual_verification_status?: string | null
}

type PartnerDocument = {
  id: string
  document_type: string
  file_name: string
  status: string
  rejection_reason: string | null
  created_at: string
}

type PartnerPlan = {
  code: 'partner_start' | 'partner_pro' | 'partner_business'
  name: string
  price: string
  limit: string
  features: string[]
  tone: 'dark' | 'emerald' | 'violet'
  popular?: boolean
}

const documentTypes = [
  { value: 'self_employed_certificate', uz: 'O‘zini o‘zi band qilganlik hujjati', ru: 'Документ самозанятого' },
  { value: 'sole_proprietor_certificate', uz: 'YaTT guvohnomasi', ru: 'Свидетельство ИП' },
  { value: 'registration_certificate', uz: 'Ro‘yxatdan o‘tganlik guvohnomasi', ru: 'Свидетельство о регистрации' },
  { value: 'other_required_documents', uz: 'Boshqa zaruriy hujjatlar', ru: 'Другие необходимые документы' },
  { value: 'director_id', uz: 'Rahbar pasporti / ID', ru: 'Паспорт / ID руководителя' },
  { value: 'identity_selfie', uz: 'Shaxsiy fotosurat', ru: 'Личное фото' },
  { value: 'identity_passport', uz: 'Pasport rasmi', ru: 'Фото паспорта' },
  { value: 'identity_id_front', uz: 'ID karta — old tomoni', ru: 'ID-карта — лицевая сторона' },
  { value: 'identity_id_back', uz: 'ID karta — orqa tomoni', ru: 'ID-карта — обратная сторона' },
  { value: 'company_charter', uz: 'Firma ustavi', ru: 'Устав компании' },
]

function TrustedBadge({ small = false, label }: { small?: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 font-extrabold text-emerald-700 ring-1 ring-emerald-100 ${small ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}><span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white">✓</span>{label}</span>
}

const partnerPlans: PartnerPlan[] = [
  { code: 'partner_start', name: 'START', price: '29 000', limit: '10 ta e’lon', features: ['10 ta e’lon', 'Statistika', 'Oddiy hamkor profil', 'E’lonlarda yuqoriroq ko‘rinish'], tone: 'dark' },
  { code: 'partner_pro', name: 'PRO', price: '59 000', limit: '30 ta e’lon', features: ['30 ta e’lon', 'Analytics', 'Priority moderation', 'Promo tools', 'E’lonlarda yuqoriroq ko‘rinish'], tone: 'emerald', popular: true },
  { code: 'partner_business', name: 'BUSINESS', price: '149 000', limit: '100+ e’lon', features: ['100+ e’lon', 'Bir nechta xodim', 'Firma profili', 'Advanced analytics', 'Priority support', 'E’lonlarda yuqoriroq ko‘rinish'], tone: 'violet' },
]

export default function TrustedProfilePage() {
  const router = useRouter()
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, rr: string) => ru ? rr : uz
  const [profile, setProfile] = useState<Profile | null>(null)
  const [documents, setDocuments] = useState<PartnerDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [partnerStatus, setPartnerStatus] = useState('not_requested')

  const load = async () => {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { router.replace('/register'); return }
    const { data, error: queryError } = await db.from('profiles').select('account_type,partner_type,trusted_profile,trusted_profile_opt_in,trusted_profile_program_status,myid_status,myid_verified_at,payment_verification_status,trusted_profile_rejection_reason,manual_verification_status').eq('id', user.id).maybeSingle()
    if (queryError) setError(queryError.message)
    const nextProfile = (data ?? { account_type: 'individual', partner_type: null, trusted_profile: false, trusted_profile_opt_in: false, trusted_profile_program_status: 'not_joined', myid_status: 'not_started', myid_verified_at: null, payment_verification_status: null, trusted_profile_rejection_reason: null }) as Profile
    setProfile(nextProfile)

    {
      const response = await fetch('/api/verification/trusted-partner/documents', { cache: 'no-store' })
      if (response.ok) {
        const payload = await response.json()
        setDocuments(Array.isArray(payload.documents) ? payload.documents : [])
        setPartnerStatus(payload.trustedPartnerStatus || payload.trustedProfileStatus || 'not_requested')
      }
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [router])

  const status = profile?.account_type === 'partner' ? partnerStatus : (profile?.trusted_profile ? 'verified' : (profile?.trusted_profile_program_status || 'not_joined'))
  const meta = statusText[status] || statusText.not_joined
  const metaTitle = ru ? meta.ruTitle : meta.uzTitle
  const metaText = ru ? meta.ruText : meta.uzText
  const myIdVerified = profile?.myid_status === 'verified'

  const requiredDocuments = useMemo(() => {
    if (!profile || profile.account_type !== 'partner') return []
    if (profile.partner_type === 'llc') return ['registration_certificate', 'other_required_documents', 'director_id', 'company_charter']
    if (profile.partner_type === 'sole_proprietor') return ['sole_proprietor_certificate', 'other_required_documents']
    return ['self_employed_certificate', 'other_required_documents']
  }, [profile])

  const uploadedTypes = new Set(documents.map(document => document.document_type))
  const missingDocuments = requiredDocuments.filter(type => !uploadedTypes.has(type))

  const requestIndividual = async () => {
    setWorking(true); setError(''); setMessage('')
    try {
      const db = createClient()
      const { data, error: rpcError } = await db.rpc('request_trusted_profile')
      if (rpcError) throw rpcError
      setMessage(data?.status === 'verified' ? t('Ishonchli profil allaqachon tasdiqlangan.','Доверенный профиль уже подтверждён.') : t('Ishonchli profil uchun so‘rovingiz qabul qilindi.','Заявка на доверенный профиль принята.'))
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : t('So‘rov yuborishda xatolik','Ошибка при отправке заявки')) }
    finally { setWorking(false) }
  }

  const startMyId = async () => {
    setWorking(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/verification/myid/start', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || t('MyID tekshiruvini boshlashda xatolik','Ошибка запуска проверки MyID'))
      if (data.redirectUrl) window.location.assign(data.redirectUrl)
      else setMessage(data.message || t('MyID integratsiyasi konfiguratsiya qilinmagan.','Интеграция MyID не настроена.'))
    } catch (e) { setError(e instanceof Error ? e.message : t('MyID tekshiruvini boshlashda xatolik','Ошибка запуска проверки MyID')) }
    finally { setWorking(false) }
  }

  const uploadDocument = async (documentType: string, file: File) => {
    setUploading(true); setError(''); setMessage('')
    try {
      const form = new FormData()
      form.append('documentType', documentType)
      form.append('file', file)
      const response = await fetch('/api/verification/trusted-partner/documents', { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || t('Hujjat yuklashda xatolik','Ошибка загрузки документа'))
      setMessage(t('Hujjat qabul qilindi. Admin tekshiruviga yuborildi.','Документ принят и отправлен на проверку.'))
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : t('Hujjat yuklashda xatolik','Ошибка загрузки документа')) }
    finally { setUploading(false) }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-8 text-center text-slate-500">{t('Yuklanmoqda...','Загрузка...')}</main>
  if (!profile) return null

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Link href="/account" className="text-sm font-extrabold text-emerald-700">← {t('Shaxsiy kabinet','Личный кабинет')}</Link><Link href="/" className="text-sm font-bold text-slate-500">Royalhouse</Link></div></header>
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12"><div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="bg-slate-900 px-6 py-8 text-white sm:px-8"><p className="text-sm font-semibold text-slate-300">{t('Royalhouse xavfsizlik tizimi','Система безопасности Royalhouse')}</p><h1 className="mt-2 text-3xl font-black">{profile.account_type === 'partner' ? t('Ishonchli hamkor','Доверенный партнёр') : t('Ishonchli profil','Доверенный профиль')}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{profile.account_type === 'partner' ? t('Hamkorning zarur hujjatlari admin tomonidan tekshiriladi. MyID bu oqimda majburiy emas.','Необходимые документы партнёра проверяются администратором. MyID в этом потоке не обязателен.') : t('Jismoniy shaxs uchun MyID orqali bepul tasdiqlash.','Бесплатное подтверждение через MyID для физического лица.')}</p><div className="mt-5">{status === 'verified' && <TrustedBadge label={profile.account_type === 'partner' ? t('Ishonchli hamkor','Доверенный партнёр') : t('Ishonchli profil','Доверенный профиль')}/>}</div></div>
      <div className="p-6 sm:p-8"><div className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-600">{t('Holat','Статус')}</p><h2 className="mt-1 text-xl font-black text-emerald-900">{metaTitle}</h2><p className="mt-1 text-sm leading-6 text-emerald-800">{metaText}</p></div>{status === 'verified' && <TrustedBadge small label={profile.account_type === 'partner' ? t('Ishonchli hamkor','Доверенный партнёр') : t('Ishonchli profil','Доверенный профиль')}/>}</div>

        {profile.account_type === 'individual' ? <>
          <div className="mt-6 rounded-2xl border border-slate-200 p-5"><h3 className="font-black">{t('Shaxsni hujjat orqali tasdiqlash','Подтверждение личности по документам')}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{t('Selfie va pasport yoki ID karta rasmini yuklang. Admin hujjatlarni qo‘lda tekshiradi.','Загрузите селфи и фото паспорта или ID-карты. Администратор проверит документы вручную.')}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{['identity_selfie','identity_passport','identity_id_front','identity_id_back'].map(type => { const metaDoc = documentTypes.find(item => item.value === type); const uploaded = documents.find(document => document.document_type === type && document.status !== 'archived'); return <div key={type} className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-black">{ru ? metaDoc?.ru : metaDoc?.uz}</p><p className="mt-1 text-xs text-slate-500">{uploaded ? `${uploaded.file_name} · ${uploaded.status}` : t('Rasm yuklanmagan','Фото не загружено')}</p><label className="mt-3 inline-flex cursor-pointer rounded-xl bg-white px-4 py-2 text-sm font-black text-emerald-700 ring-1 ring-slate-200"><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadDocument(type, file) }} />{uploaded ? t('Qayta yuklash','Загрузить заново') : t('Rasm tanlash','Выбрать фото')}</label></div>})}</div><p className="mt-3 text-xs text-slate-500">{t('Selfie va pasport yoki ID karta old tomoni majburiy. ID karta tanlansa orqa tomonini ham yuklang.','Обязательны селфи и лицевая сторона паспорта или ID-карты. Для ID-карты загрузите также обратную сторону.')}</p></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-100 bg-slate-50 p-5"><div className="flex items-center justify-between"><h3 className="font-black">MyID</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${myIdVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{myIdVerified ? t('Tasdiqlangan','Подтверждено') : t('Bepul','Бесплатно')}</span></div><p className="mt-2 text-sm leading-6 text-slate-500">{t('Jismoniy shaxs uchun biometrik identifikatsiya orqali bepul tasdiqlash.','Бесплатное подтверждение физического лица с помощью биометрической идентификации.')}</p>{!myIdVerified && <button onClick={startMyId} disabled={working} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{working ? t('Yuklanmoqda...','Загрузка...') : t('MyID orqali tasdiqlash','Подтвердить через MyID')}</button>}</div></div>
          {!profile.trusted_profile && <div className="mt-6 rounded-2xl border border-slate-200 p-5"><h3 className="font-black">{t('Ishonchli profilga so‘rov','Заявка на доверенный профиль')}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{t('MyID tasdig‘idan keyin bepul ishonchli profil belgisi beriladi.','После подтверждения MyID бесплатный профиль получает знак доверия.')}</p><button onClick={requestIndividual} disabled={working || status === 'requested' || status === 'verification'} className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700 disabled:opacity-50">{status === 'requested' || status === 'verification' ? t('Tekshiruv kutilmoqda','Ожидается проверка') : t('Ishonchli profilga qo‘shilish','Подключиться к доверенному профилю')}</button></div>}
        </> : <>
          <div className="mt-6 rounded-2xl border border-slate-200 p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black">{t('Hamkor hujjatlari','Документы партнёра')}</h3><p className="mt-1 text-sm text-slate-500">{t('MyID talab qilinmaydi. Faqat zarur hujjatlarni yuklang; admin tekshiradi va arxivda saqlaydi.','MyID не требуется. Загрузите только необходимые документы; администратор проверит и сохранит их в архиве.')}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{documents.length} {t('ta','шт.')}</span></div>
            <div className="mt-5 space-y-3">{requiredDocuments.map(type => { const metaDoc = documentTypes.find(item => item.value === type); const uploaded = documents.find(document => document.document_type === type && document.status !== 'archived'); return <div key={type} className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">{ru ? metaDoc?.ru : metaDoc?.uz}</p><p className="mt-1 text-xs text-slate-500">{uploaded ? `${uploaded.file_name} · ${uploaded.status}` : t('Yuklanmagan','Не загружен')}</p>{type === 'other_required_documents' && <p className="mt-1 text-xs leading-5 text-slate-400">{t('Masalan: QQS sertifikati, korxona rahbarining buyrug‘i, sertifikat va boshqa tasdiqlovchi hujjatlar.','Например: сертификат НДС, приказ руководителя компании, сертификат и другие подтверждающие документы.')}</p>}</div><label className="cursor-pointer rounded-xl bg-white px-4 py-2 text-sm font-black text-emerald-700 ring-1 ring-slate-200 hover:ring-emerald-300"><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadDocument(type, file) }} />{uploaded ? t('Qayta yuklash','Загрузить заново') : t('Hujjat yuklash','Загрузить документ')}</label></div>})}</div>
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{missingDocuments.length === 0 ? t('Barcha zarur hujjatlar yuklangan. Admin tekshiruviga yuborildi.','Все необходимые документы загружены и отправлены на проверку.') : t(`Yana ${missingDocuments.length} ta hujjat kerak.`,`Необходимо загрузить ещё ${missingDocuments.length} документа.`)}</div>
          </div>

          <section className="mt-8 overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200">ROYALHOUSE PARTNER</span><h2 className="mt-3 text-2xl font-black sm:text-3xl">{t('Biznesingizni keyingi bosqichga olib chiqing','Выведите бизнес на новый уровень')}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{t('Tarif tanlang — ko‘proq e’lon joylang, natijalarni kuzating va e’lonlaringizni oddiy e’lonlardan yuqoriroq ko‘rsating.','Выберите тариф — размещайте больше объявлений, анализируйте результаты и получайте более высокое размещение.')}</p></div></div>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">{partnerPlans.map(plan => <article key={plan.code} className={`relative flex flex-col rounded-3xl border p-5 shadow-lg transition hover:-translate-y-1 ${plan.tone === 'emerald' ? 'border-emerald-300 bg-white text-slate-900 ring-2 ring-emerald-200' : plan.tone === 'violet' ? 'border-violet-300/30 bg-white/10' : 'border-white/10 bg-white/5'}`}>{plan.popular && <div className="absolute -top-3 left-5 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">⭐ {t('Eng ko‘p tanlanadi','Самый популярный')}</div>}<div className="flex items-start justify-between gap-3"><div><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${plan.tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' : plan.tone === 'violet' ? 'bg-violet-400/20 text-violet-100' : 'bg-white/10 text-white'}`}>{plan.name}</span><div className="mt-4 text-3xl font-black">{plan.price} <span className={`text-sm ${plan.tone === 'emerald' ? 'text-slate-400' : 'text-slate-300'}`}>{t('so‘m','сум')}</span></div><div className={`text-xs font-bold ${plan.tone === 'emerald' ? 'text-slate-400' : 'text-slate-300'}`}>/ {t('oy','месяц')}</div></div><span className={`rounded-2xl px-3 py-2 text-xs font-black ${plan.tone === 'emerald' ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-white'}`}>{plan.limit}</span></div><ul className={`mt-5 flex-1 space-y-2 text-sm ${plan.tone === 'emerald' ? 'text-slate-700' : 'text-slate-200'}`}>{plan.features.map(feature => <li key={feature}>✓ {feature}</li>)}</ul><Link href={`/account/monetization/checkout?product=${plan.code}`} className={`mt-6 block rounded-2xl px-4 py-3 text-center text-sm font-black transition ${plan.tone === 'emerald' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : plan.tone === 'violet' ? 'bg-violet-500 text-white hover:bg-violet-600' : 'bg-white text-slate-950 hover:bg-slate-100'}`}>{t('Tarifni tanlash →','Выбрать тариф →')}</Link></article>)}</div>
            <p className="mt-5 text-center text-xs leading-5 text-slate-400">{t('Ishonchli hamkor maqomi hujjatlar tekshirilgandan keyin alohida beriladi. Tarif esa alohida monetizatsiya xizmati hisoblanadi.','Статус доверенного партнёра предоставляется отдельно после проверки документов. Тариф является отдельной услугой монетизации.')}</p>
          </section>

          {profile.trusted_profile_rejection_reason && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{profile.trusted_profile_rejection_reason}</div>}
        </>}

        {message && <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
        {error && <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-black">{t('Muhim qoida','Важное правило')}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t('Ishonchli profil yoki Ishonchli hamkor maqomiga ega bo‘lgan e’lonlar oddiy e’lonlardan yuqoriroq joylashtiriladi. Pullik TOP/Featured/Premium targ‘ibotlari esa o‘zining ustuvor rankingini saqlaydi.','Объявления доверенного профиля или доверенного партнёра размещаются выше обычных объявлений. Платные TOP/Featured/Premium-продвижения сохраняют свой приоритет.')}</p></div>
      </div></div>
    </div>
  </main>
}
