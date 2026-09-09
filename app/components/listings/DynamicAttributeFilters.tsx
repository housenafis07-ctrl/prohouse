'use client'

import { useMemo } from 'react'

type Attribute = {
  id: string
  category_code: string
  code: string
  name_uz: string
  name_ru: string | null
  data_type: string
  options: unknown
  unit: string | null
  sort_order: number
}

type Props = {
  attributes: Attribute[]
  categoryCode: string
  lang?: 'uz' | 'ru'
  values: Record<string, string>
  onChange: (code: string, value: string) => void
}

function optionsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (typeof item === 'string') return item
    if (item && typeof item === 'object' && 'value' in item) return String((item as { value: unknown }).value)
    return String(item)
  })
}

export default function DynamicAttributeFilters({ attributes, categoryCode, lang = 'uz', values, onChange }: Props) {
  const visible = useMemo(
    () => attributes.filter((a) => a.category_code === categoryCode).sort((a, b) => a.sort_order - b.sort_order),
    [attributes, categoryCode],
  )

  if (!categoryCode || !visible.length) return null

  return (
    <div className="mt-4 border-t pt-4">
      <p className="text-sm font-semibold">{lang === 'ru' ? 'Характеристики' : 'Xususiyatlar'}</p>
      <div className="mt-3 space-y-3">
        {visible.map((attribute) => {
          const label = lang === 'ru' ? (attribute.name_ru || attribute.name_uz) : attribute.name_uz
          const options = optionsOf(attribute.options)
          const value = values[attribute.code] || ''
          const placeholder = attribute.unit ? `${label} (${attribute.unit})` : label

          if (attribute.data_type === 'boolean') {
            return (
              <label key={attribute.id} className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={value === 'true'} onChange={(e) => onChange(attribute.code, e.target.checked ? 'true' : '')} />
                {label}
              </label>
            )
          }

          if ((attribute.data_type === 'select' || attribute.data_type === 'multiselect') && options.length) {
            return (
              <label key={attribute.id} className="block text-sm font-semibold">
                {label}
                <select value={value} onChange={(e) => onChange(attribute.code, e.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3">
                  <option value="">{lang === 'ru' ? 'Все' : 'Barchasi'}</option>
                  {options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            )
          }

          return (
            <label key={attribute.id} className="block text-sm font-semibold">
              {label}
              <input type={attribute.data_type === 'number' ? 'number' : 'text'} value={value} onChange={(e) => onChange(attribute.code, e.target.value)} placeholder={placeholder} className="mt-2 h-11 w-full rounded-xl border px-3" />
            </label>
          )
        })}
      </div>
    </div>
  )
}
