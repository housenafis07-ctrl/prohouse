import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('Click callback validates signatures and dispatches monetization and rental payments', () => {
  const source = read('../app/api/monetization/payments/click/webhook/route.ts')
  assert.match(source, /signatureBase/)
  assert.match(source, /timingSafeEqual/)
  assert.match(source, /complete_click_monetization_payment/)
  assert.match(source, /CLICK_ENABLED !== 'true'/)
  assert.match(source, /complete_click_rental_payment/)
  assert.match(source, /allocate_click_prepare_id/)
})

test('rental booking keeps Payme as default and supports Click hosted checkout', () => {
  const source = read('../app/api/rentals/book/route.ts')
  assert.match(source, /body\.paymentProvider\|\|'payme'/)
  assert.match(source, /CLICK_NOT_CONFIGURED/)
  assert.match(source, /CLICK_ENABLED!=='true'/)
  assert.match(source, /payment_provider:paymentProvider/)
  assert.match(source, /my\.click\.uz\/services\/pay/)
  assert.match(source, /checkout\.paycom\.uz/)
})

test('rental calendar allows choosing Payme or Click and validates the matching checkout URL', () => {
  const source = read('../app/components/RentalBookingCalendar.tsx')
  assert.match(source, /setPaymentProvider\('payme'\)/)
  assert.match(source, /setPaymentProvider\('click'\)/)
  assert.match(source, /NEXT_PUBLIC_CLICK_ENABLED==='true'/)
  assert.match(source, /paymentProvider==='payme'/)
  assert.match(source, /paymentProvider==='click'/)
})

test('booking receipt supports both payment providers without changing Payme amount units', () => {
  const source = read('../app/api/account/rental-bookings/[id]/route.ts')
  assert.match(source, /\['payme','click'\]/)
  assert.match(source, /provider: booking\.payment_provider === 'click' \? 'Click' : 'Payme'/)
  assert.match(source, /Number\(providerPayload\.amount\) \/ 100/)
})

test('Click settlement is transactional and service-role only', () => {
  const source = read('../supabase/migrations/20261126102000_click_rental_payment_hardening.sql')
  assert.match(source, /complete_click_monetization_payment/)
  assert.match(source, /complete_click_rental_payment/)
  assert.match(source, /activate_monetization_order/)
  assert.match(source, /for update/i)
  assert.match(source, /to service_role/)
})
