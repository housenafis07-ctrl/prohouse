export type NormalizationResult = {
  original: string
  normalized: string
  changed: boolean
  corrections: Array<{ from: string; to: string; confidence: number }>
}

const replacements: Array<[RegExp, string]> = [
  [/\bchilon?zor\b/gi, 'Chilonzor'],
  [/\bchilanzor\b/gi, 'Chilonzor'],
  [/\bchilonzar\b/gi, 'Chilonzor'],
  [/\bchilonzo?r\b/gi, 'Chilonzor'],
  [/\bclonzor\b/gi, 'Chilonzor'],
  [/\bchlonzor\b/gi, 'Chilonzor'],
  [/\bчиланзор\b/gi, 'Chilonzor'],
  [/\bчилонзар\b/gi, 'Chilonzor'],
  [/\bчланзар\b/gi, 'Chilonzor'],
  [/\bчилонзор\b/gi, 'Chilonzor'],
  [/\bsergeli(y)?\b/gi, 'Sergeli'],
  [/\bсергели(й)?\b/gi, 'Sergeli'],
  [/\byunusabad\b/gi, 'Yunusobod'],
  [/\byunusobod\b/gi, 'Yunusobod'],
  [/\bюнусабад\b/gi, 'Yunusobod'],
  [/\bюнуcобод\b/gi, 'Yunusobod'],
  [/\bhonali\b/gi, 'xonali'],
  [/\bhonalik\b/gi, 'xonali'],
  [/\bkomnatli\b/gi, 'xonali'],
  [/\bкомнатная\b/gi, 'xonali'],
  [/\bкомнат\b/gi, 'xona'],
  [/\bквартира\b/gi, 'kvartira'],
]

export function normalizeAiText(input: string): NormalizationResult {
  const original = String(input ?? '')
  let normalized = original
  const corrections: NormalizationResult['corrections'] = []

  for (const [pattern, to] of replacements) {
    normalized = normalized.replace(pattern, (match) => {
      if (match === to) return match
      corrections.push({ from: match, to, confidence: 0.98 })
      return to
    })
  }

  normalized = normalized
    .replace(/[’‘`ʻʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return { original, normalized, changed: normalized !== original, corrections }
}

export function normalizeAiFields<T extends Record<string, unknown>>(fields: T) {
  const result = { ...fields }
  for (const key of Object.keys(result)) {
    const value = result[key]
    if (typeof value === 'string') result[key] = normalizeAiText(value).normalized
  }
  return result
}
