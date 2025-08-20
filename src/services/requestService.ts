// src/services/requestService.ts
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LaptopRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  laptopId: string;
  laptopName?: string;
  laptopBrand?: string;
  requestedAmount: number;
  durationMonths: number;
  status: "pending" | "approved" | "rejected" | "purchased";
  createdAt: string;
  decidedAt?: string;
  monthlyPayment?: number;
}

export class RequestService {
  static async createRequest(
    employeeId: string,
    companyId: string,
    laptopId: string,
    amount: number,
    duration: number
  ) {
    const { data, error } = await supabase
      .from("requests")
      .insert({
        company_id: companyId,
        employee_id: employeeId,
        laptop_id: laptopId,
        requested_amount_cents: amount,
        duration_months: duration,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    // Send notification (you can implement this later)
    await this.notifyAdmins(companyId, data.id);

    return data;
  }

  static async approveRequest(requestId: string, companyId: string) {
    try {
      // Get request details
      const { data: request, error: fetchError } = await supabase
        .from("requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (fetchError) throw fetchError;

      // Get company policy
      const { data: policy, error: policyError } = await supabase
        .from("policies")
        .select("interest_rate")
        .eq("company_id", companyId)
        .maybeSingle();

      if (policyError) throw policyError;

      const interestRate = policy?.interest_rate || 0;

      // Create loan
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + request.duration_months);

      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .insert({
          company_id: companyId,
          employee_id: request.employee_id,
          request_id: requestId,
          principal_cents: request.requested_amount_cents,
          interest_rate: interestRate,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: "active",
        })
        .select()
        .single();

      if (loanError) throw loanError;

      // Calculate monthly payment
      const monthlyPayment = this.calculateMonthlyPayment(
        request.requested_amount_cents / 100,
        request.duration_months,
        interestRate
      );

      // Create repayment schedule
      const repayments = [];
      for (let i = 0; i < request.duration_months; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i + 1);

        repayments.push({
          company_id: companyId,
          employee_id: request.employee_id,
          loan_id: loan.id,
          due_date: dueDate.toISOString(),
          amount_cents: Math.round(monthlyPayment * 100),
          status: "due",
        });
      }

      const { error: repaymentError } = await supabase
        .from("repayments")
        .insert(repayments);

      if (repaymentError) throw repaymentError;

      // Update request status
      const { error: updateError } = await supabase
        .from("requests")
        .update({
          status: "approved",
          decided_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // Notify employee
      await this.notifyEmployee(request.employee_id, "approved");

      return { success: true, loanId: loan.id };
    } catch (error) {
      console.error("Error approving request:", error);
      throw error;
    }
  }

  static async rejectRequest(requestId: string, reason?: string) {
    const { data, error } = await supabase
      .from("requests")
      .update({
        status: "rejected",
        decided_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select()
      .single();

    if (error) throw error;

    // Notify employee
    await this.notifyEmployee(data.employee_id, "rejected", reason);

    return data;
  }

  static calculateMonthlyPayment(
    principal: number,
    months: number,
    annualRate: number
  ): number {
    if (annualRate === 0) return principal / months;

    const monthlyRate = annualRate / 100 / 12;
    const payment =
      (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

    return Math.round(payment);
  }

  static async notifyAdmins(companyId: string, requestId: string) {
    // Implement notification logic
    console.log(
      `Notifying admins of company ${companyId} about request ${requestId}`
    );
  }

  static async notifyEmployee(
    employeeId: string,
    status: "approved" | "rejected",
    reason?: string
  ) {
    // Implement notification logic
    console.log(`Notifying employee ${employeeId}: Request ${status}`);
  }
}
