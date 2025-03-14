/*
  # Update User Role Check Constraint

  1. Changes
     - Modify the existing "users_role_check" constraint to include the "manager" role option
     - This allows users to have the "manager" role in addition to "admin" and "partner"
     
  2. Security
     - No changes to existing security policies or RLS
*/

-- Update the role check constraint to include the "manager" role
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role = ANY (ARRAY['admin'::text, 'partner'::text, 'manager'::text]));