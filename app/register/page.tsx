'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser'
import { useI18n } from '@/app/components/I18nProvider'
import { listenForSmsOtp, normalizeCode } from '@/app/lib/web-otp'
import { createSubmitGuard, isComplete } from '@/app/lib/otp-state.mjs'

type AccountType = 'individual' | 'partner'
type PartnerType = 'self_employed' | 'sole_proprietor' | 'llc'
type Offer = { version:number; title:string; content:string; audience:'public'|'partner' }
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> }
const emptyForm = { fullName:'', companyName:'', inn:'', bankName:'', bankAccount:'', mfo:'', directorFullName:'' }

export default function RegisterPage() {
  const router = useRouter()
  const pathname = usePathname()
  const otpInputRef = useRef<HTMLInputElement | null>(null)
  const stopOtpRef = useRef<(() => void) | null>(null)
  const submitGuardRef = useRef(createSubmitGuard())
  const [accountType,setAccountType] = useState<AccountType>('individual')
  const [partnerType,setPartnerType] = useState<PartnerType>('self_employed')
  const [phone,setPhone] = useState('+998 ')
  const [code,setCode] = useState('')
  const [sent,setSent] = useState(false)
  const [verified,setVerified] = useState(false)
  const [loading,setLoading] = useState(false)
  const [message,setMessage] = useState('')
  const [form,setForm] = useState(emptyForm)
  const [offer,setOffer] = useState<Offer|null>(null)
  const [offerOpen,setOfferOpen] = useState(false)
  const [offerAcceptanceOnly,setOfferAcceptanceOnly] = useState(false)
  const [autoPasskeyReady,setAutoPasskeyReady] = useState(false)
  const [telegramPasskeyHelpOpen,setTelegramPasskeyHelpOpen] = useState(false)
  const [iosInstallHelp,setIosInstallHelp] = useState(false)
  const [installPrompt,setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const autoPasskeyAttemptedRef = useRef(false)
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz:string, russian:string) => ru ? russian : uz
  const selectedAudience = accountType === 'partner' ? 'partner' : 'public'
  const localizedOfferContent = offer?.content
    ? (ru
      ? (offer.content.includes('РУССКИЙ ТЕКСТ') ? 'РУССКИЙ ТЕКСТ' + offer.content.split('РУССКИЙ ТЕКСТ')[1] : offer.content)
      : (offer.content.includes('РУССКИЙ ТЕКСТ') ? offer.content.split('РУССКИЙ ТЕКСТ')[0] : offer.content))
    : ''

  const update=(key:keyof typeof form,value:string)=>setForm(v=>({...v,[key]:value}))
  const getRedirectTo=()=>{ const next=new URLSearchParams(window.location.search).get('next'); return next && next.startsWith('/') ? next : '/account' }
  const completeLogin=()=>{
    const params = new URLSearchParams(window.location.search)
    if (params.get('authModal') === '1' && window.parent !== window) {
      window.parent.postMessage({ type: 'ROYALHOUSE_AUTH_COMPLETE' }, window.location.origin)
      return
    }
    router.replace(getRedirectTo())
  }

  useEffect(()=>{
    let mounted=true
    const load=async()=>{
      // A deliberate visit to /account/login must not silently reuse a
      // previously verified 30-day cabinet cookie. Clear only the RoyalHouse
      // cabinet credential; the OTP flow will issue a fresh one after SMS
      // verification. Keep /register's existing signed-session redirect.
      const loginPage = pathname === '/account/login'
      if (loginPage) {
        await fetch('/api/auth/clear-account-session', {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
        }).catch(() => null)
      }

      const offerPromise = createClient().from('offer_versions').select('version,title,content,audience').eq('audience', accountType === 'partner' ? 'partner' : 'public').eq('is_active',true).maybeSingle()
      const accountPromise = loginPage
        ? Promise.resolve(null)
        : fetch('/api/account/profile', { cache: 'no-store', credentials: 'same-origin' }).catch(() => null)
      const [offerResult, accountResponse] = await Promise.all([offerPromise, accountPromise])

      if(!mounted) return
      if(offerResult.data) setOffer(offerResult.data)
      if(loginPage) setAutoPasskeyReady(true)
      if(!loginPage && accountResponse?.ok){
        completeLogin()
      }
    }
    void load()
    return()=>{mounted=false}
  },[router, pathname, accountType])

  useEffect(()=>{
    if(pathname !== '/account/login' || !autoPasskeyReady || !offer?.version || autoPasskeyAttemptedRef.current) return
    if(window.localStorage.getItem('royalhouse-passkey-preferred') !== '1') return
    autoPasskeyAttemptedRef.current = true
    void loginWithPasskey()
  },[pathname,autoPasskeyReady,offer])

  useEffect(()=>{
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  },[])

  useEffect(()=>()=>stopOtpRef.current?.(),[])

  async function verifyCode(overrideCode?:string){
    const normalizedPhone=phone.replace(/\s/g,'')
    const otpCode=normalizeCode(overrideCode ?? code)
    if(!sent||otpCode.length<4) return setMessage(t('SMS kodini kiriting.','Введите SMS-код.'))
    setLoading(true);setMessage('')
    try{
      const response=await fetch('/api/auth/verify-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:normalizedPhone,code:otpCode})})
      const data=await response.json()
      if(!response.ok) throw new Error(data.error||t('Kod noto‘g‘ri','Неверный код'))

      // The API stores the verified Supabase session in secure cookies.
      // Existing accounts can still add a second role (partner) without creating
      // a duplicate account or replacing their realtor profile.
      const requestedType = new URLSearchParams(window.location.search).get('type')
      if(data.profileExists && requestedType !== 'partner'){
        if(!offer?.version) throw new Error(t('Amaldagi oferta yuklanmadi. Sahifani yangilang.','Не удалось загрузить действующую оферту. Обновите страницу.'))
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if(!user) throw new Error(t('Sessiya topilmadi. Qayta kirib ko‘ring.','Сессия не найдена. Войдите снова.'))
        const { data: acceptedOffer, error: acceptedOfferError } = await supabase
          .from('offer_consents').select('id').eq('user_id', user.id)
          .eq('offer_version', offer.version).eq('audience', accountType === 'partner' ? 'partner' : 'public').eq('marketing_consent', true).maybeSingle()
        if(acceptedOfferError) throw acceptedOfferError
        if(acceptedOffer){ completeLogin(); return }
        setOfferAcceptanceOnly(true)
        setVerified(true)
        setMessage(t('Davom etish uchun yangilangan ommaviy ofertani qabul qiling.','Чтобы продолжить, примите обновлённую публичную оферту.'))
        return
      }

      if (data.profileExists && requestedType === 'partner') {
        const profileResponse = await fetch('/api/account/profile', { cache: 'no-store', credentials: 'same-origin' })
        const profileData = await profileResponse.json().catch(() => ({}))
        if (!profileResponse.ok || !profileData.profile) throw new Error(profileData.error || t('Mavjud profilni yuklab bo‘lmadi.','Не удалось загрузить существующий профиль.'))
        const existing = profileData.profile
        setAccountType('partner')
        setForm({
          ...emptyForm,
          fullName: existing.full_name || '',
          companyName: existing.company_name || '',
          inn: existing.inn || '',
          bankName: existing.bank_name || '',
          bankAccount: existing.bank_account || '',
          mfo: existing.mfo || '',
          directorFullName: existing.director_full_name || '',
        })
      }

      setCode(otpCode)
      setVerified(true)
      stopOtpRef.current?.(); stopOtpRef.current=null
      setMessage(data.profileExists
        ? t('Mavjud akkauntingizga hamkor rolini qo‘shish uchun ma’lumotlarni to‘ldiring.','Заполните данные, чтобы добавить роль партнёра к существующему аккаунту.')
        : t('Telefon raqami tasdiqlandi. Endi profil ma’lumotlarini kiriting.','Номер телефона подтверждён. Теперь заполните данные профиля.'))
    }catch(e){
      submitGuardRef.current.finish()
      setMessage(e instanceof Error?e.message:t('Tasdiqlashda xatolik','Ошибка подтверждения'))
    }finally{setLoading(false)}
  }


  function isTelegramMiniApp(){
    const telegram = (window as Window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
    return Boolean(telegram?.initData || /Telegram/i.test(navigator.userAgent))
  }

  async function installRoyalHousePwa(){
    if(installPrompt){
      try {
        await installPrompt.prompt()
        const choice = await installPrompt.userChoice
        if(choice.outcome === 'accepted') setMessage(t('RoyalHouse ilovasi o‘rnatilmoqda.','Приложение RoyalHouse устанавливается.'))
      } catch {
        setMessage(t('O‘rnatish oynasini ochib bo‘lmadi. Saytni Chrome yoki Safari’da oching.','Не удалось открыть установку. Откройте сайт в Chrome или Safari.'))
      } finally { setInstallPrompt(null) }
      return
    }
    const url = `${window.location.origin}/account/login`
    const telegram = (window as Window & { Telegram?: { WebApp?: { openLink?: (url: string) => void } } }).Telegram?.WebApp
    if(telegram?.openLink){
      telegram.openLink(url)
      setIosInstallHelp(/iPhone|iPad|iPod/i.test(navigator.userAgent))
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
    setIosInstallHelp(/iPhone|iPad|iPod/i.test(navigator.userAgent))
  }

  async function loginWithPasskey(){
    if(isTelegramMiniApp()){
      setTelegramPasskeyHelpOpen(true)
      return
    }
    if(!browserSupportsWebAuthn()){
      setMessage(t('Bu brauzer Passkey’ni qo‘llab-quvvatlamaydi. RoyalHouse’ni Chrome yoki Safari’da oching yoki SMS orqali kiring.','Этот браузер не поддерживает Passkey. Откройте RoyalHouse в Chrome или Safari либо войдите по SMS.'))
      return
    }
    setLoading(true);setMessage('')
    try{
      const optionsResponse=await fetch('/api/auth/passkey/options',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({})})
      const options=await optionsResponse.json()
      if(!optionsResponse.ok) throw new Error(options.error==='PASSKEY_NOT_AVAILABLE'?t('Ushbu qurilmada RoyalHouse uchun Passkey topilmadi. SMS orqali kiring.','На этом устройстве не найден Passkey для RoyalHouse. Войдите по SMS.'):options.error||'PASSKEY_OPTIONS_FAILED')
      const assertion=await startAuthentication({optionsJSON:options})
      const verifyResponse=await fetch('/api/auth/passkey/verify',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({challenge:options.challenge,response:assertion})})
      const result=await verifyResponse.json()
      if(!verifyResponse.ok) throw new Error(result.error||'PASSKEY_LOGIN_FAILED')
      const supabase=createClient()
      const {data:{user}}=await supabase.auth.getUser()
      if(!user) throw new Error(t('Sessiya yaratilmadi. SMS orqali kirib ko‘ring.','Сессия не создана. Попробуйте войти по SMS.'))
      if(!offer?.version) throw new Error(t('Amaldagi oferta yuklanmadi. Sahifani yangilang.','Не удалось загрузить действующую оферту. Обновите страницу.'))
      const {data:acceptedOffer,error:acceptedOfferError}=await supabase.from('offer_consents').select('id')
        .eq('user_id',user.id).eq('offer_version',offer.version).eq('audience', accountType === 'partner' ? 'partner' : 'public').eq('marketing_consent',true).maybeSingle()
      if(acceptedOfferError) throw acceptedOfferError
      if(acceptedOffer){completeLogin();return}
      const {data:profile}=await supabase.from('profiles').select('phone').eq('id',user.id).maybeSingle()
      if(profile?.phone) setPhone(profile.phone)
      setVerified(true)
      setOfferAcceptanceOnly(true)
      setMessage(t('Davom etish uchun yangilangan ommaviy ofertani qabul qiling.','Чтобы продолжить, примите обновлённую публичную оферту.'))
    }catch(e){
      const cancelled = e instanceof Error && e.name === 'NotAllowedError'
      setMessage(cancelled
        ? t('Passkey oynasi bekor qilindi. Telefon raqamingizni kiriting va SMS orqali davom eting.','Вход через Passkey отменён. Введите номер телефона и продолжите по SMS.')
        : e instanceof Error ? e.message : t('Passkey orqali kirishda xatolik.','Ошибка входа через Passkey.'))
    }finally{setLoading(false)}
  }

  async function sendCode(){
    const normalizedPhone=phone.replace(/\s/g,'')
    if(normalizedPhone.length<13) return setMessage(t('Telefon raqamini to‘liq kiriting.','Введите полный номер телефона.'))
    setLoading(true);setMessage('')
    stopOtpRef.current?.(); stopOtpRef.current=null
    submitGuardRef.current.reset()
    setCode('')

    stopOtpRef.current=listenForSmsOtp({
      onCode:(otp)=>{
        const normalized=normalizeCode(otp)
        if(normalized.length===6) setCode(normalized)
      },
      onError:(error)=>console.debug('[otp-autofill] WebOTP unavailable',error),
    })

    try{
      const response=await fetch('/api/auth/send-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:normalizedPhone})})
      const data=await response.json()
      if(!response.ok) throw new Error(data.error||t('SMS yuborilmadi','SMS не отправлено'))
      setSent(true);setMessage(data.testMode?t('Google Play test rejimi faol. Play Console tekshiruv ko‘rsatmasidagi kodni kiriting.','Тестовый режим Google Play включён. Введите код из инструкций Play Console.') : t('SMS kodi yuborildi.','SMS-код отправлен.'))
      window.setTimeout(()=>otpInputRef.current?.focus(),50)
    }catch(e){
      stopOtpRef.current?.(); stopOtpRef.current=null
      setMessage(e instanceof Error?e.message:t('SMS yuborishda xatolik','Ошибка отправки SMS'))
    }finally{setLoading(false)}
  }

  function handleOtpInput(raw:string){ setCode(normalizeCode(raw).slice(0,6)) }
  function handleOtpKeyDown(event:React.KeyboardEvent<HTMLInputElement>){
    if(event.key==='Backspace' && code.length>0){ event.preventDefault(); setCode(code.slice(0,-1)) }
  }

  useEffect(()=>{
    if(!sent || verified || !isComplete(Array.from({length:6},(_,i)=>code[i]||''))) return
    const normalized=normalizeCode(code)
    if(normalized.length!==6) return
    if(!submitGuardRef.current.tryStart(normalized)) return
    void verifyCode(normalized)
  },[code,sent,verified])

  async function finishRegistration(e:FormEvent){
    e.preventDefault()
    if(!verified) return setMessage(t('Avval telefon raqamini tasdiqlang.','Сначала подтвердите номер телефона.'))
    if(offer?.audience !== selectedAudience) return setMessage(t('Oferta yuklanmoqda. Biroz kuting.','Оферта загружается. Подождите немного.'))
    if(!offer?.version) return setMessage(t('Ommaviy oferta yuklanmadi. Sahifani yangilang va qayta urinib ko‘ring.','Публичная оферта не загружена. Обновите страницу va qayta urinib ko‘ring.'))
    setLoading(true);setMessage('')
    let registrationStage = 'session'
    try{
      const supabase=createClient()
      const {data:{user}}=await supabase.auth.getUser()
      if(!user) throw new Error(t('Sessiya topilmadi. Qayta kirib ko‘ring.','Сессия не найдена. Войдите снова.'))
      const normalizedPhone=phone.replace(/\s/g,'')
      registrationStage = 'profile_lookup'
      const {data:existingProfile,error:existingProfileError}=await supabase.from('profiles').select('id').eq('id',user.id).maybeSingle()
      if(existingProfileError) throw existingProfileError
      registrationStage = 'profile_upsert'
      const {error:profileError}=await supabase.from('profiles').upsert({id:user.id,phone:normalizedPhone,account_type:accountType,partner_type:accountType==='partner'?partnerType:null,full_name:form.fullName.trim(),company_name:form.companyName.trim()||null,inn:form.inn.trim()||null,bank_name:form.bankName.trim()||null,bank_account:form.bankAccount.trim()||null,mfo:form.mfo.trim()||null,director_full_name:form.directorFullName.trim()||null},{onConflict:'id'})
      if(profileError) throw profileError

      // If registration was opened from a referral link, bind that referral
      // only after the user's profile exists. The database prevents self-referrals
      // and changing an already claimed referral.
      const currentParams = new URLSearchParams(window.location.search)
      const nextPath = currentParams.get('next') || ''
      const referralCode = currentParams.get('ref') || new URLSearchParams(nextPath.split('?')[1] || '').get('code')
      if (referralCode) {
        registrationStage = 'referral_claim'
        const { error: referralError } = await supabase.rpc('claim_referral_code', { p_code: referralCode })
        if (referralError && !/REFERRAL_ALREADY_CLAIMED/i.test(referralError.message)) throw referralError
      }

      registrationStage = 'consent_lookup'
      const {data:existingConsent,error:consentLookupError}=await supabase.from('offer_consents').select('id').eq('user_id',user.id).eq('offer_version',offer.version).eq('audience', accountType === 'partner' ? 'partner' : 'public').eq('marketing_consent',true).maybeSingle()
      if(consentLookupError) throw consentLookupError
      if(!existingConsent){
        registrationStage = 'consent_insert'
        const {error:consentError}=await supabase.from('offer_consents').insert({user_id:user.id,phone:normalizedPhone,offer_version:offer.version,audience:accountType === 'partner' ? 'partner' : 'public',marketing_consent:true})
        if(consentError) throw consentError
      }
      completeLogin()
    }catch(e){
      const err = e && typeof e === 'object' ? e as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown } : null
      const code = typeof err?.code === 'string' ? err.code : ''
      const detail = typeof err?.message === 'string' ? err.message : e instanceof Error ? e.message : ''
      console.error('[registration] finish failed', { stage: registrationStage, code, message: detail, details: err?.details, hint: err?.hint })
      const stageLabel: Record<string, string> = { referral_claim: t('taklif kodini biriktirish', 'привязка кода приглашения'), session: t('sessiyani olish', 'получение сессии'), profile_lookup: t('mavjud profilni tekshirish', 'проверка существующего профиля'), profile_upsert: t('profilni bazaga yozish', 'сохранение профиля в базе'), consent_lookup: t('oferta roziligini tekshirish', 'проверка согласия с офертой'), consent_insert: t('oferta roziligini saqlash', 'сохранение согласия с офертой') }
      if(code === '23505' && /phone/i.test(detail + ' ' + String(err?.details || ''))){ setMessage(t('Bu telefon raqami avval boshqa profilga biriktirilgan. Eski akkaunt orqali kiring yoki yordam xizmatiga murojaat qiling.','Этот телефонный номер уже привязан к другому профилю. Войдите в прежний аккаунт или обратитесь в поддержку.'))
      } else if(code === '23505'){ setMessage(t('Bu ma’lumot bilan profil avval ro‘yxatdan o‘tgan. Sahifani yangilang va qayta kiring.','Профиль с такими данными уже зарегистрирован. Обновите страницу va qayta urinib ko‘ring.'))
      } else if(code === '42501' || /row-level security|permission denied/i.test(detail)){ setMessage(t(`Ruxsat xatosi: ${stageLabel[registrationStage] || registrationStage}. ${detail || code}`, `Ошибка доступа: ${stageLabel[registrationStage] || registrationStage}. ${detail || code}`))
      } else if(detail){ setMessage(detail) } else { setMessage(t('Ro‘yxatdan o‘tishda xatolik. Sahifani yangilang va qayta urinib ko‘ring.','Ошибка регистрации. Sahifani yangilang va qayta urinib ko‘ring.')) }
    } finally { setLoading(false) }
  }

  async function acceptCurrentOffer(e:FormEvent){
    e.preventDefault()
    if(!verified || !offer?.version || offer.audience !== selectedAudience) return setMessage(t('Amaldagi oferta yuklanmadi. Sahifani yangilang.','Не удалось загрузить действующую оферту. Обновите страницу.'))
    setLoading(true);setMessage('')
    try{
      const supabase=createClient()
      const {data:{user}}=await supabase.auth.getUser()
      if(!user) throw new Error(t('Sessiya topilmadi. Qayta kirib ko‘ring.','Сессия не найдена. Войдите снова.'))
      const {data:existingConsent,error:consentLookupError}=await supabase.from('offer_consents')
        .select('id').eq('user_id',user.id).eq('offer_version',offer.version).eq('marketing_consent',true).maybeSingle()
      if(consentLookupError) throw consentLookupError
      if(!existingConsent){
        const normalizedPhone=phone.replace(/\s/g,'')
        const {error:consentError}=await supabase.from('offer_consents').insert({
          user_id:user.id,phone:normalizedPhone,offer_version:offer.version,audience:accountType === 'partner' ? 'partner' : 'public',marketing_consent:true,
        })
        if(consentError) throw consentError
      }
      completeLogin()
    }catch(error){
      setMessage(error instanceof Error?error.message:t('Oferta roziligini saqlashda xatolik.','Ошибка сохранения согласия с офертой.'))
    }finally{setLoading(false)}
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl"><Link href="/" className="text-sm font-semibold text-emerald-700">← Royalhouse</Link><div className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h1 className="text-3xl font-extrabold text-slate-900">{offerAcceptanceOnly?t('Ommaviy ofertani tasdiqlash','Подтверждение публичной оферты'):verified?t('Profilni to‘ldirish','Заполнить профиль'):t('Royalhouse’ga kirish','Вход в Royalhouse')}</h1><p className="mt-2 text-slate-500">{offerAcceptanceOnly?t('Telefon raqamingiz tasdiqlandi. Davom etish uchun ofertani qabul qiling.','Номер телефона подтверждён. Примите оферту, чтобы продолжить.'):verified?t('Telefon raqamingiz tasdiqlandi.','Номер телефона подтверждён.'):t('Telefon raqamingiz orqali davom eting.','Продолжите с помощью номера телефона.')}</p>

    {!verified && <form onSubmit={e=>{e.preventDefault();void (sent ? verifyCode() : sendCode())}} className="mt-6 space-y-5"><div><label className="mb-2 block text-sm font-semibold">{t('Telefon raqami','Номер телефона')}</label><div className="flex gap-2"><input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" autoComplete="tel" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3"/><button type="button" disabled={loading} onClick={sendCode} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{sent?t('Qayta yuborish','Отправить повторно'):t('SMS yuborish','SMS отправить')}</button></div>{!sent&&<button type="button" disabled={loading} onClick={()=>void loginWithPasskey()} className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-800 disabled:opacity-50">{t('🔐 Passkey bilan kirish','🔐 Войти с Passkey')}</button>}<div className="mt-3 rounded-lg border border-slate-800 bg-white px-3 py-2 text-center text-xs leading-4 text-slate-700 sm:text-sm"><span>{t('Davom etish orqali siz e’lonlar, platforma yangiliklari va reklama xabarlarini, jumladan Telegram orqali olish shartlari ham kiritilgan ','Продолжая, вы принимаете публичную оферту, включая условия объявлений, новостей платформы и рекламных сообщений, в том числе через Telegram: ')}</span><button type="button" onClick={()=>setOfferOpen(true)} className="font-semibold underline underline-offset-2 hover:text-emerald-700">{t(accountType === 'partner' ? 'Hamkorlik ofertasi shartlariga' : 'Ommaviy Oferta Shartlariga', accountType === 'partner' ? 'условиям оферты для партнёров' : 'условия Публичной оферты')}</button><span>{t(' rozilik bildirasiz.','.')}</span></div></div>{sent&&<div><label className="mb-2 block text-sm font-semibold">{t('SMS kodi','SMS-код')}</label><input ref={otpInputRef} value={code} onChange={e=>handleOtpInput(e.target.value)} onInput={e=>handleOtpInput(e.currentTarget.value)} onKeyDown={handleOtpKeyDown} type="text" inputMode="numeric" autoComplete="one-time-code" name="one-time-code" enterKeyHint="done" pattern="[0-9]*" aria-label={t('SMS kodi','SMS-код')} autoFocus disabled={loading} className="h-14 w-full rounded-xl border border-slate-200 bg-white px-5 text-center text-2xl font-bold tracking-[0.55em] text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="••••••" /></div>}{message&&<div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div>}{sent&&<button type="submit" disabled={loading} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{loading?t('Tekshirilmoqda...','Проверка...'):t('Kirish','Войти')}</button>}</form>}

    {verified && offerAcceptanceOnly && <form onSubmit={acceptCurrentOffer} className="mt-6 space-y-5">
      <div className="rounded-2xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">{offer?.title} · {t('Versiya','Версия')} {offer?.version}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t('RoyalHouse xizmatlaridan foydalanishni davom ettirish uchun yangilangan ommaviy oferta shartlarini ko‘rib chiqing. Oferta e’lonlar, platforma yangiliklari, reklama materiallari va maxsus takliflarni, shu jumladan Telegram orqali tarqatishni qamrab oladi.','Чтобы продолжить пользоваться RoyalHouse, ознакомьтесь с обновлённой публичной офертой. Она охватывает объявления, новости платформы, рекламные материалы и специальные предложения, в том числе через Telegram.')}</p>
        <button type="button" onClick={()=>setOfferOpen(true)} className="mt-3 font-semibold text-emerald-700 underline">{t(accountType === 'partner' ? 'Hamkorlik ofertasini ko‘rish' : 'Ommaviy ofertani ko‘rish', accountType === 'partner' ? 'Открыть оферту для партнёров' : 'Открыть публичную оферту')}</button>
      </div>
      {message&&<div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div>}
      <button disabled={loading} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{loading?t('Saqlanmoqda...','Сохранение...'):t(accountType === 'partner' ? 'Hamkorlik ofertasini qabul qilish va davom etish' : 'Ommaviy ofertani qabul qilish va davom etish', accountType === 'partner' ? 'Принять оферту для партнёров и продолжить' : 'Принять публичную оферту и продолжить')}</button>
    </form>}

    {verified && !offerAcceptanceOnly && <><div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={()=>setAccountType('individual')} className={`rounded-lg px-4 py-3 text-sm font-bold ${accountType==='individual'?'bg-white text-slate-900 shadow-sm':'text-slate-500'}`}>{t('Jismoniy shaxs','Физическое лицо')}</button><button type="button" onClick={()=>setAccountType('partner')} className={`rounded-lg px-4 py-3 text-sm font-bold ${accountType==='partner'?'bg-white text-emerald-700 shadow-sm':'text-slate-500'}`}>{t('Hamkor','Партнёр')}</button></div><form onSubmit={finishRegistration} className="mt-6 space-y-5">{accountType==='individual'?<div><label className="mb-2 block text-sm font-semibold">F.I.O.</label><input value={form.fullName} onChange={e=>update('fullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder={t('Ism Familiya Otasining ismi','Имя Фамилия Отчество')}/></div>:<><div><label className="mb-2 block text-sm font-semibold">{t('Hamkor turi','Тип партнёра')}</label><select value={partnerType} onChange={e=>setPartnerType(e.target.value as PartnerType)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="self_employed">{t('O‘zini o‘zi band qilgan — O‘BQ','Самозанятый — O‘BQ')}</option><option value="sole_proprietor">{t('Yakka tartibdagi tadbirkor — YaTT','Индивидуальный предприниматель — ИП')}</option><option value="llc">{t('Mas’uliyati cheklangan jamiyat — MChJ','Общество с ограниченной ответственностью — ООО')}</option></select></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-semibold">F.I.O.</label><input value={form.fullName} onChange={e=>update('fullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div><label className="mb-2 block text-sm font-semibold">INN</label><input value={form.inn} onChange={e=>update('inn',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div></div>{partnerType==='llc'&&<div><label className="mb-2 block text-sm font-semibold">{t('Tashkilot nomi','Название организации')}</label><input value={form.companyName} onChange={e=>update('companyName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div>}<div><label className="mb-2 block text-sm font-semibold">{t('Rahbar F.I.O.','Ф.И.О. руководителя')}</label><input value={form.directorFullName} onChange={e=>update('directorFullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div className="rounded-2xl border border-slate-200 p-4"><h2 className="font-bold">{t('Bank rekvizitlari','Банковские реквизиты')}</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><input value={form.bankName} onChange={e=>update('bankName',e.target.value)} required placeholder={t('Bank nomi','Название банка')} className="rounded-xl border border-slate-200 px-4 py-3"/><input value={form.mfo} onChange={e=>update('mfo',e.target.value)} required placeholder="MFO" className="rounded-xl border border-slate-200 px-4 py-3"/><input value={form.bankAccount} onChange={e=>update('bankAccount',e.target.value)} required placeholder={t('Hisob raqami','Расчётный счёт')} className="rounded-xl border border-slate-200 px-4 py-3"/></div></div></>}{message&&<div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div>}<button type="button" onClick={()=>setOfferOpen(true)} className="text-sm font-semibold text-emerald-700 underline">{t(accountType === 'partner' ? 'Hamkorlik ofertasi bilan tanishing' : 'Ommaviy oferta bilan tanishing', accountType === 'partner' ? 'Ознакомиться с офертой для партнёров' : 'Ознакомиться с публичной офертой')}</button><button disabled={loading || offer?.audience !== selectedAudience} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{loading?t('Saqlanmoqda...','Сохранение...'):t('Ro‘yxatdan o‘tish','Зарегистрироваться')}</button></form></>}
  </div></div>
  {offerOpen&&offer&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true"><div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-lg font-extrabold text-slate-900">{offer.title}</h2><p className="text-xs text-slate-400">Versiya {offer.version}</p></div><button type="button" onClick={()=>setOfferOpen(false)} className="rounded-full px-3 py-2 text-xl text-slate-500">×</button></div><div className="overflow-y-auto px-5 py-5 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{localizedOfferContent}</div><div className="border-t border-slate-100 px-5 py-4 text-right"><button type="button" onClick={()=>setOfferOpen(false)} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">{t('Yopish','Закрыть')}</button></div></div></div>}
    {telegramPasskeyHelpOpen && <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="telegram-passkey-title"><section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">🔐</div><h2 id="telegram-passkey-title" className="text-center text-xl font-extrabold text-slate-900">{t('Passkey orqali kirish Telegram ichida ishlamaydi','Вход по Passkey не работает внутри Telegram')}</h2><p className="mt-3 text-center text-sm leading-6 text-slate-600">{t('Biometrik kirishdan foydalanish uchun RoyalHouse’ni telefoningizga ilova sifatida o‘rnating yoki saytni Chrome yoki Safari brauzerida oching. Shunda Face ID, barmoq izi yoki qurilma PIN-kodi yordamida SMS-kodsiz xavfsiz kirishingiz mumkin.','Чтобы использовать биометрический вход, установите RoyalHouse на телефон как приложение или откройте сайт в Chrome либо Safari. После этого вы сможете безопасно входить без SMS с помощью Face ID, отпечатка пальца или PIN-кода устройства.')}</p><div className="mt-5 space-y-3"><button type="button" onClick={()=>void installRoyalHousePwa()} className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-extrabold text-white shadow-sm">{t('RoyalHouse ilovasini o‘rnatish','Установить приложение RoyalHouse')}</button><div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{t('Android: Chrome menyusidan “Ilovani o‘rnatish” yoki “Bosh ekranga qo‘shish”ni tanlang. iPhone: Safari’da “Ulashish” → “Bosh ekranga qo‘shish”ni tanlang.','Android: в меню Chrome выберите «Установить приложение» или «Добавить на главный экран». iPhone: в Safari выберите «Поделиться» → «На экран Домой».')}</div>{iosInstallHelp && <p className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">{t('Safari’da sahifani ochgach, Ulashish tugmasini bosing va “Bosh ekranga qo‘shish”ni tanlang.','Открыв страницу в Safari, нажмите «Поделиться» и выберите «На экран Домой».')}</p>}<button type="button" onClick={()=>setTelegramPasskeyHelpOpen(false)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">{t('SMS orqali kirish','Войти по SMS')}</button></div></section></div>}
  </main>
}
