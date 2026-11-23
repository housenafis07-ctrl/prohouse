'use client'

import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

export default function RealtorCabinetNav() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, rr: string) => ru ? rr : uz
  return (
    <nav aria-label={t('Rieltor kabineti navigatsiyasi','Навигация кабинета риелтора')} className="flex flex-wrap items-center gap-2">
      <Link href="/realtors/cabinet/dashboard" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">← {t('Rieltor kabineti','Кабинет риелтора')}</Link>
      <Link href="/account" className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">{t('Asosiy shaxsiy kabinet','Основной личный кабинет')}</Link>
      <Link href="/account/referrals?from=realtor" className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">{t('Do‘stni taklif qilish','Пригласить друга')}</Link>
      <Link href="/realtors/tariffs" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">{t('Tariflar','Тарифы')}</Link>
    </nav>
  )
}
