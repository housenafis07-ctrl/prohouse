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
  assert.match(wizard, /Mahalla yoki massiv nomi[\s\S]*ixtiyoriy savol/)
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
  assert.match(wizard, /if\(!accountProfile\)q\.push\('name','phone'\)/)
  assert.match(wizard, /saveExistingAccountDraft/)
})

test('profile initialization preserves existing account and partner data', () => {
  assert.match(profile, /currentProfile\?\.company_name/)
  assert.match(profile, /currentProfile\?\.account_type/)
  assert.match(profile, /upsert\(profilePatch/)
})

test('draft API accepts only the authenticated Supabase or signed account session identity', () => {
  assert.match(draft, /authSupabase\.auth\.getUser\(\)/)
  assert.match(draft, /readAccountSession\(cookieStore\.get\(ACCOUNT_SESSION_COOKIE\)\?\.value\)/)
  assert.match(draft, /if \(!userId\)[\s\S]*AUTH_REQUIRED/)
})
