/*
  # Add manager role

  1. Changes
    - Update users table role constraint to include 'manager' role
    - Update existing policies to include manager role access

  2. Security
    - Managers will have access to all campaigns but not administrative features
    - Maintains existing RLS policies while adding manager permissions
*/

-- Update the role check constraint to include manager role
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role = ANY (ARRAY['admin'::text, 'partner'::text, 'manager'::text]));

-- Update campaigns policies to include manager role
CREATE POLICY "managers_read_all_campaigns" ON campaigns
FOR SELECT TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
);

CREATE POLICY "managers_update_all_campaigns" ON campaigns
FOR UPDATE TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
)
WITH CHECK (
  (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
);

CREATE POLICY "managers_delete_all_campaigns" ON campaigns
FOR DELETE TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
);

CREATE POLICY "managers_insert_campaigns" ON campaigns
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
);