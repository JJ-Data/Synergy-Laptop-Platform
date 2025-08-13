-- Fix security issue: Restrict invitation access to authorized personnel only
-- Drop existing permissive policies and create more restrictive ones

-- First, drop the existing policies
DROP POLICY IF EXISTS "Super admins manage invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins manage employee invites in company" ON public.invitations;

-- Create new restrictive policies for invitations table
-- Super admins can manage all invitations
CREATE POLICY "Super admins have full invitation access"
ON public.invitations
FOR ALL
TO authenticated
USING (has_role('super_admin'::app_role, NULL::uuid))
WITH CHECK (has_role('super_admin'::app_role, NULL::uuid));

-- Company admins can only manage employee invitations for their own company
CREATE POLICY "Company admins manage employee invitations"
ON public.invitations
FOR ALL
TO authenticated
USING (
  has_role('admin'::app_role, company_id) 
  AND role = 'employee'::app_role
)
WITH CHECK (
  has_role('admin'::app_role, company_id) 
  AND role = 'employee'::app_role
);

-- Users can only view invitations sent to their email address (for accepting invites)
CREATE POLICY "Users can view their own invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND accepted_at IS NULL
  AND expires_at > now()
);

-- Prevent any other access to invitations table
-- This ensures no one else can read invitation tokens or email addresses