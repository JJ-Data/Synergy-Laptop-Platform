export interface LoanWithDetails {
  id: string;
  principal_cents: number;
  interest_rate: number;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  employee_id: string;
  requests: {
    laptops: {
      name: string;
      brand: string;
      image_url?: string;
    };
  };
  profiles: {
    display_name?: string;
    avatar_url?: string;
  };
}

export interface RepaymentWithDetails {
  id: string;
  due_date: string;
  amount_cents: number;
  paid_at?: string;
  status: string;
  loan_id: string;
  employee_id: string;
  profiles: {
    display_name?: string;
  };
}
