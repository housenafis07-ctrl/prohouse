const SITE = 'https://royalhouse.uz'

export async function royalhousePublicJson(path: string) {
  const response = await fetch(SITE + path, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error('RoyalHouse public page request failed')
  return response.json()
}
