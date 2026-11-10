import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const wizard = await readFile(new URL('../app/listings/new/smart-wizard.tsx', import.meta.url), 'utf8')
const metadata = await readFile(new URL('../app/api/listings/meta/route.ts', import.meta.url), 'utf8')
const profile = await readFile(new URL('../app/api/account/profile/route.ts', import.meta.url), 'utf8')
const draft = await readFile(new URL('../app/api/listings/draft/route.ts', import.meta.url), 'utf8')

test('region and district are controlled by matching location catalog values', () => {
  assert.match(wizard, /UZBEKISTAN_LOCATIONS\.find\(x=>x\.name===answers\.city\)/)
  assert.match(wizard, /UZBEKISTAN_LOCATIONS\.map\(x=>/)
  assert.match(wizard, /districts\.map\(x=>/)
  assert.match(wizard, /setAnswer\('district',''\)/)
})

test('mahalla remains available as an optional field', () => {
  assert.match(wizard, /current==='neighborhood'/)
  assert.match(wizard, /Mahalla yoki massiv nomi/)
  assert.match(wizard, /Mahalla yoki massiv nomi[\s\S]*ixtiyoriy savol/i)
})

test('ownership and boolean attributes use explicit choices', () => {
  assert.match(wizard, /value:'owner'/)
  assert.match(wizard, /value:'power_of_attorney'/)
  assert.match(wizard, /value:'representative'/)
  assert.match(wizard, /label:'Ha'/)
  assert.match(wizard, /label:'Yo‘q'/)
})

test('database attributes with predefined options render as selections', () => {
  assert.match(wizard, /optionList\.length>0/)
  assert.match(wizard, /attributeChoiceOptions/)
  assert.match(wizard, /currentAttribute\.code==='utilities'/)
})

test('existing verified profiles bypass repeated name and SMS questions', () => {
  assert.match(metadata, /accountProfile/)
  assert.match(metadata, /readAccountSession/)
  assert.match(wizard, /if\(!accountProfile\)\{q\.push\('phone'\);if\(phoneOtpVerified\)q\.push\('name'\)\}/)
  assert.match(wizard, /const saveNewProfileAndDraft=async\(\)=>/)
  assert.match(wizard, /Telefon raqamingiz tasdiqlandi\. Endi ism va familiyangizni kiriting\./)
  assert.match(wizard, /current==='name'&&phoneOtpVerified/)
  assert.match(wizard, /disabled=\{question===0\|\|busy\|\|verified\|\|phoneOtpVerified\}/)
  assert.match(wizard, /saveExistingAccountDraft/)
})

test('existing profile phone cannot be changed without verifying the new number', () => {
  assert.match(profile, /currentPhoneDigits && requestedPhone && currentPhoneDigits !== requestedPhone/)
  assert.match(profile, /yangi raqamni SMS orqali tasdiqlang/)
})

test('signed phone session takes priority over stale Supabase browser identity', () => {
  assert.match(metadata, /const phoneSessionUserId = readAccountSession/)
  assert.match(metadata, /let userId = phoneSessionUserId[\s\S]*if \(!userId\)/)
  assert.match(draft, /const phoneSessionUserId = readAccountSession/)
  assert.match(draft, /let userId = phoneSessionUserId[\s\S]*if \(!userId\)/)
})

test('profile initialization preserves existing account and partner data', () => {
  assert.match(profile, /currentProfile\?\.company_name/)
  assert.match(profile, /currentProfile\?\.account_type/)
  assert.match(profile, /upsert\(profilePatch/)
})


test('SMS API responses handle empty and non-JSON bodies without JSON parse crashes', () => {
  assert.match(wizard, /const readApiResponse=async\(response:Response\)=>/)
  assert.match(wizard, /Server bo‘sh javob qaytardi/)
  assert.match(wizard, /Server JSON formatida bo‘lmagan javob qaytardi/)
  assert.doesNotMatch(wizard, /const data=await response\.json\(\);if\(!response\.ok\)throw new Error\(data\.error\|\|'SMS yuborilmadi\.'\)/)
})

test('SMS verification restores an existing phone profile without replacing its saved name', () => {
  assert.match(wizard, /const existingProfileResponse=await fetch\('\/api\/account\/profile'/)
  assert.match(wizard, /existingProfile\.full_name\|\|current\.fullName/)
  assert.match(wizard, /if\(existingProfileResponse\.status===401\)/)
  assert.match(wizard, /full_name:answers\.fullName\.trim\(\),account_type:'individual'/)
})

test('draft API accepts only the authenticated Supabase or signed account session identity', () => {
  assert.match(draft, /authSupabase\.auth\.getUser\(\)/)
  assert.match(draft, /readAccountSession\(cookieStore\.get\(ACCOUNT_SESSION_COOKIE\)\?\.value\)/)
  assert.match(draft, /if \(!userId\)[\s\S]*AUTH_REQUIRED/)
})


const telegramMiniApp = await readFile(new URL('../app/telegram/page.tsx', import.meta.url), 'utf8')

test('individual listing permissions remain available when a partner is signed in', () => {
  assert.match(metadata, /partner_type', 'owner'/)
  assert.match(metadata, /allowedCodes\.add\(permission\.category_code\)/)
  assert.match(metadata, /partnerType !== 'owner'/)
})

test('Telegram starts the Smart Listing Wizard before requesting SMS verification', () => {
  assert.match(telegramMiniApp, /const handlePlaceAd = \(\) =>/)
  assert.match(telegramMiniApp, /openInMiniApp\('\/listings\/new'\)/)
  assert.doesNotMatch(telegramMiniApp, /const handlePlaceAd = async \(\)[\s\S]*fetch\('\/api\/account\/profile'/)
})


const sendCodeRoute = await readFile(new URL('../app/api/auth/send-code/route.ts', import.meta.url), 'utf8')

test('SMS OTP endpoint explicitly uses Node runtime and always returns structured failures', () => {
  assert.match(sendCodeRoute, /export const runtime = 'nodejs'/)
  assert.match(sendCodeRoute, /export const dynamic = 'force-dynamic'/)
  assert.match(sendCodeRoute, /request\.json\(\)\.catch\(\(\) => null\)/)
  assert.match(sendCodeRoute, /console\.error\('\[auth\/send-code\] SMS request failed:'/)
  assert.match(sendCodeRoute, /status: 502, headers: \{ 'Cache-Control': 'no-store' \}/)
})


test('listing quota exhaustion shows a prominent tariff upgrade action', () => {
  assert.match(wizard, /LISTING_LIMIT_REACHED/i)
  assert.match(wizard, /Jismoniy shaxs uchun bepul belgilangan limitingiz tugadi/)
  assert.match(wizard, /E’lonni joylashtirish uchun tarif paketini sotib oling/)
  assert.match(wizard, /href="\/account\/monetization"/)
  assert.match(wizard, /Tarif paketlarini tanlash/)
})


const telegramWebhook = await readFile(new URL('../app/api/telegram/webhook/route.ts', import.meta.url), 'utf8')
const telegramWebhookPost = telegramWebhook.slice(telegramWebhook.indexOf('export async function POST'))

test('Telegram webhook keeps /start responsive when optional bot-user registration fails', () => {
  assert.match(telegramWebhookPost, /Best-effort registration must never prevent \/start from replying/)
  assert.match(telegramWebhookPost, /catch \(registrationError\)/)
  assert.match(telegramWebhookPost, /if \(text\.startsWith\('\/start'\)\)/)
})

test('Telegram cannot authenticate or verify a phone number; account access remains SMS OTP only', () => {
  assert.match(telegramWebhookPost, /Telegram orqali kirish va ro‘yxatdan o‘tish o‘chirilgan/)
  assert.match(telegramWebhookPost, /Telegram kontaktini yuborish orqali kirish yoki ro‘yxatdan o‘tish mumkin emas/)
  assert.doesNotMatch(telegramWebhookPost, /verification_method: 'telegram_contact'/)
  assert.doesNotMatch(telegramWebhookPost, /requestTelegramPhone\(chatId\)/)
})


const mobileNavigation = await readFile(new URL('../app/components/MobileMainNavigation.tsx', import.meta.url), 'utf8')

test('mobile create-listing navigation opens the Smart Listing Wizard without an upfront login redirect', () => {
  assert.match(mobileNavigation, /key: 'create',[\s\S]*href: '\/listings\/new'/)
  assert.doesNotMatch(mobileNavigation, /createClient\(\)\.auth\.getUser\(\)/)
  assert.doesNotMatch(mobileNavigation, /register\?redirect=.*listings\/new/)
})
