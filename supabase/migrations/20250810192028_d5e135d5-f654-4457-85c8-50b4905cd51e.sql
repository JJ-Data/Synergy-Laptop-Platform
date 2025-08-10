-- One-time bootstrap: first authenticated user becomes super_admin
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  exists_sa boolean;
BEGIN
  -- If any super_admin already exists, do nothing
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles WHERE role = 'super_admin'
  ) INTO exists_sa;

  IF exists_sa THEN
    RETURN false;
  END IF;

  -- Insert role for current user
  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (auth.uid(), 'super_admin', NULL);

  RETURN true;
END;
$$;