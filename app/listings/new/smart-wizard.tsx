'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { getListingImageStoragePath, isAcceptedListingImage, LISTING_IMAGE_ACCEPT, LISTING_IMAGE_BUCKET, LISTING_IMAGE_MAX_SIZE } from '@/utils/listing-images'

type Category = { code:string; parent_code:string|null; name_uz:string; name_ru:string|null; section_code:string; listing_type:string|null; property_type:string|null; entity_type:string; is_listable:boolean; is_mortgage_filter:boolean; sort_order:number }
type Attribute = { id:string; category_code:string; code:string; name_uz:string; name_ru:string|null; data_type:string; options:unknown; unit:string|null; is_required:boolean; sort_order:number }
type ImageItem = { file:File; preview:string }
type Answer = { city:string; district:string; address:string; rooms:string; area_m2:string; price:string; currency:string; title:string; description:string; fullName:string; phone:string; attributes:Record<string,string> }

const initial:Answer = { city:'Toshkent',district:'',address:'',rooms:'',area_m2:'',price:'',currency:'UZS',title:'',description:'',fullName:'',phone:'+998 ',attributes:{} }
const phoneDigits=(v:string)=>v.replace(/\D/g,'')
const isResidential=(c:Category|null)=>!!c && /apartment|house|residential|new_building|dacha|cottage/i.test([c.property_type,c.code,c.name_uz].join(' '))
const money=(v:string)=>v.replace(/\D/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,' ')
const toTitle=(c:Category|null,a:Answer)=>[c?.name_uz||'Ko‘chmas mulk',a.rooms? a.rooms+' xonali':'',a.district||a.city].filter(Boolean).join(' — ')

