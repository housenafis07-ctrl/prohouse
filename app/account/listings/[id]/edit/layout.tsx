'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import RentalBookingCalendar from '@/app/components/RentalBookingCalendar'

export default function EditListingLayout({ children }:{children:ReactNode}){
  const params=useParams<{id:string}>(); const [meta,setMeta]=useState(false)
  useEffect(()=>{let mounted=true;(async()=>{const db=createClient();const {data:{user}}=await db.auth.getUser();if(!user)return;const {data}=await db.from('listings').select('listing_type').eq('id',params.id).eq('owner_id',user.id).maybeSingle();if(mounted&&data?.listing_type==='rent')setMeta(true)})();return()=>{mounted=false}},[params.id])
  return <>{children}{meta&&<div className="mx-auto max-w-4xl px-4 pb-10"><RentalBookingCalendar listingId={params.id} listingType="rent" isOwner lang="uz"/></div>}</>
}
