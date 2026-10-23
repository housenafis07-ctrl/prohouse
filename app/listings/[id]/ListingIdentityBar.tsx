'use client'

import { useI18n } from '@/app/components/I18nProvider'

export default function ListingIdentityBar({ listingCode, partnerCode, ownerId }: { listingCode: string | null; partnerCode: string | null; ownerId: string }) {
  const { lang } = useI18n()
  return <div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center gap-2 px-4 text-xs font-bold text-slate-500">
    <span className="rounded-full bg-slate-100 px-3 py-1.5">{lang === 'ru' ? 'ID объявления' : 'E’lon ID'}: <b className="text-slate-800">{listingCode || ownerId}</b></span>
    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">{lang === 'ru' ? 'ID партнёра' : 'Hamkor ID'}: <b>{partnerCode || ownerId}</b></span>
  </div>
}
