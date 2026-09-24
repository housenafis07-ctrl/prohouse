'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ListingDetailLanguageFix from './ListingDetailLanguageFix'
import RentalBookingCalendar from '@/app/components/RentalBookingCalendar'
import { useI18n } from '@/app/components/I18nProvider'

export default function ListingDetailLayout({ children }: { children: ReactNode }) {
  const params=useParams<{id:string}>(); const {lang}=useI18n(); const [meta,setMeta]=useState<{listingType:string;isOwner:boolean}|null>(null)
  useEffect(()=>{let mounted=true;(async()=>{const db=createClient();const [{data:{user}},{data}]=await Promise.all([db.auth.getUser(),db.from('listings').select('listing_type,owner_id').eq('id',params.id).maybeSingle()]);if(mounted&&data)setMeta({listingType:data.listing_type,isOwner:Boolean(user&&data.owner_id===user.id)})})();return()=>{mounted=false}},[params.id])
  return <>
    {children}
    <ListingDetailLanguageFix />
    {meta?.listingType==='rent'&&<div className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6"><RentalBookingCalendar listingId={params.id} listingType="rent" isOwner={meta.isOwner} lang={lang}/></div>}
  </>
}
