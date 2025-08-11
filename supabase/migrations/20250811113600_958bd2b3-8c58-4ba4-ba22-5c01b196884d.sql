-- Invitations feature: table, RLS, and helper functions (fixed policy creation)
-- 1) Create invitations table
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.app_role not null,
  company_id uuid references public.companies(id) on delete cascade,
  token text not null unique,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid
);

-- Enable RLS
alter table public.invitations enable row level security;

-- Policies: drop if exist then (re)create
drop policy if exists "Super admins manage invitations" on public.invitations;
create policy "Super admins manage invitations"
  on public.invitations
  as permissive
  for all
  using (public.has_role('super_admin'::public.app_role, null))
  with check (public.has_role('super_admin'::public.app_role, null));

drop policy if exists "Admins manage employee invites in company" on public.invitations;
create policy "Admins manage employee invites in company"
  on public.invitations
  as permissive
  for all
  using (
    public.has_role('admin'::public.app_role, company_id) AND role = 'employee'
  )
  with check (
    public.has_role('admin'::public.app_role, company_id) AND role = 'employee'
  );

-- Helpful indexes
create index if not exists invitations_email_idx on public.invitations (email);
create index if not exists invitations_company_idx on public.invitations (company_id);
create index if not exists invitations_expires_idx on public.invitations (expires_at);

-- 2) Function to create an invitation
create or replace function public.create_invitation(
  _email text,
  _role public.app_role,
  _company_id uuid,
  _expires_at timestamptz default (now() + interval '7 days')
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_token text;
  can_create boolean;
begin
  -- Authorization checks
  if _role = 'admin' then
    can_create := public.has_role('super_admin', null);
  elsif _role = 'employee' then
    can_create := public.has_role('super_admin', null) or public.has_role('admin', _company_id);
  else
    -- other roles not supported here
    can_create := false;
  end if;

  if not can_create then
    raise exception 'not authorized to create this invitation';
  end if;

  if _company_id is null then
    raise exception 'company_id is required';
  end if;

  -- Generate a random token (UUID-based, dashless)
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.invitations (email, role, company_id, token, created_by, expires_at)
  values (_email, _role, _company_id, v_token, auth.uid(), _expires_at);

  return v_token;
end;
$$;

-- 3) Function to accept an invitation
create or replace function public.accept_invitation(
  _token text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv record;
  already boolean;
begin
  select * into inv
  from public.invitations i
  where i.token = _token
    and i.accepted_at is null
    and i.expires_at > now()
  limit 1;

  if not found then
    return false;
  end if;

  -- Ensure user doesn't already have this role for the company
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = inv.role and coalesce(ur.company_id, inv.company_id) is not distinct from coalesce(inv.company_id, ur.company_id)
  ) into already;

  if not already then
    insert into public.user_roles (user_id, role, company_id)
    values (auth.uid(), inv.role, inv.company_id);
  end if;

  update public.invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = inv.id;

  return true;
end;
$$;