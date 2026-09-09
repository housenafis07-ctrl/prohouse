import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type TaxonomyRow = {
  code: string
  parent_code: string | null
  name_uz: string
  name_ru: string | null
  section_code: string
  listing_type: string | null
  property_type: string | null
  node_type: string
  is_owner_filter: boolean
  is_mortgage_filter: boolean
  is_new_construction_filter: boolean
  sort_order: number
}

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('partner_listing_taxonomy')
    .select('code,parent_code,name_uz,name_ru,section_code,listing_type,property_type,node_type,is_owner_filter,is_mortgage_filter,is_new_construction_filter,sort_order')
    .eq('is_active', true)
    .in('node_type', ['category', 'subcategory'])
    .order('section_code')
    .order('sort_order')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ categories: (data || []) as TaxonomyRow[] })
}
