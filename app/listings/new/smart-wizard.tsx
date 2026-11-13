'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import ListingLocationPicker from '@/app/components/ListingLocationPicker'
import RentalBookingSettings from '@/app/components/RentalBookingSettings'
import ListingAIDescriptionAssistant from '@/app/components/ListingAIDescriptionAssistant'
import ListingQualityCard from '@/app/components/ListingQualityCard'
import ListingVideoUploader from '@/app/components/ListingVideoUploader'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'
import { localizeUzbekLocation } from '@/lib/location-translations'
import { getListingImageStoragePath, LISTING_IMAGE_BUCKET, LISTING_IMAGE_MAX_SIZE } from '@/utils/listing-images'

type Category = { code:string; parent_code:string|null; name_uz:string; name_ru:string|null; section_code:string; listing_type:string|null; property_type:string|null; entity_type:string; is_mortgage_filter:boolean; is_new_construction_filter:boolean; sort_order:number }
type Attribute = { id:string; category_code:string; code:string; name_uz:string; name_ru:string|null; data_type:string; options:unknown; unit:string|null; is_required:boolean; sort_order:number }
type ImageItem = { file:File; preview:string }
type VideoState = 'idle' | 'uploading' | 'processing' | 'ready' | 'failed'
type Answer = {
 city:string; district:string; neighborhood:string; address:string; latitude:number|null; longitude:number|null
 title:string; description:string; price:string; currency:string; fullName:string; phone:string
 attributes:Record<string,string>; ownership_type:string; mortgage:string; rental_booking:string
}
const initial:Answer = {
 city:'',district:'',neighborhood:'',address:'',latitude:null,longitude:null,
 title:'',description:'',price:'',currency:'UZS',fullName:'',phone:'+998 ',
 attributes:{},ownership_type:'',mortgage:'',rental_booking:''
}
const phoneDigits=(v:string)=>v.replace(/\D/g,'')
const money=(v:string)=>v.replace(/\D/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,' ')
const isShortRental=(c:Category|null)=>!!c && ['rent_daily','rent_dacha'].includes(c.code)
const sections:Record<string,string>={sale:'Sotish',rent:'Ijara',new_building:'Yangi uylar'}
const getImageDimensions=(file:File):Promise<{width:number|null;height:number|null}>=>new Promise(resolve=>{
 const url=URL.createObjectURL(file);const image=new Image()
 image.onload=()=>{URL.revokeObjectURL(url);resolve({width:image.naturalWidth,height:image.naturalHeight})}
 image.onerror=()=>{URL.revokeObjectURL(url);resolve({width:null,height:null})};image.src=url
})
const optionsFor=(raw:unknown):Array<{value:string;label:string}>=>{
 if(!Array.isArray(raw))return []
 return raw.map((item:any)=>typeof item==='string'?{value:item,label:item}:{
  value:String(item?.value??item?.code??item?.id??item?.label_uz??item?.name_uz??''),
  label:String(item?.label_uz??item?.name_uz??item?.label??item?.name??item?.value??'')
 }).filter(x=>x.value)
}
const titleFrom=(category:Category|null,a:Answer,attrs:Attribute[])=>{
 const details=attrs.filter(x=>['rooms','area_m2'].includes(x.code)).map(x=>a.attributes[x.code]).filter(Boolean)
 return [category?.name_uz||'Ko‘chmas mulk',...details,a.district||a.city].filter(Boolean).join(' — ')
}

