/*
  # Manager User Management Access

  1. Changes
     - Add policies to allow managers to create, read, update, and delete partner users
     - Managers can view all users but only manage (edit/delete) partners

  2. Security
     - Managers cannot modify admin or other manager accounts
     - Managers can create new partner accounts
*/

-- Allow managers to view all users
CREATE POLICY "managers_view_all_users"
ON public.users
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
);

-- Allow managers to create partner users
CREATE POLICY "managers_create_partner_users"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (
  -- Manager can only create partner users
  (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
  AND (role = 'partner')
);

-- Allow managers to update partner users
CREATE POLICY "managers_update_partner_users"
ON public.users
FOR UPDATE
TO authenticated
USING (
  -- Manager can only update partner users
  (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
  AND (users.role = 'partner')
)
WITH CHECK (
  -- Ensure they can't change role to admin or manager
  (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
  AND (role = 'partner')
);

-- Allow managers to delete partner users
CREATE POLICY "managers_delete_partner_users"
ON public.users
FOR DELETE
TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
  AND (users.role = 'partner')
);