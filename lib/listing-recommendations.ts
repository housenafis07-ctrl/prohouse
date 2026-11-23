export type ListingRecommendationSignal = {
  id: string
  listing_type?: string | null
  property_type?: string | null
  taxonomy_code?: string | null
  city?: string | null
  district?: string | null
  is_mortgage_available?: boolean | null
}

function normalized(value: string | null | undefined) {
  return (value || '').trim().toLocaleLowerCase()
}

function scoreAgainst(candidate: ListingRecommendationSignal, seed: ListingRecommendationSignal) {
  const candidateTaxonomy = normalized(candidate.taxonomy_code)
  const seedTaxonomy = normalized(seed.taxonomy_code)
  const sameTaxonomy = !!candidateTaxonomy && candidateTaxonomy === seedTaxonomy
  const sameListingType = !!normalized(seed.listing_type) && normalized(candidate.listing_type) === normalized(seed.listing_type)
  const samePropertyType = !!normalized(seed.property_type) && normalized(candidate.property_type) === normalized(seed.property_type)
  const sameMortgageIntent = Boolean(seed.is_mortgage_available && candidate.is_mortgage_available)

  // A location-only match is not enough: recommendations must remain in the
  // same user intent/category (sale, rent, services, mortgage, etc.).
  if (!sameTaxonomy && !sameListingType && !samePropertyType && !sameMortgageIntent) return 0

  let score = 0
  if (sameTaxonomy) score += 24
  if (sameListingType) score += 14
  if (samePropertyType) score += 9
  if (sameMortgageIntent) score += 8
  if (normalized(candidate.city) && normalized(candidate.city) === normalized(seed.city)) score += 6
  if (normalized(candidate.district) && normalized(candidate.district) === normalized(seed.district)) score += 8
  return score
}

export function rankSimilarListings<T extends ListingRecommendationSignal>(
  candidates: T[],
  seeds: ListingRecommendationSignal[],
  excludeIds: Iterable<string> = [],
  limit = 8,
): T[] {
  if (!seeds.length || !candidates.length) return []
  const excluded = new Set(excludeIds)
  for (const seed of seeds) excluded.add(seed.id)

  return candidates
    .filter((candidate) => !excluded.has(candidate.id))
    .map((candidate) => {
      const scores = seeds.map((seed) => scoreAgainst(candidate, seed))
      const best = Math.max(0, ...scores)
      const repeatedInterest = scores.filter((score) => score > 0).length
      return { candidate, score: best + Math.max(0, repeatedInterest - 1) * 3 }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.candidate)
}
