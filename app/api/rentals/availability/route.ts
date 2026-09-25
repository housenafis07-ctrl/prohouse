import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

const parseRental=(draft:any)=>{const raw=draft?.attributes?.rental_booking;try{return typeof raw==='string'?JSON.parse(raw||'{}'):(raw&&typeof raw==='object'?raw:{})}catch{return {}}}
const addDays=(d:string,n:number)=>{const x=new Date(`${d}T00:00:00Z`);x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)}
const eachDay=(from:string,to:string)=>{const out:string[]=[];for(let d=from;d<=to;d=addDays(d,1))out.push(d);return out}
const isWeekend=(date:string)=>{const day=new Date(`${date}T00:00:00Z`).getUTCDay();return day===0||day===6}
export async function GET(request:NextRequest){
 try{
  const listingId=request.nextUrl.searchParams.get('listingId');const from=request.nextUrl.searchParams.get('from');const to=request.nextUrl.searchParams.get('to')
  if(!listingId||!from||!to)return NextResponse.json({error:'listingId, from, to required'},{status:400})
  const db=serviceClient();const {data:listing,error}=await db.from('listings').select('id,status,listing_type,taxonomy_code,price,currency,draft_data').eq('id',listingId).eq('status','active').maybeSingle();if(error)throw error;if(!listing)return NextResponse.json({error:'E’lon topilmadi'},{status:404})
  const rental=listing.listing_type==='daily'||listing.taxonomy_code==='rent_dacha';if(!rental)return NextResponse.json({error:'Rental calendar is only available for daily rental listings'},{status:400})
  const settings=parseRental(listing.draft_data);const {data:bookings,error:bookingError}=await db.from('rental_bookings').select('check_in,check_out,status,payment_status').eq('listing_id',listingId).in('status',['pending_payment','confirmed']).lt('check_in',addDays(to,1)).gt('check_out',from);if(bookingError)throw bookingError
  const booked=new Set<string>();for(const b of bookings||[]){for(const d of eachDay(b.check_in,addDays(b.check_out,-1)))booked.add(d)}
  const blocked=new Set<string>(settings.blocked_dates||[]);const prices=settings.date_prices||{};const days=eachDay(from,to).map(date=>{const weekend=isWeekend(date);const override=prices[date]?Number(prices[date]):null;const fallback=weekend?Number(settings.weekend_price||0):Number(settings.weekday_price||0);const price=override||fallback||Number(listing.price||0);return {date,status:booked.has(date)?'booked':blocked.has(date)?'blocked':'free',price,priceType:override?'date':fallback?(weekend?'weekend':'weekday'):'base'}})
  return NextResponse.json({listingId,currency:listing.currency,depositPercent:Number(settings.deposit_percent||15),days})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Availability error'},{status:500})}
}
