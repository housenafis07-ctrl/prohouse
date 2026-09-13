import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ipoteka kalkulyatori — O‘zbekistonda ipoteka to‘lovini hisoblash | Prohouse',
  description: 'O‘zbekistonda ipoteka kreditini hisoblang: uy-joy narxi, boshlang‘ich badal, foiz stavkasi va muddatni kiriting. Oylik to‘lov, jami to‘lov va ortiqcha foizni ko‘ring.',
  keywords: [
    'ipoteka kalkulyatori',
    'ipoteka hisoblash',
    'ipoteka krediti',
    'ipoteka to‘lovi',
    'O‘zbekiston ipoteka',
    'uy krediti',
    'boshlang‘ich badal',
    'ипотечный калькулятор',
  ],
  alternates: {
    canonical: '/ipoteka/kalkulyator',
  },
  openGraph: {
    title: 'Ipoteka kalkulyatori | Prohouse',
    description: 'O‘zbekistonda ipoteka to‘lovini tez va qulay hisoblang.',
    type: 'website',
  },
}

export default function MortgageCalculatorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
