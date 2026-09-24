import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

const parseRental=(draft:any)=>{const raw=draft?.attributes?.rental_booking;try{return typeof raw==='string'?JSON.parse(raw||'{}'):(raw&&typeof raw==='object'?raw:{})}catch{return {}}}
const addDays=(d:string,n:number)=>{const x=new Date(`${d}T00:00:00Z`);x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)}
const eachDay=(from:string,to:string)=>{const out:string[]=[];for(let d=from;d<to;d=addDays(d,1))out.push(d);return out}
export async function POST(request:NextRequest){
 try{
  const auth=await createClient();const {data:{user}}=await auth.auth.getUser();if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401})
  const body=await request.json();const listingId=String(body.listingId||'');const checkIn=String(body.checkIn||'');const checkOut=String(body.checkOut||'');const guests=Math.max(1,Number(body.guests||1));const provider=['payme','click','manual'].includes(body.paymentProvider)?body.paymentProvider:'pending'
  if(!listingId||!/^\d{4}-\d{2}-\d{2}$/.test(checkIn)||!/^\d{4}-\d{2}-\d{2}$/.test(checkOut)||checkOut<=checkIn)return NextResponse.json({error:'Sanalar noto‘g‘ri tanlangan'},{status:400})
  const db=serviceClient();const {data:listing,error}=await db.from('listings').select('id,owner_id,status,listing_type,taxonomy_code,price,currency,draft_data').eq('id',listingId).eq('status','active').maybeSingle();if(error)throw error;if(!listing)return NextResponse.json({error:'E’lon topilmadi'},{status:404})
  if(listing.owner_id===user.id)return NextResponse.json({error:'O‘z e’loningizni bron qila olmaysiz'},{status:400})
  const rental=listing.listing_type==='daily'||listing.taxonomy_code==='rent_dacha';if(!rental)return NextResponse.json({error:'Bu e’lon uchun bron mavjud emas'},{status:400})
  const settings=parseRental(listing.draft_data);const maxGuests=Number(settings.max_guests||999);if(guests>maxGuests)return NextResponse.json({error:`Mehmonlar soni ${maxGuests} tadan oshmasin`},{status:400})
  const blocked=new Set<string>(settings.blocked_dates||[]);const requested=eachDay(checkIn,checkOut);if(requested.some(d=>blocked.has(d)))return NextResponse.json({error:'Tanlangan sanalardan biri band yoki yopiq'},{status:409})
  const {data:overlap,error:overlapError}=await db.from('rental_bookings').select('id').eq('listing_id',listingId).in('status',['pending_payment','confirmed']).lt('check_in',checkOut).gt('check_out',checkIn).limit(1);if(overlapError)throw overlapError;if(overlap?.length)return NextResponse.json({error:'Tanlangan sanalar allaqachon band'},{status:409})
  const prices=settings.date_prices||{};const total=requested.reduce((sum,d)=>sum+(Number(prices[d])||Number(listing.price||0)),0);const depositPercent=Number(settings.deposit_percent||15);const depositAmount=Math.round(total*depositPercent/100)
  const {data:booking,error:insertError}=await db.from('rental_bookings').insert({listing_id:listingId,guest_id:user.id,check_in:checkIn,check_out:checkOut,guests,currency:listing.currency||'UZS',total_amount:total,deposit_percent:depositPercent,deposit_amount:depositAmount,payment_provider:provider,payment_status:'pending',status:'pending_payment'}).select('id,check_in,check_out,total_amount,deposit_percent,deposit_amount,currency,status,payment_provider').single();if(insertError)throw insertError
  return NextResponse.json({booking,bookingId:booking.id,totalAmount:total,depositAmount,depositPercent,currency:listing.currency||'UZS',paymentStatus:'pending'})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Bron qilishda xatolik'},{status:500})}
}
