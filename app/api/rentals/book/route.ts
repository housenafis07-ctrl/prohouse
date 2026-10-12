import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

const parseRental=(draft:any)=>{const attrs=draft?.attributes||{};const raw=attrs?.rental_booking;try{const parsed=typeof raw==='string'?JSON.parse(raw||'{}'):(raw&&typeof raw==='object'?raw:{});return Object.keys(parsed).length?parsed:attrs}catch{return attrs}}
const addDays=(d:string,n:number)=>{const x=new Date(`${d}T00:00:00Z`);x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)}
const eachDay=(from:string,to:string)=>{const out:string[]=[];for(let d=from;d<to;d=addDays(d,1))out.push(d);return out}
const isWeekend=(date:string)=>{const day=new Date(`${date}T00:00:00Z`).getUTCDay();return day===0||day===6}
const num=(value:any)=>Number(String(value??'').replace(/\s/g,''))||0
const extraGuestSettings=(settings:any)=>{const fee=num(settings.extra_guest_fee??settings.extra_guest_price??settings.additional_guest_price??settings.extra_person_price??settings.extra_guest_charge??settings.september_extra_guest_price??settings.october_extra_guest_price);const included=num(settings.included_guests??settings.included_guest_count??settings.guests_included??settings.base_guests)||(fee>0?num(settings.max_guests):0);return {fee,included}}
const seasonalPrice=(settings:any,weekday:boolean,month:number)=>{const monthName=month===8?'september':month===9?'october':'';const seasonal=monthName?(weekday?settings[`${monthName}_weekday_price`]:settings[`${monthName}_weekend_price`]):undefined;return num(seasonal)||num(weekday?settings.weekday_price:settings.weekend_price)}
const paymeUrl=(merchantId:string,bookingId:string,amount:number,callback:string)=>{const raw=Object.entries({m:merchantId,'ac.order_id':bookingId,a:String(Math.round(amount*100)),l:'uz',c:callback,ct:'15000',cr:'860'}).map(([k,v])=>`${k}=${v}`).join(';');return `https://checkout.paycom.uz/${Buffer.from(raw,'utf8').toString('base64')}`}
export async function POST(request:NextRequest){
 try{
  const auth=await createClient();const {data:{user}}=await auth.auth.getUser();if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401})
  const body=await request.json();const listingId=String(body.listingId||'');const checkIn=String(body.checkIn||'');const checkOut=String(body.checkOut||'');const guests=Math.max(1,Number(body.guests||1))
  if(!listingId||!/^(?:\d{4})-\d{2}-\d{2}$/.test(checkIn)||!/^(?:\d{4})-\d{2}-\d{2}$/.test(checkOut)||checkOut<=checkIn)return NextResponse.json({error:'Sanalar noto‘g‘ri tanlangan'},{status:400})
  const merchantId=process.env.PAYME_MERCHANT_ID?.trim()
  if(!merchantId||!process.env.PAYME_MERCHANT_KEY?.trim())return NextResponse.json({error:'PAYMENT_NOT_CONFIGURED: Payme to‘lov sozlamalari to‘liq emas. Bron yaratilmadi.'},{status:503})
  const db=serviceClient();const {data:listing,error}=await db.from('listings').select('id,owner_id,status,listing_type,taxonomy_code,price,currency,draft_data').eq('id',listingId).eq('status','active').maybeSingle();if(error)throw error;if(!listing)return NextResponse.json({error:'E’lon topilmadi'},{status:404})
  if(listing.owner_id===user.id)return NextResponse.json({error:'O‘z e’loningizni bron qila olmaysiz'},{status:400})
  if(!(listing.listing_type==='daily'||listing.taxonomy_code==='rent_dacha'))return NextResponse.json({error:'Bu e’lon uchun bron mavjud emas'},{status:400})
  if((listing.currency||'UZS')!=='UZS')return NextResponse.json({error:'Payme orqali faqat UZS valyutasida to‘lash mumkin'},{status:400})
  const settings=parseRental(listing.draft_data);const maxGuests=num(settings.max_guests);const {fee:extraGuestFee,included:includedGuests}=extraGuestSettings(settings)
  if(maxGuests>0&&extraGuestFee<=0&&guests>maxGuests)return NextResponse.json({error:`Mehmonlar soni ${maxGuests} tadan oshmasin`},{status:400})
  const requested=eachDay(checkIn,checkOut);const blocked=new Set<string>(settings.blocked_dates||[]);if(requested.some(d=>blocked.has(d)))return NextResponse.json({error:'Tanlangan sanalardan biri band yoki yopiq'},{status:409})
  const now=new Date();const expiry=new Date(now.getTime()-20*60*1000).toISOString()
  const {data:overlap,error:overlapError}=await db.from('rental_bookings').select('id').eq('listing_id',listingId).or(`status.eq.confirmed,and(status.eq.pending_payment,payment_expires_at.gt.${now.toISOString()})`).lt('check_in',checkOut).gt('check_out',checkIn).limit(1);if(overlapError)throw overlapError
  if(overlap?.length)return NextResponse.json({error:'Tanlangan sanalar allaqachon band'},{status:409})
  const prices=settings.date_prices||{};const extraGuests=Math.max(0,guests-includedGuests)
  const total=requested.reduce((sum,d)=>{const override=num(prices[d]);const weekday=!isWeekend(d);const fallback=seasonalPrice(settings,weekday,new Date(`${d}T00:00:00Z`).getUTCMonth());const base=override||fallback||num(listing.price);return sum+base+(extraGuestFee*extraGuests)},0)
  if(!Number.isFinite(total)||total<=0)return NextResponse.json({error:'Bron summasi noto‘g‘ri hisoblandi'},{status:400})
  const depositPercent=10;const depositAmount=Math.round(total*depositPercent/100);if(depositAmount<=0)return NextResponse.json({error:'Avans summasi noto‘g‘ri'},{status:400})
  const paymentExpiresAt=new Date(Date.now()+20*60*1000).toISOString()
  const {data:booking,error:insertError}=await db.from('rental_bookings').insert({listing_id:listingId,guest_id:user.id,check_in:checkIn,check_out:checkOut,guests,currency:'UZS',total_amount:total,deposit_percent:depositPercent,deposit_amount:depositAmount,payment_provider:'payme',payment_status:'pending',status:'pending_payment',payment_expires_at:paymentExpiresAt}).select('id,check_in,check_out,total_amount,deposit_percent,deposit_amount,currency,status,payment_provider').single()
  if(insertError)throw insertError
  const siteUrl=(process.env.NEXT_PUBLIC_SITE_URL||process.env.APP_URL||new URL(request.url).origin).replace(/\/$/,'')
  const callback=`${siteUrl}/listings/${encodeURIComponent(listingId)}?booking=${encodeURIComponent(booking.id)}`
  const checkoutUrl=paymeUrl(merchantId,booking.id,depositAmount,callback)
  return NextResponse.json({booking,bookingId:booking.id,totalAmount:total,depositAmount,depositPercent,currency:'UZS',paymentStatus:'pending',checkoutUrl,paymentProvider:'payme',includedGuests,extraGuestFee,extraGuests})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Bron qilishda xatolik'},{status:500})}
}
