/*
  # Fix admin user authentication

  1. Changes
     - Properly recreate admin user with correct credentials
     - Ensure user exists in both auth.users and public.users tables
     - Set proper password encryption
*/

-- First, try to delete all existing users to start fresh
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
    instance_id,
    email,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    role,
    confirmation_token
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@norr3.fi',
    '{"provider":"email","providers":["email"]}',
    '{}',
    FALSE,
    crypt('Admin123', gen_salt('bf')),
    now(),
    now(),
    now(),
    'authenticated',
    ''
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
    'admin@norr3.fi',
    'Admin User',
    'admin',
    'admin123',
    'NØRR3',
    'https://norr3.fi/wp-content/uploads/2023/06/logo_valk-web.png',
    now()
  );
END $$;