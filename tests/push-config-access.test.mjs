import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/20261111103000_lock_web_push_private_key.sql', import.meta.url), 'utf8')

test('push_config table grants are revoked from browser roles', () => {
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.match(migration, new RegExp(`revoke all on table public\\.push_config from ${role}\\s*;`, 'i'))
  }
})

test('push_config column-level grants are revoked from browser roles', () => {
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.match(migration, new RegExp(`revoke all \\(id, private_key, public_key, created_at, updated_at\\)\\s+on table public\\.push_config from ${role}\\s*;`, 'i'))
  }
})

test('get_push_config is service-role only for browser execution', () => {
  for (const role of ['public', 'anon', 'authenticated']) {
    assert.match(migration, new RegExp(`revoke all on function public\\.get_push_config\\(\\) from ${role}\\s*;`, 'i'))
  }
  assert.match(migration, /grant execute on function public\.get_push_config\(\) to service_role\s*;/i)
})
