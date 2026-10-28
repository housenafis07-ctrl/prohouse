'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

type Profile = {
  phone: string | null
  full_name: string | null
  account_type: 'individual' | 'partner' | null
  email?: string | null
  instagram_url?: string | null
  facebook_url?: string | null
  linkedin_url?: string | null
  telegram_url?: string | null
}

type Props = {
  profile: Profile
  ru: boolean
  completion: number
  telegramLinked: boolean
  telegramUsername: string | null
  telegramBusy: boolean
  telegramLinkUrl: string
  telegramError: string
  onTelegramLink: () => void
}

function Check({ done }: { done: boolean }) {
  return done
    ? <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-black text-white">✓</span>
    : <span className="h-5 w-5 shrink-0 rounded-md border-2 border-slate-300 bg-white" aria-hidden="true" />
}

function Item({ done, title, hint, href }: { done: boolean; title: string; hint?: string; href?: string }) {
  const body = <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50"><Check done={done} /><span className="min-w-0 flex-1"><b className="block truncate text-[12px] font-black text-slate-800">{title}</b>{hint && <small className="block truncate text-[10px] text-slate-400">{hint}</small>}</span></div>
  return href ? <Link href={href}>{body}</Link> : body
}

export default function ProfileStatusChecklist({ profile, ru, completion, telegramLinked, telegramUsername, telegramBusy, telegramLinkUrl, telegramError, onTelegramLink }: Props) {
  const [businessPlan, setBusinessPlan] = useState<{ product_code: string; company_profile: boolean } | null>(null)
  const [trustedStatus, setTrustedStatus] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const supabase = createClient()
      if (profile.account_type === 'partner') {
        const { data } = await supabase.rpc('get_active_partner_plan')
        if (mounted) setBusinessPlan(Array.isArray(data) && data[0] ? data[0] : null)
      } else if (mounted) {
        setBusinessPlan(null)
      }
      const { data: partner } = await supabase.from('partner_profiles').select('trusted_partner_status').eq('user_id', (await supabase.auth.getUser()).data.user?.id || '').maybeSingle()
      if (mounted) setTrustedStatus(partner?.trusted_partner_status || null)
    }
    void load()
    return () => { mounted = false }
  }, [profile.account_type])

  const companyEnabled = Boolean(businessPlan?.company_profile)
  const businessPlanLabel = useMemo(() => {
    if (!businessPlan?.product_code) return ru ? 'Business tarifini tanlang' : 'Business tarifini tanlang'
    return businessPlan.product_code.replace(/^partner_/, '').replace(/^./, (v) => v.toUpperCase())
  }, [businessPlan, ru])

  const checklist = [
    { title: ru ? 'Основные данные' : 'Asosiy ma’lumotlar', done: Boolean(profile.full_name?.trim()), hint: ru ? 'Ф.И.О.' : 'F.I.O.', href: '#profile-data' },
    { title: ru ? 'Номер телефона' : 'Telefon raqam', done: Boolean(profile.phone?.trim()), hint: profile.phone || (ru ? 'Не указан' : 'Kiritilmagan'), href: '#profile-data' },
    { title: 'Telegram', done: telegramLinked, hint: telegramLinked ? (telegramUsername ? `@${telegramUsername.replace(/^@/, '')}` : (ru ? 'Подключён' : 'Ulangan')) : (ru ? 'Подключить уведомления' : 'Bildirishnomalarni ulash') },
    { title: ru ? 'Надёжный партнёр' : 'Ishonchli hamkor', done: trustedStatus === 'verified', hint: trustedStatus === 'verified' ? (ru ? 'Подтверждён' : 'Tasdiqlangan') : (ru ? 'Пройти проверку' : 'Tekshiruvdan o‘ting'), href: '/account/trusted-profile' },
    { title: ru ? 'Профиль компании' : 'Firma profili', done: companyEnabled, hint: companyEnabled ? businessPlanLabel : (ru ? 'Доступно с Business' : 'Business tarifida ochiladi'), href: companyEnabled ? '/account/company-profile' : '/account/monetization' },
    { title: ru ? 'Социальные сети' : 'Ijtimoiy tarmoqlar', done: Boolean(profile.instagram_url || profile.facebook_url || profile.linkedin_url || profile.telegram_url), hint: ru ? 'Instagram / Facebook / LinkedIn' : 'Instagram / Facebook / LinkedIn', href: '#profile-data' },
    { title: ru ? 'Email' : 'Email manzillar', done: Boolean(profile.email?.trim()), hint: profile.email || (ru ? 'Добавьте email' : 'Email manzilini kiriting'), href: '#profile-data' },
  ]

  const doneCount = checklist.filter((item) => item.done).length
  const percent = Math.round((doneCount / checklist.length) * 100)

  return (
    <section className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="text-base font-black">{ru ? 'Статус профиля' : 'Profil holati'}</h2><p className="mt-1 text-xs text-slate-500">{ru ? 'Профиль и возможности' : 'Profil va imkoniyatlar'}</p></div>
        <span className="text-sm font-black text-emerald-700">{percent}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} /></div>

      <div className="mt-3 divide-y divide-slate-100">
        <Item {...checklist[0]} />
        <Item {...checklist[1]} />
        <div className="rounded-xl px-2 py-2.5">
          <div className="flex items-center gap-3"><Check done={telegramLinked} /><span className="min-w-0 flex-1"><b className="block text-[12px] font-black text-slate-800">Telegram</b><small className="block truncate text-[10px] text-slate-400">{checklist[2].hint}</small></span>{telegramLinked ? <span className="text-[11px] font-black text-emerald-600">✓</span> : <button type="button" onClick={onTelegramLink} disabled={telegramBusy} className="rounded-lg bg-slate-950 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-60">{telegramBusy ? '...' : (ru ? 'Ulash' : 'Ulash')}</button>}</div>
          {!telegramLinked && telegramLinkUrl && <a href={telegramLinkUrl} target="_blank" rel="noreferrer" className="ml-8 mt-1 block text-[10px] font-black text-emerald-700">{ru ? 'Открыть Telegram →' : 'Telegramni ochish →'}</a>}
          {telegramError && <p className="ml-8 mt-1 text-[10px] font-semibold text-rose-600">{telegramError}</p>}
        </div>
        <Item {...checklist[3]} />
        <Item {...checklist[4]} />
        <Item {...checklist[5]} />
        <Item {...checklist[6]} />
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-500">
        {ru ? 'Профиль продавца и заполненные публичные данные могут отображаться покупателям на странице объявления.' : 'Sotuvchi profili va kiritilgan ochiq ma’lumotlar e’lon sahifasida xaridorlarga ko‘rsatilishi mumkin.'}
      </div>
    </section>
  )
}