export default function SmartListingWizard(){
 const router=useRouter()
 const params=useSearchParams()
 const db=useMemo(()=>createClient(),[])
 const [categories,setCategories]=useState<Category[]>([])
 const [attributes,setAttributes]=useState<Attribute[]>([])
 const [allowedCategories,setAllowedCategories]=useState<Set<string>>(new Set())
 const [loading,setLoading]=useState(true)
 const [selected,setSelected]=useState<Category|null>(null)
 const [restrictedSelection,setRestrictedSelection]=useState<Category|null>(null)
 const [answers,setAnswers]=useState<Answer>(initial)
 const [images,setImages]=useState<ImageItem[]>([])
 const [question,setQuestion]=useState(0)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [otpSent,setOtpSent]=useState(false)
 const [otp,setOtp]=useState('')
 const [success,setSuccess]=useState('')

 const requiredAttributes=useMemo(()=>attributes.filter(x=>x.category_code===selected?.code&&x.is_required&&!['rooms','area_m2'].includes(x.code)),[attributes,selected])
 const questions=useMemo(()=>{
  const q=['category','location']
  if(selected && isResidential(selected)) q.push('rooms')
  if(selected && !/land|plot/i.test([selected.code,selected.property_type].join(' '))) q.push('area')
  q.push('price','images')
  requiredAttributes.forEach(x=>q.push('attr:'+x.code))
  q.push('name','phone')
  return q
 },[selected,requiredAttributes])
 const current=questions[question]||'category'

 useEffect(()=>{let live=true;(async()=>{
  try{
   const [{data:cats,error:ce},{data:attrs,error:ae}]=await Promise.all([
    db.from('listing_categories').select('code,parent_code,name_uz,name_ru,section_code,listing_type,property_type,entity_type,is_listable,is_mortgage_filter,sort_order').eq('is_active',true).eq('is_listable',true).eq('entity_type','property').neq('section_code','services').order('sort_order'),
    db.from('category_attributes').select('id,category_code,code,name_uz,name_ru,data_type,options,unit,is_required,sort_order').eq('is_active',true).order('sort_order'),
   ])
   if(ce) throw ce
   if(ae) throw ae
   if(!live)return
   const list=(cats||[]) as Category[]
   const {data:{user}}=await db.auth.getUser()
   let partnerType='owner'
   if(user){
    const {data:profile,error:profileError}=await db.from('profiles').select('account_type,partner_type').eq('id',user.id).maybeSingle()
    if(profileError) throw profileError
    if(profile?.account_type==='partner'){
     const {data:partnerProfile}=await db.from('partner_profiles').select('partner_type').eq('user_id',user.id).maybeSingle()
     partnerType=partnerProfile?.partner_type||(['owner','realtor','agency','developer','contractor','service_provider'].includes(profile.partner_type||'')?profile.partner_type!:'realtor')
    }
   }
   const {data:permissions,error:permissionError}=await db.from('partner_category_permissions').select('category_code').eq('partner_type',partnerType).eq('can_create',true)
   if(permissionError) throw permissionError
   setCategories(list);setAttributes((attrs||[]) as Attribute[]);setAllowedCategories(new Set((permissions||[]).map((x:any)=>x.category_code)))
   const requested=params.get('taxonomy')
   if(requested){const found=list.find(x=>x.code===requested);if(found){setSelected(found);setQuestion(1)}}
  }catch(e){if(live)setError(e instanceof Error?e.message:'E’lon turlarini yuklashda xatolik.')}
  finally{if(live)setLoading(false)}
 })();return()=>{live=false}},[db,params])

 useEffect(()=>()=>images.forEach(x=>URL.revokeObjectURL(x.preview)),[images])

 const set=(key:keyof Answer,value:string)=>setAnswers(x=>({...x,[key]:value}))
 const restricted=(c:Category)=>!allowedCategories.has(c.code)
 const chooseCategory=(c:Category)=>{
  if(restricted(c)){setRestrictedSelection(c);setError('');return}
  setRestrictedSelection(null);setSelected(c);setQuestion(1);setError('')
 }
 const addImages=(event:ChangeEvent<HTMLInputElement>)=>{
  const files=Array.from(event.target.files||[]);event.target.value=''
  if(images.length+files.length>10){setError('Maksimal 10 ta rasm yuklash mumkin.');return}
  const invalid=files.find(f=>!isAcceptedListingImage(f)||f.size>LISTING_IMAGE_MAX_SIZE)
  if(invalid){setError('Faqat JPG, PNG, WebP yoki GIF formatidagi, 10 MB gacha rasmlar yuklanadi.');return}
  setImages(old=>[...old,...files.map(file=>({file,preview:URL.createObjectURL(file)}))])
 }
 const removeImage=(index:number)=>setImages(old=>old.filter((_,i)=>i!==index))
 const validate=()=>{
  if(current==='category'&&!selected)return 'Avval e’lon turini tanlang.'
  if(current==='location'&&(!answers.city||!answers.district.trim()))return 'Shahar va tuman/shaharni kiriting.'
  if(current==='rooms'&&!answers.rooms.trim())return 'Xonalar sonini kiriting.'
  if(current==='area'&&(!answers.area_m2||Number(answers.area_m2)<=0))return 'Maydonni to‘g‘ri kiriting.'
  if(current==='price'&&(!answers.price||Number(phoneDigits(answers.price))<=0))return 'Narxni to‘g‘ri kiriting.'
  if(current==='images'&&!images.length)return 'Kamida bitta rasm yuklang.'
  if(current.startsWith('attr:')&&!answers.attributes[current.slice(5)]?.trim())return 'Bu maydonni to‘ldiring.'
  if(current==='name'&&answers.fullName.trim().split(/\s+/).length<2)return 'Ism va familiyangizni kiriting.'
  if(current==='phone'&&phoneDigits(answers.phone).length!==12)return 'Telefon raqamini +998XXXXXXXXX formatida kiriting.'
  return ''
 }
 const next=()=>{const v=validate();if(v){setError(v);return}setError('');if(current==='phone'){void sendCode();return}setQuestion(x=>Math.min(questions.length-1,x+1))}
 const back=()=>{setError('');setQuestion(x=>Math.max(0,x-1))}
 const sendCode=async()=>{
  setBusy(true)
  try{
   const response=await fetch('/api/auth/send-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:answers.phone})})
   const data=await response.json()
   if(!response.ok)throw new Error(data.error||'SMS yuborilmadi.')
   setOtpSent(true);setError('SMS kodi yuborildi. 6 xonali kodni kiriting.')
  }catch(e){setError(e instanceof Error?e.message:'SMS yuborishda xatolik.')}finally{setBusy(false)}
 }
 const submit=async()=>{
  if(!/^\d{6}$/.test(otp)){setError('SMS kodini 6 xonali kiriting.');return}
  setBusy(true);setError('')
  const uploaded:string[]=[]
  try{
   const verify=await fetch('/api/auth/verify-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:answers.phone,code:otp})})
   const verified=await verify.json()
   if(!verify.ok)throw new Error(verified.error||'SMS tasdiqlanmadi.')
   const {data:{user},error:userError}=await db.auth.getUser()
   if(userError||!user)throw new Error('Tasdiqlangan foydalanuvchi sessiyasi topilmadi.')
   const {data:existing,error:profileLookupError}=await db.from('profiles').select('id,account_type,full_name,phone').eq('id',user.id).maybeSingle()
   if(profileLookupError)throw profileLookupError
   const {error:profileError}=await db.from('profiles').upsert({
    id:user.id,phone:answers.phone.replace(/\s/g,''),full_name:answers.fullName.trim(),
    account_type:existing?.account_type||'individual',
   },{onConflict:'id'})
   if(profileError)throw profileError
   const title=answers.title.trim()||toTitle(selected,answers)
   const description=answers.description.trim()||[
    selected?.name_uz||'Ko‘chmas mulk',
    answers.rooms?answers.rooms+' xona':'',
    answers.area_m2?answers.area_m2+' m²':'',
    answers.address,answers.district,answers.city,
   ].filter(Boolean).join('. ')
   const attrs={...answers.attributes,...(answers.rooms?{rooms:answers.rooms}:{}),...(answers.area_m2?{area_m2:answers.area_m2}:{}),ownership_type:'owner'}
   const payload={
    taxonomy_code:selected?.code,listing_type:selected?.listing_type||'sale',property_type:selected?.property_type||'apartment',
    title,description,price:phoneDigits(answers.price),currency:answers.currency,city:answers.city,district:answers.district,address:answers.address,
    area_m2:answers.area_m2,rooms:answers.rooms,attributes:attrs,ownership_type:'owner',
   }
   const draft=await fetch('/api/listings/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({step:7,data:payload,status:'draft'})})
   const draftData=await draft.json()
   if(!draft.ok)throw new Error(draftData.message||draftData.error||'E’lon qoralamasi saqlanmadi.')
   const listingId=draftData.listing.id
   const rows=[]
   for(let i=0;i<images.length;i++){
    const file=images[i].file
    const path=getListingImageStoragePath(user.id,listingId,file.name)
    const {error:uploadError}=await db.storage.from(LISTING_IMAGE_BUCKET).upload(path,file,{cacheControl:'31536000',upsert:false})
    if(uploadError)throw uploadError
    uploaded.push(path)
    const publicUrl=db.storage.from(LISTING_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
    rows.push({listing_id:listingId,image_url:publicUrl,storage_path:path,sort_order:i,size_bytes:file.size,mime_type:file.type})
   }
   if(rows.length){const {error:imageError}=await db.from('listing_images').insert(rows);if(imageError)throw imageError}
   const publish=await fetch('/api/listings/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({listingId,step:7,data:payload,status:'moderation'})})
   const publishData=await publish.json()
   if(!publish.ok)throw new Error(publishData.message||publishData.error||'E’lon moderatsiyaga yuborilmadi.')
   setSuccess('E’lon moderatsiyaga yuborildi: '+(publishData.listing.listing_code||publishData.listing.id))
   setTimeout(()=>router.push('/account/listings'),1000)
  }catch(e){
   if(uploaded.length)await db.storage.from(LISTING_IMAGE_BUCKET).remove(uploaded).catch(()=>{})
   setError(e instanceof Error?e.message:'E’lonni saqlashda xatolik.')
  }finally{setBusy(false)}
 }

 const attribute= current.startsWith('attr:')?requiredAttributes.find(x=>x.code===current.slice(5)):null
 const progress=Math.round(((question+1)/questions.length)*100)
 if(loading)return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-2xl rounded-3xl bg-white p-10 text-center">E’lon turlari yuklanmoqda…</div></main>
 return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10"><div className="mx-auto max-w-2xl">
  <header className="mb-5 flex items-center justify-between"><Link href="/" className="text-lg font-black text-slate-900">Royal<span className="text-emerald-600">House</span></Link><div className="flex items-center gap-3"><Link href="/listings/new/service" className="text-xs font-semibold text-emerald-700">Hamkorlar uchun xizmat e’loni</Link><Link href="/account" className="text-sm font-semibold text-slate-500">Shaxsiy kabinet</Link></div></header>
  <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
   <div className="border-b border-slate-100 px-5 py-5 sm:px-7"><div className="flex items-center justify-between text-xs font-bold text-slate-500"><span>SMART E’LON YORDAMCHISI</span><span>{question+1}/{questions.length}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{width:progress+'%'}}/></div><h1 className="mt-4 text-2xl font-black text-slate-950">E’loningizni birgalikda tayyorlaymiz</h1><p className="mt-1 text-sm text-slate-500">Uzun forma yo‘q — savollarga ketma-ket javob bering.</p></div>
   <div className="space-y-5 px-5 py-6 sm:px-7">
    {selected&&<div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><b>{selected.name_uz}</b><span className="ml-2 text-emerald-700">E’lon turi tanlandi</span></div>}
    {restrictedSelection&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-lg font-extrabold text-amber-950">Bu e’lonni faqat hamkorlar joylashtira oladi</h2><p className="mt-2 text-sm leading-6 text-amber-900">“{restrictedSelection.name_uz}” e’loni jismoniy shaxslar uchun mavjud emas. Davom etish uchun hamkor sifatida ro‘yxatdan o‘ting. Kerakli hamkor ma’lumotlari keyingi bosqichda so‘raladi.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>router.push('/register?type=partner&next='+encodeURIComponent('/listings/new/smart?taxonomy='+restrictedSelection.code))} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Hamkor bo‘lish</button><button onClick={()=>setRestrictedSelection(null)} className="rounded-xl border border-amber-300 px-5 py-3 text-sm font-bold text-amber-950">Boshqa e’lon turini tanlash</button></div></div>}
    {current==='category'&&!restrictedSelection&&<div><h2 className="text-lg font-extrabold">Nimani ijaraga yoki sotuvga qo‘ymoqchisiz?</h2><p className="mt-1 text-sm text-slate-500">Avval e’lon turini tanlang. Ayrim yo‘nalishlar faqat hamkorlar uchun.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{categories.filter(c=>!c.parent_code).map(parent=><div key={parent.code} className="sm:col-span-2"><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">{parent.name_uz}</p><div className="grid gap-2 sm:grid-cols-2">{categories.filter(c=>c.parent_code===parent.code).map(c=><button key={c.code} onClick={()=>chooseCategory(c)} className="rounded-xl border border-slate-200 p-3 text-left text-sm font-bold hover:border-emerald-500 hover:bg-emerald-50">{c.name_uz}{restricted(c)&&<span className="mt-1 block text-xs font-semibold text-amber-700">Faqat hamkorlar uchun</span>}</button>)}</div></div>)}</div>{!categories.some(c=>c.parent_code)&&<div className="grid gap-2 sm:grid-cols-2">{categories.map(c=><button key={c.code} onClick={()=>chooseCategory(c)} className="rounded-xl border p-3 text-left text-sm font-bold hover:border-emerald-500">{c.name_uz}{restricted(c)&&<span className="block text-xs text-amber-700">Faqat hamkorlar uchun</span>}</button>)}</div>}</div>}
    {current==='location'&&<div><h2 className="text-lg font-extrabold">Qayerda joylashgan?</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Viloyat / shahar<input value={answers.city} onChange={e=>set('city',e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" placeholder="Toshkent viloyati"/></label><label className="text-sm font-bold">Tuman / shahar<input value={answers.district} onChange={e=>set('district',e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" placeholder="Yangiyo‘l"/></label></div><label className="mt-3 block text-sm font-bold">Ko‘cha, mahalla, mo‘ljal (ixtiyoriy)<input value={answers.address} onChange={e=>set('address',e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" placeholder="Manzilni batafsil yozing"/></label></div>}
    {current==='rooms'&&<div><h2 className="text-lg font-extrabold">Nechta xona?</h2><input type="number" min="0" value={answers.rooms} onChange={e=>set('rooms',e.target.value)} className="mt-4 w-full rounded-xl border p-4 text-lg" placeholder="Masalan: 3"/></div>}
    {current==='area'&&<div><h2 className="text-lg font-extrabold">Maydoni qancha?</h2><div className="mt-4 flex items-center gap-3"><input type="number" min="1" value={answers.area_m2} onChange={e=>set('area_m2',e.target.value)} className="w-full rounded-xl border p-4 text-lg" placeholder="Masalan: 85"/><span className="font-bold text-slate-500">m²</span></div></div>}
    {current==='price'&&<div><h2 className="text-lg font-extrabold">Narxi qancha?</h2><div className="mt-4 flex gap-2"><input inputMode="numeric" value={answers.price} onChange={e=>set('price',money(e.target.value))} className="min-w-0 flex-1 rounded-xl border p-4 text-lg" placeholder="Masalan: 750 000 000"/><select value={answers.currency} onChange={e=>set('currency',e.target.value)} className="rounded-xl border px-3"><option value="UZS">so‘m</option><option value="USD">$</option></select></div></div>}
    {current==='images'&&<div><h2 className="text-lg font-extrabold">Rasmlarni yuklang</h2><p className="mt-1 text-sm text-slate-500">10 tagacha rasm. Birinchi rasm asosiy rasm bo‘ladi.</p><label className="mt-4 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-8 text-sm font-bold text-slate-600 hover:border-emerald-500"><input type="file" accept={LISTING_IMAGE_ACCEPT} multiple onChange={addImages} className="hidden"/>+ Rasmlarni tanlash</label><div className="mt-3 grid grid-cols-3 gap-2">{images.map((im,i)=><div key={im.preview} className="relative"><img src={im.preview} className="aspect-square w-full rounded-xl object-cover"/><button onClick={()=>removeImage(i)} className="absolute right-1 top-1 rounded-full bg-white px-2 py-1">×</button></div>)}</div></div>}
    {attribute&&<div><h2 className="text-lg font-extrabold">{attribute.name_uz}{attribute.unit?' ('+attribute.unit+')':''}</h2><input type={attribute.data_type==='number'?'number':'text'} value={answers.attributes[attribute.code]||''} onChange={e=>setAnswers(x=>({...x,attributes:{...x.attributes,[attribute.code]:e.target.value}}))} className="mt-4 w-full rounded-xl border p-4" placeholder="Javobingiz"/></div>}
    {current==='name'&&<div><h2 className="text-lg font-extrabold">Ism va familiyangiz nima?</h2><input value={answers.fullName} onChange={e=>set('fullName',e.target.value)} className="mt-4 w-full rounded-xl border p-4 text-lg" placeholder="Masalan: Ali Valiyev"/><p className="mt-2 text-xs text-slate-500">Bu ma’lumot shaxsiy profilingizda saqlanadi.</p></div>}
    {current==='phone'&&<div><h2 className="text-lg font-extrabold">Telefon raqamingizni tasdiqlang</h2><input value={answers.phone} onChange={e=>set('phone',e.target.value)} type="tel" className="mt-4 w-full rounded-xl border p-4 text-lg" placeholder="+998 90 123 45 67"/>{otpSent&&<div className="mt-4"><label className="text-sm font-bold">SMS kodi</label><input value={otp} onChange={e=>setOtp(phoneDigits(e.target.value).slice(0,6))} inputMode="numeric" autoComplete="one-time-code" className="mt-2 w-full rounded-xl border p-4 text-center text-2xl tracking-[.4em]" placeholder="000000"/></div>}</div>}
    {error&&<div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {success&&<div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
    <div className="flex items-center justify-between border-t border-slate-100 pt-4"><button onClick={back} disabled={question===0||busy} className="rounded-xl border px-5 py-3 text-sm font-bold disabled:opacity-40">Orqaga</button>{current==='phone'&&otpSent?<button onClick={()=>void submit()} disabled={busy} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Tekshirilmoqda…':'Tasdiqlash va e’lonni yuborish'}</button>:<button onClick={next} disabled={busy} className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Yuborilmoqda…':current==='phone'?'SMS kod yuborish':'Davom etish'}</button>}</div>
   </div>
  </section>
  <p className="mt-4 text-center text-xs text-slate-400">Telefon raqami faqat oxirida SMS orqali tasdiqlanadi. Ma’lumotlaringiz e’lon va profilga saqlanadi.</p>
 </div></main>
}
