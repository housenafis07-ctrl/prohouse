export const PARTNER_PLAN_CODES = ['partner_start', 'partner_pro', 'partner_business'] as const

export type PartnerPlanCode = typeof PARTNER_PLAN_CODES[number]

export const PARTNER_PLAN_FEATURES: Record<PartnerPlanCode, {
  listingLimit: number
  analytics: 'basic' | 'advanced'
  priorityModeration: boolean
  promoTools: boolean
  prioritySupport: boolean
  employees: number
  companyProfile: boolean
}> = {
  partner_start: {
    listingLimit: 10,
    analytics: 'basic',
    priorityModeration: false,
    promoTools: false,
    prioritySupport: false,
    employees: 1,
    companyProfile: false,
  },
  partner_pro: {
    listingLimit: 30,
    analytics: 'advanced',
    priorityModeration: true,
    promoTools: true,
    prioritySupport: false,
    employees: 1,
    companyProfile: false,
  },
  partner_business: {
    listingLimit: 100,
    analytics: 'advanced',
    priorityModeration: true,
    promoTools: true,
    prioritySupport: true,
    employees: 10,
    companyProfile: true,
  },
}

export function isPartnerPlanCode(value: string): value is PartnerPlanCode {
  return (PARTNER_PLAN_CODES as readonly string[]).includes(value)
}
