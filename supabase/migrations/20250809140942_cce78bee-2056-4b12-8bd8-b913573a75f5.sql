-- Ensure RLS is enabled (idempotent if already enabled)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laptops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role('super_admin', NULL));

-- COMPANIES
DROP POLICY IF EXISTS "Super admins manage companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
CREATE POLICY "Super admins manage companies" ON public.companies FOR ALL TO authenticated USING (public.has_role('super_admin', NULL)) WITH CHECK (public.has_role('super_admin', NULL));
CREATE POLICY "Users can view their company" ON public.companies FOR SELECT TO authenticated USING (
  public.has_role('super_admin', NULL) OR id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);

-- USER ROLES
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins manage roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Super admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role('super_admin', NULL)) WITH CHECK (public.has_role('super_admin', NULL));

-- LAPTOPS
DROP POLICY IF EXISTS "Select laptops in user's companies" ON public.laptops;
DROP POLICY IF EXISTS "Admins manage laptops in their company" ON public.laptops;
CREATE POLICY "Select laptops in user's companies" ON public.laptops FOR SELECT TO authenticated USING (
  public.has_role('super_admin', NULL) OR company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage laptops in their company" ON public.laptops FOR ALL TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
) WITH CHECK (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);

-- POLICIES
DROP POLICY IF EXISTS "Select policies in user's companies" ON public.policies;
DROP POLICY IF EXISTS "Admins manage policies in their company" ON public.policies;
CREATE POLICY "Select policies in user's companies" ON public.policies FOR SELECT TO authenticated USING (
  public.has_role('super_admin', NULL) OR company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage policies in their company" ON public.policies FOR ALL TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
) WITH CHECK (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);

-- REQUESTS
DROP POLICY IF EXISTS "Employees manage their own requests" ON public.requests;
DROP POLICY IF EXISTS "Admins view company requests" ON public.requests;
DROP POLICY IF EXISTS "Admins update company requests" ON public.requests;
CREATE POLICY "Employees manage their own requests" ON public.requests
FOR ALL TO authenticated
USING (
  employee_id = auth.uid()
) WITH CHECK (
  employee_id = auth.uid() AND company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid())
);
CREATE POLICY "Admins view company requests" ON public.requests FOR SELECT TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);
CREATE POLICY "Admins update company requests" ON public.requests FOR UPDATE TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
) WITH CHECK (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);

-- LOANS
DROP POLICY IF EXISTS "Employees view their loans" ON public.loans;
DROP POLICY IF EXISTS "Admins view company loans" ON public.loans;
DROP POLICY IF EXISTS "Admins manage company loans" ON public.loans;
CREATE POLICY "Employees view their loans" ON public.loans FOR SELECT TO authenticated USING (employee_id = auth.uid());
CREATE POLICY "Admins view company loans" ON public.loans FOR SELECT TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);
CREATE POLICY "Admins manage company loans" ON public.loans FOR ALL TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
) WITH CHECK (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);

-- REPAYMENTS
DROP POLICY IF EXISTS "Employees view their repayments" ON public.repayments;
DROP POLICY IF EXISTS "Admins view company repayments" ON public.repayments;
DROP POLICY IF EXISTS "Admins manage company repayments" ON public.repayments;
CREATE POLICY "Employees view their repayments" ON public.repayments FOR SELECT TO authenticated USING (employee_id = auth.uid());
CREATE POLICY "Admins view company repayments" ON public.repayments FOR SELECT TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);
CREATE POLICY "Admins manage company repayments" ON public.repayments FOR ALL TO authenticated USING (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
) WITH CHECK (
  public.has_role('super_admin', NULL) OR public.has_role('admin', company_id)
);
