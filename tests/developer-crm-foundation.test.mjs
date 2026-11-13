import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('developer CRM migration is additive and protects new tables', async () => {
  const sql = await read('../supabase/migrations/20261113120000_developer_crm_professional_foundation.sql')
  for (const table of ['developer_team_members','developer_lead_assignments','developer_tasks','developer_appointments']) {
    assert.match(sql, new RegExp('create table if not exists public\\.' + table, 'i'))
    assert.match(sql, new RegExp('alter table public\\.' + table + ' enable row level security', 'i'))
    assert.match(sql, new RegExp('revoke all on public\\.' + table + ' from public, anon, authenticated', 'i'))
  }
  assert.match(sql, /create or replace function public\.assign_developer_lead/i)
  assert.match(sql, /revoke all on function public\.assign_developer_lead[\s\S]*from public, anon, authenticated/i)
})

test('CRM access resolver supports company membership for non-partner employees', async () => {
  const source = await read('../lib/developer/crm-access.ts')
  assert.match(source, /Staff accounts may be ordinary individual accounts/)
  assert.match(source, /developer_team_members/)
  assert.match(source, /status', 'active'/)
  assert.match(source, /DEVELOPER_COMPANY_SELECTION_REQUIRED/)
})

test('task and appointment APIs scope reads and writes to developer ownership', async () => {
  const tasks = await read('../app/api/developer/tasks/route.ts')
  const appointments = await read('../app/api/developer/appointments/route.ts')
  assert.match(tasks, /\.eq\('developer_id', ctx\.developer\.id\)/)
  assert.match(tasks, /ctx\.role === 'sales_agent'.*assigned_to/s)
  assert.match(appointments, /\.eq\('developer_id', ctx\.developer\.id\)/)
  assert.match(appointments, /ctx\.role === 'sales_agent'.*assigned_to/s)
})

test('public lead intake remains on the existing developer lead requests table', async () => {
  const route = await read('../app/api/developer/leads/route.ts')
  assert.match(route, /from\('developer_lead_requests'\)/)
  assert.match(route, /assign_developer_lead/)
})
