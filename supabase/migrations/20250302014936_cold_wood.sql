/*
  # Reset users and create new admin

  1. Changes
    - Delete all existing users
    - Create new admin user with email wael@helmies.fi
  2. Security
    - Admin user has full access to the system
*/

-- First, try to delete all existing users
DO $$
BEGIN
  -- Delete from public.users first (due to foreign key constraint)
  DELETE FROM public.users;
  
  -- Then try to delete from auth.users
  DELETE FROM auth.users;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but continue
    RAISE NOTICE 'Error deleting users: %', SQLERRM;
END $$;

-- Create a new admin user with proper authentication
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  -- Insert into auth.users with proper authentication and explicit ID
  INSERT INTO auth.users (
    id,
    email,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    role
  ) VALUES (
    new_user_id,
    'wael@helmies.fi',
    '{"provider":"email","providers":["email"]}',
    '{}',
    FALSE,
    crypt('Admin@1234', gen_salt('bf')),
    now(),
    now(),
    now(),
    'authenticated'
  );

  -- Insert into public.users with admin role
  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    agent_key,
    partner_name,
    image_url,
    created_at
  ) VALUES (
    new_user_id,
    'wael@helmies.fi',
    'Wael Admin',
    'admin',
    'admin123',
    'NØRR3',
    'https://norr3.fi/wp-content/uploads/2023/06/logo_valk-web.png',
    now()
  );
END $$;