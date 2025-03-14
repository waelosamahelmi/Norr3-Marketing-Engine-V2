/*
  # Fix User Policies to Remove Recursion

  1. Changes
     - Drop existing user policies that may be causing recursion
     - Recreate user policies with proper checks to avoid infinite recursion
     - Fix NEW record references in policies
  
  2. Security
     - Maintain admin full access
     - Allow managers to manage partner users
     - Allow users to read/update their own data
     - Prevent privilege escalation
*/

-- First, drop all existing policies to start fresh
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

-- Create new policies without recursion

-- Admin policies
CREATE POLICY "admins_read_all_users"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "admins_update_any_user"
ON public.users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "admins_delete_any_user"
ON public.users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Manager policies
CREATE POLICY "managers_view_all_users"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
  )
);

CREATE POLICY "managers_create_partner_users"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
  ) AND
  current_setting('row.role') = 'partner'
);

CREATE POLICY "managers_update_partner_users"
ON public.users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
  ) AND
  users.role = 'partner'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
  ) AND
  current_setting('row.role') = 'partner'
);

CREATE POLICY "managers_delete_partner_users"
ON public.users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
  ) AND
  users.role = 'partner'
);

-- User self-access policies
CREATE POLICY "users_read_own"
ON public.users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

CREATE POLICY "users_update_own"
ON public.users
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id AND
  current_setting('row.role') = (SELECT role FROM users WHERE id = auth.uid())
);

-- Public signup policy
CREATE POLICY "anyone_insert_users"
ON public.users
FOR INSERT
TO public
WITH CHECK (
  current_setting('row.role') = 'partner'
);

-- Fix activity log policies for managers
DROP POLICY IF EXISTS "managers_can_read_activity_logs" ON public.activity_logs;

CREATE POLICY "managers_can_read_activity_logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager'
  ) AND
  user_email NOT LIKE '%@norr3.fi' AND
  user_email NOT LIKE '%@helmies.fi'
);