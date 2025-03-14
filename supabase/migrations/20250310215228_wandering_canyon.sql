/*
  # Add Manager Role

  1. Changes
    - Add 'manager' as a valid role in the users table
    - Update existing role check constraint

  2. Security
    - Maintains role-based access control
    - Adds new role type without disrupting existing roles
*/

-- Drop existing role check constraint
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new role check constraint including manager role
ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role = ANY (ARRAY['admin'::text, 'partner'::text, 'manager'::text]));