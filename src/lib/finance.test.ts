import { describe, it, expect } from "bun:test"
import { calculateMonthlyPayment, calculateLoanProgress } from "./finance"

describe("calculateMonthlyPayment", () => {
  it("calculates payment with interest", () => {
    const payment = calculateMonthlyPayment(1000, 12, 5)
    expect(payment).toBeCloseTo(85.61, 2)
  })

  it("calculates payment without interest", () => {
    const payment = calculateMonthlyPayment(1200, 12, 0)
    expect(payment).toBeCloseTo(100)
  })
})

describe("calculateLoanProgress", () => {
  it("calculates progress for repayments array", () => {
    const repayments = [
      { status: "paid" },
      { status: "paid" },
      { status: "due" },
    ]
    expect(calculateLoanProgress(repayments)).toBeCloseTo((2 / 3) * 100)
  })

  it("filters by loan id when provided", () => {
    const repayments = [
      { status: "paid", loan_id: "a" },
      { status: "due", loan_id: "a" },
      { status: "paid", loan_id: "b" },
    ]
    expect(calculateLoanProgress(repayments, "a")).toBeCloseTo(50)
  })
})
