-- Set secure search_path for trigger function per linter recommendation
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;