/*
  # Fix User Policies to Prevent Recursion

  1. Changes
     - Drop and recreate user policies to prevent infinite recursion
     - Simplify policy checks to avoid circular dependencies
     - Maintain existing access control rules with corrected implementation

  2. Security
     - Maintain role-based access control
     - Prevent privilege escalation
     - Keep existing functionality while fixing recursion issues
*/

-- First disable RLS temporarily to avoid any issues during policy updates
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "admins_delete_any_user" ON public.users;
DROP POLICY IF EXISTS "admins_read_all_users" ON public.users;
DROP POLICY IF EXISTS "admins_update_any_user" ON public.users;
DROP POLICY IF EXISTS "anyone_insert_users" ON public.users;
DROP POLICY IF EXISTS "managers_create_partner_users" ON public.users;
DROP POLICY IF EXISTS "managers_delete_partner_users" ON public.users;
DROP POLICY IF EXISTS "managers_update_partner_users" ON public.users;
DROP POLICY IF EXISTS "managers_view_all_users" ON public.users;
DROP POLICY IF EXISTS "users_read_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users au 
    JOIN public.users pu ON au.id = pu.id 
    WHERE au.id = auth.uid() AND pu.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is manager
CREATE OR REPLACE FUNCTION public.check_is_manager()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users au 
    JOIN public.users pu ON au.id = pu.id 
    WHERE au.id = auth.uid() AND pu.role = 'manager'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create new policies using the helper functions

-- Admin policies
CREATE POLICY "admins_read_all_users"
ON public.users
FOR SELECT
TO authenticated
USING (check_is_admin());

CREATE POLICY "admins_update_any_user"
ON public.users
FOR UPDATE
TO authenticated
USING (check_is_admin())
WITH CHECK (check_is_admin());

CREATE POLICY "admins_delete_any_user"
ON public.users
FOR DELETE
TO authenticated
USING (check_is_admin());

-- Manager policies
CREATE POLICY "managers_view_all_users"
ON public.users
FOR SELECT
TO authenticated
USING (check_is_manager());

CREATE POLICY "managers_create_partner_users"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  check_is_manager() AND
  role = 'partner'
);

CREATE POLICY "managers_update_partner_users"
ON public.users
FOR UPDATE
TO authenticated
USING (
  check_is_manager() AND
  role = 'partner'
)
WITH CHECK (
  check_is_manager() AND
  role = 'partner'
);

CREATE POLICY "managers_delete_partner_users"
ON public.users
FOR DELETE
TO authenticated
USING (
  check_is_manager() AND
  role = 'partner'
);

-- User self-access policies
CREATE POLICY "users_read_own"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "users_update_own"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  role = (SELECT role FROM auth.users WHERE id = auth.uid())
);

-- Public signup policy (for new user registration)
CREATE POLICY "anyone_insert_users"
ON public.users
FOR INSERT
TO public
WITH CHECK (role = 'partner');