export function calculateMonthlyPayment(
  principal: number,
  months: number,
  annualRate: number
): number {
  if (annualRate === 0) return principal / months
  const monthlyRate = annualRate / 100 / 12
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
}

interface RepaymentLike {
  status: string
  loan_id?: string
}

export function calculateLoanProgress<T extends RepaymentLike>(
  repayments: T[],
  loanId?: string
): number {
  const relevant = loanId
    ? repayments.filter((r) => r.loan_id === loanId)
    : repayments
  const total = relevant.length
  const paid = relevant.filter((r) => r.status === "paid").length
  return total > 0 ? (paid / total) * 100 : 0
}
