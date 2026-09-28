export type MoneyLang = 'uz' | 'ru'

export function formatMoney(value: number, currency: string | null | undefined, lang: MoneyLang) {
  const normalized = String(currency || 'UZS').toUpperCase()
  const formatted = new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ').format(Number(value) || 0)
  if (normalized === 'USD') return `${formatted} $`
  return `${formatted} ${lang === 'ru' ? 'сум' : 'so‘m'}`
}
