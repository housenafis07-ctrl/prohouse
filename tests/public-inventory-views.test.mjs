import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/20261111104500_set_public_views_security_invoker.sql', import.meta.url), 'utf8')

test('public inventory views execute with caller privileges and RLS', () => {
  assert.match(migration, /alter view public\.listing_search set \(security_invoker = true\)\s*;/i)
  assert.match(migration, /alter view public\.new_building_inventory set \(security_invoker = true\)\s*;/i)
})