export default function SmartListingWizard(){
 const router=useRouter()
 const params=useSearchParams()
 const db=useMemo(()=>createClient(),[])
 const [categories,setCategories]=useState<Category[]>([])
 const [attributes,setAttributes]=useState<Attribute[]>([])
 const [allowedCategories,setAllowedCategories]=useState<Set<string>>(new Set())
 const [loading,setLoading]=useState(true)
 const [selectedSection,setSelectedSection]=useState<string|null>(null)
 const [selected,setSelected]=useState<Category|null>(null)
 const [restrictedSelection,setRestrictedSelection]=useState<Category|null>(null)
 const [answers,setAnswers]=useState<Answer>(initial)
 const [images,setImages]=useState<ImageItem[]>([])
 const imagesRef=useRef<ImageItem[]>([])
 const [mainImage,setMainImage]=useState(0)
 const [question,setQuestion]=useState(0)
 const [error,setError]=useState('')
 const [limitReached,setLimitReached]=useState(false)
 const [busy,setBusy]=useState(false)
 const [otpSent,setOtpSent]=useState(false)
 const [resendCountdown,setResendCountdown]=useState(0)
 const [phoneOtpVerified,setPhoneOtpVerified]=useState(false)
 const [otp,setOtp]=useState('')
 const [verified,setVerified]=useState(false)
 const [listingId,setListingId]=useState<string|null>(null)
 const [videoStatus,setVideoStatus]=useState<VideoState>('idle')
 const [success,setSuccess]=useState('')
 const [videoError,setVideoError]=useState('')
 const [accountProfile,setAccountProfile]=useState<{user_id:string;phone:string;full_name:string;account_type?:string}|null>(null)
 const wizardRef=useRef<HTMLElement|null>(null)
 const [keyboardInset,setKeyboardInset]=useState(0)

 const categoryAttributes=useMemo(()=>attributes.filter(x=>x.category_code===selected?.code&&x.code!=='ownership_type').sort((a,b)=>a.sort_order-b.sort_order),[attributes,selected])
 const region=useMemo(()=>UZBEKISTAN_LOCATIONS.find(x=>x.name===answers.city),[answers.city])
 const districts=region?.districts||[]
 const questions=useMemo(()=>{
  if(!selected)return ['section','category']
  const q=['section','category','city','district']
  // Residential sale listings do not ask for a mahalla or street/house number.
  // Keep both fields in the answer model and payload for backwards compatibility.
  const hideResidentialAddressQuestions=selected.listing_type==='sale'&&['sale_house','sale_apartment'].includes(selected.code)
  if(!hideResidentialAddressQuestions)q.push('neighborhood','address')
  q.push('map')
  categoryAttributes.forEach(a=>q.push('attr:'+a.code))
  if(selected.code==='sale_house')q.push('ownership')
  q.push('title','description','price')
  if(!isShortRental(selected)&&(selected.is_mortgage_filter||selected.listing_type==='sale'||selected.listing_type==='new_building'))q.push('mortgage')
  if(isShortRental(selected))q.push('rental')
  q.push('images','review')
  if(!accountProfile){q.push('phone');if(phoneOtpVerified)q.push('name')}
  return q
 },[selected,categoryAttributes,accountProfile,phoneOtpVerified])
 const current=questions[question]||'section'
 const currentAttribute=current.startsWith('attr:')?categoryAttributes.find(x=>x.code===current.slice(5))||null:null
 const progress=Math.round(((question+1)/questions.length)*100)
 const setAnswer=(key:keyof Answer,value:any)=>setAnswers(x=>({...x,[key]:value}))
 const setAttribute=(code:string,value:string)=>setAnswers(x=>({...x,attributes:{...x.attributes,[code]:value}}))
 const restricted=(c:Category)=>!allowedCategories.has(c.code)
 const chooseCategory=(c:Category)=>{
  if(restricted(c)){setRestrictedSelection(c);setError('');return}
  setRestrictedSelection(null);setSelected(c);setSelectedSection(c.section_code);setQuestion(2);setError('')
 }
 const validate=()=>{
  if(current==='section'&&!selectedSection)return 'E’lon bo‘limini tanlang.'
  if(current==='category'&&!selected)return 'E’lon turini tanlang.'
  if(current==='city'&&!answers.city)return 'Viloyat yoki shaharni tanlang.'
  if(current==='district'&&!answers.district)return 'Tuman yoki shaharni tanlang.'
  if(current==='map'&&(answers.latitude===null||answers.longitude===null))return 'Xaritada mulk joylashuvini belgilang.'
  if(current.startsWith('attr:')&&currentAttribute?.is_required&&!answers.attributes[currentAttribute.code]?.trim())return currentAttribute.name_uz+' maydonini to‘ldiring.'
  if(current==='ownership'&&!['owner','power_of_attorney','representative'].includes(answers.ownership_type))return 'Mulk egaligi turini tanlang.'
  if(current==='title'&&!answers.title.trim())return 'E’lon sarlavhasini kiriting.'
  if(current==='price'&&(!answers.price||!Number.isFinite(Number(phoneDigits(answers.price)))))return 'To‘g‘ri narx kiriting.'
  if(current==='images'&&!images.length)return 'Kamida 1 ta rasm yuklang.'
  if(current==='name'&&answers.fullName.trim().split(/\s+/).length<2)return 'Ism va familiyangizni kiriting.'
  if(current==='phone'&&phoneDigits(answers.phone).length!==12)return 'Telefon raqamini +998XXXXXXXXX formatida kiriting.'
  return ''
 }
 const next=()=>{
  const v=validate();if(v){setError(v);return}
  setError('')
  if(current==='phone'){void sendCode();return}
  setQuestion(x=>Math.min(questions.length-1,x+1))
 }
 const back=()=>{setError('');setQuestion(x=>Math.max(0,x-1))}
 const skip=()=>{
  if(currentAttribute?.is_required){setError('Bu savol majburiy.');return}
  setError('');setQuestion(x=>Math.min(questions.length-1,x+1))
 }
 const addImages=async(event:ChangeEvent<HTMLInputElement>)=>{
  const files=Array.from(event.target.files||[]);event.target.value=''
  if(!files.length)return
  if(images.length+files.length>10){setError('Maksimal 10 ta rasm yuklash mumkin.');return}
  setBusy(true);setError('')
  try{
   const prepared:ImageItem[]=[]
   for(const original of files){
    if(original.size>LISTING_IMAGE_MAX_SIZE)throw new Error(original.name+': rasm hajmi 10 MB dan oshmasligi kerak.')
    const extension=original.name.split('.').pop()?.toLowerCase()||''
    const mimeByExtension:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'}
    const supported=['image/jpeg','image/png','image/webp','image/gif']
    const mime=supported.includes(original.type)?original.type:(mimeByExtension[extension]||original.type||'')
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(mime))throw new Error(original.name+': JPG, PNG yoki WebP formatidagi rasm tanlang. HEIC/HEIF rasmlarni avval JPG formatiga aylantiring.')
    const file=original.type===mime?original:new File([original],original.name,{type:mime,lastModified:original.lastModified})
    const preview=await new Promise<string>((resolve,reject)=>{
     const reader=new FileReader()
     reader.onerror=()=>reject(new Error(original.name+': rasm faylini o‘qib bo‘lmadi.'))
     reader.onload=()=>{const src=String(reader.result||'');const image=new Image();image.onload=()=>image.naturalWidth>0&&image.naturalHeight>0?resolve(src):reject(new Error(original.name+': rasm ochilmadi.'));image.onerror=()=>reject(new Error(original.name+': rasm formati brauzerda ochilmadi. JPG yoki PNG qilib qayta saqlang.'));image.src=src}
     reader.readAsDataURL(file)
    })
    prepared.push({file,preview})
   }
   setImages(old=>[...old,...prepared])
  }catch(e){setError(e instanceof Error?e.message:'Rasmlarni yuklashda xatolik.')}
  finally{setBusy(false)}
 }
 const handlePhoneChange=(value:string)=>{setAnswer('phone',value);if(otpSent){setOtpSent(false);setOtp('');setResendCountdown(0);setSuccess('')}}
 const removeImage=(index:number)=>{const removed=images[index];if(removed)URL.revokeObjectURL(removed.preview);setImages(old=>old.filter((_,i)=>i!==index));setMainImage(0)}
 const payload=()=>{
  const attrs:Record<string,unknown>={}
  for(const definition of categoryAttributes){
   const raw=answers.attributes[definition.code]
   if(raw===undefined||raw==='')continue
   if(definition.data_type==='number')attrs[definition.code]=Number(raw)
   else if(definition.data_type==='boolean')attrs[definition.code]=raw==='true'
   else if(definition.data_type==='multiselect')attrs[definition.code]=raw.split(',').filter(Boolean)
   else attrs[definition.code]=raw
  }
  if(answers.ownership_type)attrs.ownership_type=answers.ownership_type
  if(answers.mortgage)attrs.mortgage=answers.mortgage==='true'
  if(answers.rental_booking)attrs.rental_booking=answers.rental_booking
  return {
   taxonomy_code:selected?.code,listing_type:selected?.listing_type||'sale',property_type:selected?.property_type||'apartment',
   title:answers.title.trim()||titleFrom(selected,answers,categoryAttributes),
   description:answers.description.trim()||null,price:phoneDigits(answers.price),currency:answers.currency,
   city:answers.city,district:answers.district,neighborhood:answers.neighborhood,address:answers.address,
   latitude:answers.latitude,longitude:answers.longitude,
   area_m2:answers.attributes.area_m2||'',rooms:answers.attributes.rooms||'',floor:answers.attributes.floor||'',
   floors_total:answers.attributes.floors_total||'',land_area:answers.attributes.land_area||'',
   attributes:attrs,ownership_type:answers.ownership_type||null,mortgage:answers.mortgage==='true',
  }
 }
 const readApiResponse=async(response:Response)=>{
  const raw=await response.text()
  if(!raw.trim())throw new Error(`Server bo‘sh javob qaytardi (HTTP ${response.status}). Birozdan keyin qayta urinib ko‘ring.`)
  try{return JSON.parse(raw)}catch{
   throw new Error(`Server JSON formatida bo‘lmagan javob qaytardi (HTTP ${response.status}).`)
  }
 }
 useEffect(()=>{
  const viewport=window.visualViewport
  const updateKeyboardInset=()=>{
   if(!viewport){setKeyboardInset(0);return}
   const inset=Math.max(0,Math.round(window.innerHeight-viewport.height-viewport.offsetTop))
   setKeyboardInset(inset>120?inset:0)
  }
  const onFocusIn=(event:FocusEvent)=>{
   const target=event.target
   if(!(target instanceof HTMLElement)||!target.matches('input,textarea,select,[contenteditable="true"]'))return
   window.setTimeout(()=>{
    updateKeyboardInset()
    target.scrollIntoView({block:'center',behavior:'smooth'})
   },250)
  }
  updateKeyboardInset()
  viewport?.addEventListener('resize',updateKeyboardInset)
  viewport?.addEventListener('scroll',updateKeyboardInset)
  const wizard=wizardRef.current
  wizard?.addEventListener('focusin',onFocusIn)
  return ()=>{
   viewport?.removeEventListener('resize',updateKeyboardInset)
   viewport?.removeEventListener('scroll',updateKeyboardInset)
   wizard?.removeEventListener('focusin',onFocusIn)
  }
 },[])
 useEffect(()=>{if(resendCountdown<=0)return;const timer=window.setTimeout(()=>setResendCountdown(value=>Math.max(0,value-1)),1000);return ()=>window.clearTimeout(timer)},[resendCountdown])
 const sendCode=async()=>{
  setBusy(true);setError('')
  try{
   const response=await fetch('/api/auth/send-code',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify({phone:answers.phone})})
   const data=await readApiResponse(response)
   if(!response.ok)throw new Error(data.error||data.message||`SMS yuborilmadi (HTTP ${response.status}).`)
   setOtpSent(true);setOtp('');setResendCountdown(60);setError('SMS kodi yuborildi. 6 xonali kodni kiriting.')
  }catch(e){setError(e instanceof Error?e.message:'SMS yuborishda xatolik.')}finally{setBusy(false)}
 }
 const createDraftAndUploadImages=async(userId:string)=>{
  const uploaded:string[]=[]
  let createdListingId:string|null=null
  try{
   const draft=await fetch('/api/listings/draft',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({step:7,data:payload(),status:'draft'})})
   const draftData=await draft.json()
   if(!draft.ok)throw new Error(draftData.message||draftData.error||'E’lon qoralamasi saqlanmadi.')
   createdListingId=draftData.listing.id
   const ordered=[images[mainImage],...images.filter((_,i)=>i!==mainImage)]
   const rows=[]
   for(let i=0;i<ordered.length;i++){
    const file=ordered[i].file
    const path=getListingImageStoragePath(userId,createdListingId,file.name)
    const upload=await db.storage.from(LISTING_IMAGE_BUCKET).upload(path,file,{cacheControl:'31536000',upsert:false})
    if(upload.error)throw upload.error
    uploaded.push(path)
    const dimensions=await getImageDimensions(file)
    const publicUrl=db.storage.from(LISTING_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
    rows.push({listing_id:createdListingId,image_url:publicUrl,storage_path:path,sort_order:i,width:dimensions.width,height:dimensions.height,size_bytes:file.size,mime_type:file.type})
   }
   if(rows.length){const {error:imageError}=await db.from('listing_images').insert(rows);if(imageError)throw imageError}
   setListingId(createdListingId)
   return createdListingId
  }catch(error){
   if(uploaded.length)await db.storage.from(LISTING_IMAGE_BUCKET).remove(uploaded)
   if(createdListingId)await fetch('/api/listings/draft?listingId='+encodeURIComponent(createdListingId),{method:'DELETE',credentials:'same-origin'}).catch(()=>null)
   throw error
  }
 }
 const saveExistingAccountDraft=async()=>{
  if(!accountProfile)return
  setBusy(true);setError('')
  try{
   const {data:{user},error:userError}=await db.auth.getUser()
   if(userError||!user||user.id!==accountProfile.user_id)throw new Error('Mavjud hisob sessiyasi yangilanmagan. Sahifani yangilang yoki SMS orqali qayta kiring.')
   await createDraftAndUploadImages(user.id)
   setVerified(true)
   setSuccess('Mavjud profilingiz aniqlandi. E’lon qoralamasi saqlandi. Endi videoni qo‘shib yuborishingiz mumkin.')
  }catch(error){setError(error instanceof Error?error.message:'E’lonni saqlashda xatolik.')}
  finally{setBusy(false)}
 }
 const verifyAndSaveDraft=async()=>{
  if(!/^\d{6}$/.test(otp)){setError('SMS kodini 6 xonali kiriting.');return}
  setBusy(true);setError('')
  try{
   const verify=await fetch('/api/auth/verify-code',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify({phone:answers.phone,code:otp})})
   const verifiedData=await readApiResponse(verify);if(!verify.ok)throw new Error(verifiedData.error||'SMS tasdiqlanmadi.')
   const {data:{user},error:userError}=await db.auth.getUser()
   if(userError||!user)throw new Error('Tasdiqlangan foydalanuvchi sessiyasi topilmadi.')
   // OTP may belong to an existing account whose saved name differs from the
   // name entered in this draft. Restore that profile and never overwrite it.
   const existingProfileResponse=await fetch('/api/account/profile',{credentials:'same-origin',cache:'no-store'})
   if(existingProfileResponse.ok){
    const existingProfileData=await readApiResponse(existingProfileResponse)
    const existingProfile=existingProfileData.profile
    if(existingProfile?.user_id===user.id&&existingProfile?.phone){
     setAccountProfile({user_id:existingProfile.user_id,phone:existingProfile.phone,full_name:existingProfile.full_name||'',account_type:existingProfile.account_type||'individual'})
     setAnswers(current=>({...current,phone:existingProfile.phone,fullName:existingProfile.full_name||current.fullName}))
    }else{
     throw new Error('Tasdiqlangan raqam uchun profil ma’lumotlari topilmadi.')
    }
   }else if(existingProfileResponse.status===401){
    setPhoneOtpVerified(true)
    setQuestion(question+1)
    setSuccess('Telefon raqamingiz tasdiqlandi. Endi ism va familiyangizni kiriting.')
    return
   }else{
    const existingProfileError=await readApiResponse(existingProfileResponse)
    throw new Error(existingProfileError.error||'Profilni tekshirishda xatolik.')
   }
   await createDraftAndUploadImages(user.id)
   setVerified(true)
   setQuestion(questions.indexOf('review'))
   setSuccess('Telefon raqamingiz tasdiqlandi. E’lon qoralamasi saqlandi. Video qo‘shishingiz va e’lonni yuborishingiz mumkin.')
  }catch(error){setError(error instanceof Error?error.message:'E’lonni saqlashda xatolik.')}
  finally{setBusy(false)}
 }
 const saveNewProfileAndDraft=async()=>{
  if(!phoneOtpVerified)return
  setBusy(true);setError('')
  try{
   const {data:{user},error:userError}=await db.auth.getUser()
   if(userError||!user)throw new Error('SMS tasdiqlangan sessiya topilmadi. Telefonni qayta tasdiqlang.')
   const profileResponse=await fetch('/api/account/profile',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify({phone:answers.phone,full_name:answers.fullName.trim(),account_type:'individual'})})
   const profileData=await readApiResponse(profileResponse)
   if(!profileResponse.ok)throw new Error(profileData.error||'Profilni saqlab bo‘lmadi.')
   const savedProfileResponse=await fetch('/api/account/profile',{credentials:'same-origin',cache:'no-store'})
   const savedProfileData=await readApiResponse(savedProfileResponse)
   if(!savedProfileResponse.ok||savedProfileData.profile?.user_id!==user.id)throw new Error('Yangi profilni qayta tekshirishda xatolik.')
   setAccountProfile({user_id:user.id,phone:savedProfileData.profile.phone,full_name:savedProfileData.profile.full_name||answers.fullName.trim(),account_type:savedProfileData.profile.account_type||'individual'})
   await createDraftAndUploadImages(user.id)
   setVerified(true)
   setPhoneOtpVerified(false)
   setQuestion(questions.indexOf('review'))
   setSuccess('Profil yaratildi. E’lon qoralamasi saqlandi. Endi videoni qo‘shib, e’lonni yuborishingiz mumkin.')
  }catch(error){setError(error instanceof Error?error.message:'Profilni saqlashda xatolik.')}
  finally{setBusy(false)}
 }
 const publish=async()=>{
  if(!listingId)return
  if(videoStatus==='uploading'||videoStatus==='processing'){setError('Video yuklanishi yoki qayta ishlanishi tugashini kuting.');return}
  setBusy(true);setError('');setLimitReached(false)
  try{
   const response=await fetch('/api/listings/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({listingId,step:7,data:payload(),status:'moderation'})})
   const data=await response.json();if(!response.ok)throw new Error(data.message||data.error||'E’lon moderatsiyaga yuborilmadi.')
   setSuccess('E’lon moderatsiyaga yuborildi: '+(data.listing.listing_code||data.listing.id))
   setTimeout(()=>router.push('/account/listings'),1000)
  }catch(e){
   const message=e instanceof Error?e.message:'E’lonni yuborishda xatolik.'
   if(/(?:PARTNER|REALTOR|INDIVIDUAL|FREE_)?LISTING_LIMIT_REACHED/i.test(message)){
    setLimitReached(true)
    setError('')
   }else setError(message)
  }finally{setBusy(false)}
 }

 useEffect(()=>{let live=true;(async()=>{
  try{
   const response=await fetch('/api/listings/meta?flow=property',{cache:'no-store'});const meta=await response.json()
   if(!response.ok)throw new Error(meta.error||'E’lon turlari yuklanmadi.')
   if(!live)return
   const list=(meta.categories||[]) as Category[]
   const attrs=(meta.attributes||[]) as Attribute[]
   const profile=meta.accountProfile
   if(profile?.user_id&&profile?.phone){
    setAccountProfile({user_id:profile.user_id,phone:profile.phone,full_name:profile.full_name||'',account_type:profile.account_type||'individual'})
    setAnswers(current=>({...current,phone:profile.phone,fullName:profile.full_name||''}))
   }
   setCategories(list);setAttributes(attrs);setAllowedCategories(new Set((meta.allowedCategoryCodes||[]) as string[]))
   const requested=params.get('taxonomy')
   if(requested){const found=list.find(x=>x.code===requested);if(found){setSelected(found);setSelectedSection(found.section_code);setQuestion(2)}}
  }catch(e){if(live)setError(e instanceof Error?e.message:'E’lon turlarini yuklashda xatolik.')}
  finally{if(live)setLoading(false)}
 })();return()=>{live=false}},[db,params])
 useEffect(()=>{imagesRef.current=images},[images])
 useEffect(()=>()=>imagesRef.current.forEach(x=>URL.revokeObjectURL(x.preview)),[])

 const attributeChoiceOptions=(attribute:Attribute)=>{
  const fromDatabase=optionsFor(attribute.options)
  if(fromDatabase.length)return fromDatabase
  const presets:Record<string,Array<{value:string;label:string}>>={
   commercial_type:['Ofis','Do‘kon','Ombor','Ishlab chiqarish binosi','Kafe yoki restoran','Boshqa'].map(x=>({value:x,label:x})),
   purpose:['Turar joy qurish','Tijorat','Qishloq xo‘jaligi','Sanoat','Boshqa'].map(x=>({value:x,label:x})),
   heating:['Markaziy isitish','Gaz','Elektr','Qattiq yoqilg‘i','Konditsioner','Boshqa'].map(x=>({value:x,label:x})),
   finishing:['Qora suvoq','Oq suvoq','Tayyor ta’mir','Ta’mirsiz'].map(x=>({value:x,label:x})),
   utilities:['Elektr','Gaz','Ichimlik suvi','Kanalizatsiya','Internet'].map(x=>({value:x,label:x})),
  }
  return presets[attribute.code]||[]
 }
 const optionList=currentAttribute?attributeChoiceOptions(currentAttribute):[]
 const currentValue=currentAttribute?answers.attributes[currentAttribute.code]||'':''
 const showOptionalSkip=!!currentAttribute&&!currentAttribute.is_required
 if(loading)return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-2xl rounded-3xl bg-white p-10 text-center">E’lon turlari yuklanmoqda…</div></main>
 return <main ref={wizardRef} className="min-h-screen bg-slate-50 px-4 pt-6 pb-36 sm:py-10 sm:pb-10"><div className="mx-auto max-w-2xl">
  <header className="mb-5 flex items-center justify-between"><Link href="/" className="text-lg font-black text-slate-900">Royal<span className="text-emerald-600">House</span></Link><div className="flex items-center gap-3"><Link href="/listings/new/service" className="text-xs font-semibold text-emerald-700">Hamkorlar uchun xizmat e’loni</Link><Link href="/account" className="text-sm font-semibold text-slate-500">Shaxsiy kabinet</Link></div></header>
  <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
   <div className="border-b border-slate-100 px-5 py-5 sm:px-7"><div className="flex items-center justify-between text-xs font-bold text-slate-500"><span>SMART E’LON YORDAMCHISI</span><span>{question+1}/{questions.length}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{width:progress+'%'}}/></div><h1 className="mt-4 text-2xl font-black text-slate-950">E’loningizni birgalikda tayyorlaymiz</h1><p className="mt-1 text-sm text-slate-500">Eski e’lon formasidagi barcha maydonlar savol-javob shaklida beriladi.</p></div>
   <div className="space-y-5 px-5 py-6 sm:px-7">
    {selected&&<div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><b>{selected.name_uz}</b><span className="ml-2 text-emerald-700">E’lon turi tanlandi</span></div>}
    {restrictedSelection&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-lg font-extrabold text-amber-950">Bu e’lonni faqat hamkorlar joylashtira oladi</h2><p className="mt-2 text-sm leading-6 text-amber-900">“{restrictedSelection.name_uz}” e’loni jismoniy shaxslar uchun mavjud emas. Davom etish uchun hamkor sifatida ro‘yxatdan o‘ting. Kerakli hamkor ma’lumotlari keyingi bosqichda so‘raladi.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>router.push('/register?type=partner&next='+encodeURIComponent('/listings/new/smart?taxonomy='+restrictedSelection.code))} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Hamkor bo‘lish</button><button onClick={()=>setRestrictedSelection(null)} className="rounded-xl border border-amber-300 px-5 py-3 text-sm font-bold text-amber-950">Boshqa e’lon turini tanlash</button></div></div>}
    {current==='section'&&<div><h2 className="text-lg font-extrabold">Nimani ijaraga yoki sotuvga qo‘ymoqchisiz?</h2><p className="mt-1 text-sm text-slate-500">Avval e’lon bo‘limini tanlang.</p><div className="mt-4 grid gap-2 sm:grid-cols-3">{Object.entries(sections).map(([code,label])=><button key={code} onClick={()=>{setSelectedSection(code);setSelected(null);setQuestion(1);setError('')}} className={'rounded-xl border p-4 text-left text-sm font-bold '+(selectedSection===code?'border-emerald-600 bg-emerald-50':'border-slate-200')}>{label}</button>)}</div></div>}
    {current==='category'&&!restrictedSelection&&<div><h2 className="text-lg font-extrabold">Qaysi turdagi e’lon joylashtirmoqchisiz?</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{categories.filter(c=>c.parent_code&&c.section_code===selectedSection).map(c=><button key={c.code} onClick={()=>chooseCategory(c)} className="rounded-xl border border-slate-200 p-3 text-left text-sm font-bold hover:border-emerald-500 hover:bg-emerald-50">{c.name_uz}{restricted(c)&&<span className="mt-1 block text-xs font-semibold text-amber-700">Faqat hamkorlar uchun</span>}</button>)}</div></div>}
    {current==='city'&&<div><h2 className="text-lg font-extrabold">Qaysi viloyat yoki shaharda joylashgan?</h2><select value={answers.city} onChange={e=>{setAnswer('city',e.target.value);setAnswer('district','')}} className="mt-4 w-full rounded-xl border p-4"><option value="">Viloyat yoki shaharni tanlang</option>{UZBEKISTAN_LOCATIONS.map(x=><option key={x.name} value={x.name}>{localizeUzbekLocation(x.name,'uz')}</option>)}</select></div>}
    {current==='district'&&<div><h2 className="text-lg font-extrabold">Qaysi tuman yoki shaharda?</h2><select value={answers.district} onChange={e=>setAnswer('district',e.target.value)} disabled={!answers.city} className="mt-4 w-full rounded-xl border p-4 disabled:bg-slate-100"><option value="">{answers.city?'Tumanni tanlang':'Avval viloyat yoki shaharni tanlang'}</option>{districts.map(x=><option key={x} value={x}>{localizeUzbekLocation(x,'uz')}</option>)}</select></div>}
    {current==='neighborhood'&&<div><h2 className="text-lg font-extrabold">Qaysi mahalla yoki massivda joylashgan?</h2><input value={answers.neighborhood} onChange={e=>setAnswer('neighborhood',e.target.value)} className="mt-4 w-full rounded-xl border p-4" placeholder="Mahalla yoki massiv nomi"/><p className="mt-2 text-xs text-slate-500">Ixtiyoriy savol — javob bermasdan o‘tishingiz mumkin.</p></div>}
    {current==='address'&&<div><h2 className="text-lg font-extrabold">Ko‘cha va uy manzili?</h2><input value={answers.address} onChange={e=>setAnswer('address',e.target.value)} className="mt-4 w-full rounded-xl border p-4" placeholder="Ko‘cha, uy raqami yoki mo‘ljal"/><p className="mt-2 text-xs text-slate-500">Ixtiyoriy savol.</p></div>}
    {current==='map'&&<div><h2 className="text-lg font-extrabold">Xaritada aniq joylashuvini belgilang</h2><p className="mt-1 text-sm text-slate-500">Bu eski e’lon formasidagi majburiy xarita maydonidir.</p><div className="mt-4"><ListingLocationPicker latitude={answers.latitude} longitude={answers.longitude} onChange={(latitude,longitude)=>setAnswers(x=>({...x,latitude,longitude}))}/></div></div>}
    {currentAttribute&&<div><h2 className="text-lg font-extrabold">{currentAttribute.name_uz}{currentAttribute.unit?' ('+currentAttribute.unit+')':''}</h2><p className="mt-1 text-sm text-slate-500">{currentAttribute.is_required?'Bu maydon majburiy.':'Bu maydon ixtiyoriy — javob bermasdan o‘tishingiz mumkin.'}</p>{(currentAttribute.data_type==='select'||optionList.length>0)&&currentAttribute.code!=='utilities'&&<select value={currentValue} onChange={e=>setAttribute(currentAttribute.code,e.target.value)} className="mt-4 w-full rounded-xl border p-4"><option value="">Tanlang</option>{optionList.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>}{(currentAttribute.data_type==='multiselect'||currentAttribute.code==='utilities')&&<div className="mt-4 grid gap-2 sm:grid-cols-2">{optionList.map(o=><label key={o.value} className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={currentValue.split(',').filter(Boolean).includes(o.value)} onChange={e=>{const selectedValues=currentValue.split(',').filter(Boolean);setAttribute(currentAttribute.code,e.target.checked?[...selectedValues,o.value].join(','):selectedValues.filter(v=>v!==o.value).join(','))}}/><span>{o.label}</span></label>)}</div>}{currentAttribute.data_type==='boolean'&&<div className="mt-4 grid gap-2 sm:grid-cols-2">{[{value:'true',label:'Ha'},{value:'false',label:'Yo‘q'}].map(option=><button type="button" key={option.value} onClick={()=>setAttribute(currentAttribute.code,option.value)} className={'rounded-xl border p-4 text-left text-sm font-bold '+(currentValue===option.value?'border-emerald-600 bg-emerald-50':'border-slate-200')}>{option.label}</button>)}</div>}{!['select','multiselect','boolean'].includes(currentAttribute.data_type)&&optionList.length===0&&<input type={currentAttribute.data_type==='number'?'number':currentAttribute.code.endsWith('_date')||currentAttribute.code==='handover_date'?'date':'text'} value={currentValue} onChange={e=>setAttribute(currentAttribute.code,e.target.value)} className="mt-4 w-full rounded-xl border p-4" placeholder="Javobingiz"/>}</div>}
    {current==='ownership'&&<div><h2 className="text-lg font-extrabold">Ushbu mulk bo‘yicha maqomingiz qanday?</h2><div className="mt-4 grid gap-2">{[{value:'owner',label:'Mulk egasiman'},{value:'power_of_attorney',label:'Ishonchnoma asosida joylayapman'},{value:'representative',label:'Mulk egasining vakiliman'}].map(x=><button key={x.value} onClick={()=>setAnswer('ownership_type',x.value)} className={'rounded-xl border p-4 text-left text-sm font-bold '+(answers.ownership_type===x.value?'border-emerald-600 bg-emerald-50':'border-slate-200')}>{x.label}</button>)}</div></div>}
    {current==='title'&&<div><h2 className="text-lg font-extrabold">E’lon sarlavhasi qanday bo‘lsin?</h2><input value={answers.title} onChange={e=>setAnswer('title',e.target.value)} className="mt-4 w-full rounded-xl border p-4" placeholder={titleFrom(selected,answers,categoryAttributes)}/></div>}
    {current==='description'&&<div><h2 className="text-lg font-extrabold">E’lon haqida batafsil ma’lumot bering</h2><textarea value={answers.description} onChange={e=>setAnswer('description',e.target.value)} rows={5} className="mt-4 w-full rounded-xl border p-4" placeholder="Afzalliklari, holati va qo‘shimcha ma’lumotlar..."/><ListingAIDescriptionAssistant facts={{...answers,property_type:selected?.property_type,listing_type:selected?.listing_type,attributes:answers.attributes}} language="uz" onAccept={description=>setAnswer('description',description)}/></div>}
    {current==='price'&&<div><h2 className="text-lg font-extrabold">{isShortRental(selected)?'Asosiy kunlik narxi qancha?':'Narxi qancha?'}</h2><div className="mt-4 flex gap-2"><input inputMode="numeric" value={answers.price} onChange={e=>setAnswer('price',money(e.target.value))} className="min-w-0 flex-1 rounded-xl border p-4 text-lg" placeholder="Masalan: 750 000 000"/><select value={answers.currency} onChange={e=>setAnswer('currency',e.target.value)} className="rounded-xl border px-3"><option value="UZS">so‘m</option><option value="USD">$</option></select></div></div>}
    {current==='mortgage'&&<div><h2 className="text-lg font-extrabold">Ipoteka orqali sotishga rozimisiz?</h2><div className="mt-4 grid gap-2">{[{value:'true',label:'Ha, ipotekaga mumkin'},{value:'false',label:'Yo‘q'}].map(x=><button key={x.value} onClick={()=>setAnswer('mortgage',x.value)} className={'rounded-xl border p-4 text-left text-sm font-bold '+(answers.mortgage===x.value?'border-emerald-600 bg-emerald-50':'border-slate-200')}>{x.label}</button>)}</div></div>}
    {current==='rental'&&<div><h2 className="text-lg font-extrabold">Ijara va bron ma’lumotlari</h2><p className="mt-1 text-sm text-slate-500">Eski formadagi mehmonlar, qulayliklar, qoidalar, kalendar va sana narxlari.</p><RentalBookingSettings value={answers.rental_booking} onChange={v=>setAnswer('rental_booking',v)} basePrice={answers.price} onBasePriceChange={v=>setAnswer('price',v)}/></div>}
    {current==='images'&&<div><h2 className="text-lg font-extrabold">Rasmlar va video yuklang</h2><p className="mt-1 text-sm text-slate-500">10 tagacha rasm va 1 ta video (60 soniyagacha). Birinchi rasm asosiy bo‘ladi.</p><label className="mt-4 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-8 text-sm font-bold hover:border-emerald-500"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" multiple onChange={event=>void addImages(event)} disabled={busy} className="hidden"/>+ Rasmlarni tanlash</label><div className="mt-3 grid grid-cols-3 gap-2">{images.map((im,i)=><div key={im.preview} className="relative"><button type="button" onClick={()=>setMainImage(i)} className={'block w-full overflow-hidden rounded-xl border-2 '+(i===mainImage?'border-emerald-600':'border-transparent')}><img src={im.preview} alt={im.file.name} className="aspect-square w-full object-cover" onError={()=>setError(im.file.name+': rasm ko‘rinishini ochib bo‘lmadi. JPG yoki PNG formatida qayta tanlang.')}/></button><button onClick={()=>removeImage(i)} className="absolute right-1 top-1 rounded-full bg-white px-2 py-1">×</button>{i===mainImage&&<span className="mt-1 block text-center text-xs font-bold text-emerald-700">Asosiy rasm</span>}</div>)}</div></div>}
    {current==='review'&&<div><h2 className="text-lg font-extrabold">E’lon ma’lumotlarini tekshiring</h2><div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm"><p><b>Tur:</b> {selected?.name_uz}</p><p><b>Manzil:</b> {answers.city}, {answers.district}</p><p><b>Sarlavha:</b> {answers.title||titleFrom(selected,answers,categoryAttributes)}</p><p><b>Narx:</b> {answers.price} {answers.currency}</p><p><b>Maydon:</b> {answers.attributes.area_m2||'—'} m²</p><p><b>Xonalar:</b> {answers.attributes.rooms||'—'}</p><p><b>Rasmlar:</b> {images.length} ta</p>{accountProfile&&<p><b>Profil:</b> {accountProfile.full_name} · {accountProfile.phone}</p>}</div><p className="mt-3 text-xs text-slate-500">Barcha javoblar eski e’lon formasi bilan bir xil maydonlarga saqlanadi.</p>{accountProfile&&listingId&&<div className="mt-5 space-y-3"><ListingVideoUploader listingId={listingId} ru={false} onStatusChange={status=>setVideoStatus(status)}/><ListingQualityCard listingId={listingId} imageCountOverride={images.length} listing={{...answers,property_type:selected?.property_type||'apartment',listing_type:selected?.listing_type||'sale',attributes:answers.attributes}} language="uz"/></div>}</div>}
    {current==='name'&&<div><h2 className="text-lg font-extrabold">Ism va familiyangiz nima?</h2><input value={answers.fullName} onChange={e=>setAnswer('fullName',e.target.value)} className="mt-4 w-full rounded-xl border p-4 text-lg" placeholder="Masalan: Ali Valiyev"/><p className="mt-2 text-xs text-slate-500">Bu ma’lumot profilingizda saqlanadi.</p></div>}
    {current==='phone'&&<div><h2 className="text-lg font-extrabold">Telefon raqamingizni SMS orqali tasdiqlang</h2><input value={answers.phone} onChange={e=>handlePhoneChange(e.target.value)} type="tel" className="mt-4 w-full rounded-xl border p-4 text-lg" placeholder="+998 90 123 45 67"/>{otpSent&&!verified&&<div className="mt-4"><label className="text-sm font-bold">SMS kodi</label><input value={otp} onChange={e=>setOtp(phoneDigits(e.target.value).slice(0,6))} inputMode="numeric" autoComplete="one-time-code" className="mt-2 w-full rounded-xl border p-4 text-center text-2xl tracking-[.4em]" placeholder="000000"/><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">{resendCountdown>0?`Yangi kodni ${resendCountdown} soniyadan keyin so‘rashingiz mumkin.`:"SMS kelmadimi? Kodni qayta yuborishingiz mumkin."}</span><button type="button" onClick={()=>void sendCode()} disabled={busy||resendCountdown>0} className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-bold text-emerald-700 disabled:opacity-40">{busy?"Yuborilmoqda…":resendCountdown>0?`Qayta yuborish (${resendCountdown}s)`:"SMS kodni qayta yuborish"}</button></div></div>}{verified&&listingId&&<div className="mt-5 space-y-3"><div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Telefon tasdiqlandi. E’lon qoralamasi saqlandi.</div><ListingVideoUploader listingId={listingId} ru={false} onStatusChange={status=>setVideoStatus(status)}/><ListingQualityCard listingId={listingId} imageCountOverride={images.length} listing={{...answers,property_type:selected?.property_type||'apartment',listing_type:selected?.listing_type||'sale',attributes:answers.attributes}} language="uz"/></div>}</div>}
    {limitReached?<div role="alert" className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm sm:p-6">
     <div className="flex items-start gap-3"><span aria-hidden="true" className="text-3xl">⚠️</span><div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-wider text-amber-800">E’lon joylashtirish limiti</p>
      <h2 className="mt-1 text-xl font-black leading-tight text-slate-950 sm:text-2xl">{accountProfile?.account_type==='partner'?'Hamkor tarifingizdagi e’lon limiti tugadi':'Jismoniy shaxs uchun bepul belgilangan limitingiz tugadi'}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">E’lonni joylashtirish uchun tarif paketini sotib oling. Mos tarifni tanlab, e’lon joylashtirishni davom ettirishingiz mumkin.</p>
      <Link href="/account/monetization" className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-slate-800">Tarif paketlarini tanlash <span className="ml-2" aria-hidden="true">→</span></Link>
     </div></div>
    </div>:error&&<div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {success&&<div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
   </div>
  </section>
  <div className="fixed inset-x-0 z-40 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:mt-5 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none sm:backdrop-blur-0" style={{bottom:keyboardInset+'px'}} role="group" aria-label="E’lon joylashtirish boshqaruvlari">
   <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 border-slate-100 sm:border-t sm:pt-4">
    <button onClick={back} disabled={question===0||busy||verified||phoneOtpVerified} className="min-h-11 rounded-xl border px-5 py-3 text-sm font-bold disabled:opacity-40">Orqaga</button>
    <div className="flex flex-wrap gap-2">
     {showOptionalSkip&&<button onClick={skip} disabled={busy} className="min-h-11 rounded-xl border px-4 py-3 text-sm font-bold">O‘tkazib yuborish</button>}
     {current==='review'&&accountProfile&&!listingId?<button onClick={()=>void saveExistingAccountDraft()} disabled={busy} className="min-h-11 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">{busy?'Saqlanmoqda…':'E’lonni saqlash va davom etish'}</button>:current==='review'&&accountProfile&&listingId?<button onClick={()=>void publish()} disabled={busy||videoStatus==='uploading'||videoStatus==='processing'} className="min-h-11 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Yuborilmoqda…':'E’lonni moderatsiyaga yuborish'}</button>:current==='phone'&&otpSent&&!verified?<button onClick={()=>void verifyAndSaveDraft()} disabled={busy} className="min-h-11 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Tekshirilmoqda…':'SMS kodni tasdiqlash'}</button>:current==='name'&&phoneOtpVerified?<button onClick={()=>void saveNewProfileAndDraft()} disabled={busy} className="min-h-11 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">{busy?'Profil saqlanmoqda…':'Profilni saqlash va davom etish'}</button>:current==='phone'&&verified?<button onClick={()=>void publish()} disabled={busy||videoStatus==='uploading'||videoStatus==='processing'} className="min-h-11 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Yuborilmoqda…':'E’lonni moderatsiyaga yuborish'}</button>:<button onClick={next} disabled={busy||current==='category'&&(!selectedSection||categories.filter(c=>c.parent_code&&c.section_code===selectedSection).length===0)} className="min-h-11 rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Kutilmoqda…':current==='phone'?'SMS kod yuborish':'Davom etish'}</button>}
    </div>
   </div>
  </div>
  <p className="mt-4 text-center text-xs text-slate-400">Eski e’lon formasidagi maydonlar saqlangan. Faqat ularni kiritish usuli ketma-ket savol-javobga o‘zgartirildi.</p>
 </div></main>
}
