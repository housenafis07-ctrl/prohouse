export function monthlyPayment(principal: number, annualRate: number, months: number) {
  if (principal <= 0 || months <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) return principal / months
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

export function loanFromPayment(monthly: number, annualRate: number, months: number) {
  if (monthly <= 0 || months <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) return monthly * months
  return monthly * (Math.pow(1 + r, months) - 1) / (r * Math.pow(1 + r, months))
}

export function calculateAffordableHome(input: {
  income: number
  existingCredits?: number
  downPayment: number
  annualRate: number
  years: number
}) {
  const income = Math.max(0, Number(input.income) || 0)
  const existingCredits = Math.max(0, Number(input.existingCredits) || 0)
  const downPayment = Math.max(0, Number(input.downPayment) || 0)
  const annualRate = Math.max(0, Number(input.annualRate) || 0)
  const months = Math.max(12, (Number(input.years) || 20) * 12)
  const debtLimit = income * 0.5
  const mortgagePayment = Math.max(0, debtLimit - existingCredits)
  const maxLoan = loanFromPayment(mortgagePayment, annualRate, months)
  const maxHome = maxLoan + downPayment
  return { income, existingCredits, downPayment, annualRate, months, debtLimit, mortgagePayment, maxLoan, maxHome, minHome: maxHome * 0.85 }
}
