-- Enums
create type public.app_role as enum ('super_admin', 'admin', 'employee');
create type public.request_status as enum ('pending', 'approved', 'rejected', 'purchased');
create type public.loan_status as enum ('active', 'paid', 'defaulted');
create type public.repayment_status as enum ('due', 'paid', 'late');

-- Updated_at trigger function
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Helper role check function (avoids RLS recursion)
create or replace function public.has_role(_role public.app_role, _company_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = _role
      and (ur.company_id is not distinct from _company_id)
  );
$$;

-- Companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  created_at timestamptz not null default now(),
  unique(name)
);
create index if not exists idx_companies_domain on public.companies(domain);

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  company_id uuid references public.companies(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_company on public.profiles(company_id);
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- User roles (scoped by company when relevant)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id),
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role, company_id)
);
create index if not exists idx_user_roles_user on public.user_roles(user_id);
create index if not exists idx_user_roles_company on public.user_roles(company_id);

-- Laptops catalog (per company)
create table if not exists public.laptops (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  brand text,
  cpu text,
  ram_gb int,
  storage_gb int,
  price_cents int not null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_laptops_company on public.laptops(company_id);

-- Company policies (one per company)
create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade unique,
  max_amount_cents int not null,
  interest_rate numeric(6,3) not null,
  durations_months int[] not null default '{}',
  updated_at timestamptz not null default now()
);
create trigger trg_policies_updated_at
before update on public.policies
for each row execute function public.update_updated_at_column();

-- Employee requests for financing
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  laptop_id uuid not null references public.laptops(id) on delete restrict,
  status public.request_status not null default 'pending',
  requested_amount_cents int not null,
  duration_months int not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists idx_requests_company on public.requests(company_id);
create index if not exists idx_requests_employee on public.requests(employee_id);

-- Loans created from approved requests
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null unique references public.requests(id) on delete cascade,
  principal_cents int not null,
  interest_rate numeric(6,3) not null,
  start_date date not null,
  end_date date not null,
  status public.loan_status not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists idx_loans_company on public.loans(company_id);
create index if not exists idx_loans_employee on public.loans(employee_id);

-- Repayment schedule
create table if not exists public.repayments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  due_date date not null,
  amount_cents int not null,
  paid_at timestamptz,
  status public.repayment_status not null default 'due',
  created_at timestamptz not null default now()
);
create index if not exists idx_repayments_company on public.repayments(company_id);
create index if not exists idx_repayments_employee on public.repayments(employee_id);
create index if not exists idx_repayments_loan on public.repayments(loan_id);

-- Enable Row Level Security
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.laptops enable row level security;
alter table public.policies enable row level security;
alter table public.requests enable row level security;
alter table public.loans enable row level security;
alter table public.repayments enable row level security;

-- RLS Policies
-- PROFILES
create policy "Users can view own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Users can update own profile" on public.profiles for update to authenticated using (id = auth.uid());
create policy "Super admins can view all profiles" on public.profiles for select to authenticated using (public.has_role('super_admin', null));

-- COMPANIES
create policy "Super admins manage companies" on public.companies for all to authenticated using (public.has_role('super_admin', null)) with check (public.has_role('super_admin', null));
create policy "Users can view their company" on public.companies for select to authenticated using (
  public.has_role('super_admin', null) or id in (select company_id from public.user_roles where user_id = auth.uid())
);

-- USER ROLES
create policy "Users can view own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "Super admins manage roles" on public.user_roles for all to authenticated using (public.has_role('super_admin', null)) with check (public.has_role('super_admin', null));

-- LAPTOPS
create policy "Select laptops in user's companies" on public.laptops for select to authenticated using (
  public.has_role('super_admin', null) or company_id in (select company_id from public.user_roles where user_id = auth.uid())
);
create policy "Admins manage laptops in their company" on public.laptops for all to authenticated using (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
) with check (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
);

-- POLICIES
create policy "Select policies in user's companies" on public.policies for select to authenticated using (
  public.has_role('super_admin', null) or company_id in (select company_id from public.user_roles where user_id = auth.uid())
);
create policy "Admins manage policies in their company" on public.policies for all to authenticated using (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
) with check (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
);

-- REQUESTS
create policy "Employees manage their own requests" on public.requests
for all to authenticated
using (
  employee_id = auth.uid()
) with check (
  employee_id = auth.uid() and company_id in (select company_id from public.user_roles where user_id = auth.uid())
);

create policy "Admins view company requests" on public.requests for select to authenticated using (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
);
create policy "Admins update company requests" on public.requests for update to authenticated using (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
) with check (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
);

-- LOANS
create policy "Employees view their loans" on public.loans for select to authenticated using (employee_id = auth.uid());
create policy "Admins view company loans" on public.loans for select to authenticated using (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
);
create policy "Admins manage company loans" on public.loans for all to authenticated using (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
) with check (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
);

-- REPAYMENTS
create policy "Employees view their repayments" on public.repayments for select to authenticated using (employee_id = auth.uid());
create policy "Admins view company repayments" on public.repayments for select to authenticated using (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
);
create policy "Admins manage company repayments" on public.repayments for all to authenticated using (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
) with check (
  public.has_role('super_admin', null) or public.has_role('admin', company_id)
);
