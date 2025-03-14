/*
  # Fix admin user setup

  1. Changes
    - Drops and recreates the admin user with proper authentication
    - Ensures the admin user exists in both auth.users and public.users tables
    - Sets proper role and permissions
    - Explicitly sets UUID for the user to avoid null ID issues
*/

-- First, try to delete the existing admin user if it exists
DO $$
BEGIN
  -- Delete from public.users first (due to foreign key constraint)
  DELETE FROM public.users WHERE email = 'admin@norr3.fi';
  
  -- Then try to delete from auth.users
  DELETE FROM auth.users WHERE email = 'admin@norr3.fi';
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if user doesn't exist
    NULL;
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
    'admin@norr3.fi',
    '{"provider":"email","providers":["email"]}',
    '{}',
    FALSE,
    crypt('Admin123', gen_salt('bf')),
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
    'admin@norr3.fi',
    'Admin User',
    'admin',
    'admin123',
    'NØRR3',
    'https://norr3.fi/wp-content/uploads/2023/06/logo_valk-web.png',
    now()
  );
END $$;