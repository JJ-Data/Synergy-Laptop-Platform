-- Create enums if not exist using DO blocks for idempotency
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'employee');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
    CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected', 'purchased');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loan_status') THEN
    CREATE TYPE public.loan_status AS ENUM ('active', 'paid', 'defaulted');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'repayment_status') THEN
    CREATE TYPE public.repayment_status AS ENUM ('due', 'paid', 'late');
  END IF;
END $$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1) Core tables required before helper functions
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON public.companies(domain);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  company_id uuid REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles(company_id);
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, company_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_company ON public.user_roles(company_id);

-- 2) Helper role check function (now that user_roles exists)
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _company_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = _role
      AND (ur.company_id IS NOT DISTINCT FROM _company_id)
  );
$$;

-- 3) Domain tables
CREATE TABLE IF NOT EXISTS public.laptops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  cpu text,
  ram_gb int,
  storage_gb int,
  price_cents int NOT NULL,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_laptops_company ON public.laptops(company_id);

CREATE TABLE IF NOT EXISTS public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  max_amount_cents int NOT NULL,
  interest_rate numeric(6,3) NOT NULL,
  durations_months int[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_policies_updated_at
BEFORE UPDATE ON public.policies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  laptop_id uuid NOT NULL REFERENCES public.laptops(id) ON DELETE RESTRICT,
  status public.request_status NOT NULL DEFAULT 'pending',
  requested_amount_cents int NOT NULL,
  duration_months int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_requests_company ON public.requests(company_id);
CREATE INDEX IF NOT EXISTS idx_requests_employee ON public.requests(employee_id);

CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL UNIQUE REFERENCES public.requests(id) ON DELETE CASCADE,
  principal_cents int NOT NULL,
  interest_rate numeric(6,3) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.loan_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loans_company ON public.loans(company_id);
CREATE INDEX IF NOT EXISTS idx_loans_employee ON public.loans(employee_id);

CREATE TABLE IF NOT EXISTS public.repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount_cents int NOT NULL,
  paid_at timestamptz,
  status public.repayment_status NOT NULL DEFAULT 'due',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_repayments_company ON public.repayments(company_id);
CREATE INDEX IF NOT EXISTS idx_repayments_employee ON public.repayments(employee_id);
CREATE INDEX IF NOT EXISTS idx_repayments_loan ON public.repayments(loan_id);

-- 4) Enable Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laptops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;

-- 5) RLS Policies
-- PROFILES
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY IF NOT EXISTS "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY IF NOT EXISTS "Super admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role('super_admin', NULL));

-- COMPANIES
CREATE POLICY IF NOT EXISTS "Super admins manage companies" ON public.companies FOR ALL TO authenticated USING (public.has_role('super_admin', NULL)) WITH CHECK (public.has_role('super_admin', NULL));
CREATE POLICY IF NOT EXISTS "Users can view their company" ON public.companies FOR SELECT TO authenticated USING (
  public.has_role('super_admin', NULL) OR id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

-- USER ROLES
CREATE POLICY IF NOT EXISTS "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "Super admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role('super_admin', NULL)) WITH CHECK (public.has_role('super_admin', NULL));

-- LAPTOPS
CREATE POLICY IF NOT EXISTS "Select laptops in user's companies" ON public.laptops FOR SELECT TO authenticated USING (
  public.has_role('super_admin', NULL) OR company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);
CREATE POLICY IF NOT EXISTS "Admins manage laptops in their company" ON public.laptops FOR ALL TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
) WITH CHECK (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);

-- POLICIES
CREATE POLICY IF NOT EXISTS "Select policies in user's companies" ON public.policies FOR SELECT TO authenticated USING (
  public.has_role('super_admin', NULL) OR company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);
CREATE POLICY IF NOT EXISTS "Admins manage policies in their company" ON public.policies FOR ALL TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
) WITH CHECK (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);

-- REQUESTS
CREATE POLICY IF NOT EXISTS "Employees manage their own requests" ON public.requests
FOR ALL TO authenticated
USING (
  employee_id = auth.uid()
) WITH CHECK (
  employee_id = auth.uid() AND company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY IF NOT EXISTS "Admins view company requests" ON public.requests FOR SELECT TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);
CREATE POLICY IF NOT EXISTS "Admins update company requests" ON public.requests FOR UPDATE TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
) WITH CHECK (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);

-- LOANS
CREATE POLICY IF NOT EXISTS "Employees view their loans" ON public.loans FOR SELECT TO authenticated USING (employee_id = auth.uid());
CREATE POLICY IF NOT EXISTS "Admins view company loans" ON public.loans FOR SELECT TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);
CREATE POLICY IF NOT EXISTS "Admins manage company loans" ON public.loans FOR ALL TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
) WITH CHECK (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);

-- REPAYMENTS
CREATE POLICY IF NOT EXISTS "Employees view their repayments" ON public.repayments FOR SELECT TO authenticated USING (employee_id = auth.uid());
CREATE POLICY IF NOT EXISTS "Admins view company repayments" ON public.repayments FOR SELECT TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);
CREATE POLICY IF NOT EXISTS "Admins manage company repayments" ON public.repayments FOR ALL TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
) WITH CHECK (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);
