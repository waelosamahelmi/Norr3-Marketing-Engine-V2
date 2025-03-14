/*
  # Create admin user

  1. New Admin User
    - Creates an admin user with email 'admin@norr3.fi'
    - Sets up proper authentication and user profile
  2. Security
    - Uses secure password hashing
    - Ensures idempotent execution (can be run multiple times safely)
*/

-- Create a variable to store the user ID
DO $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if the user already exists in auth.users
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'admin@norr3.fi';
  
  -- If user doesn't exist, create it
  IF new_user_id IS NULL THEN
    -- Insert into auth.users
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      role
    ) VALUES (
      gen_random_uuid(),
      'admin@norr3.fi',
      crypt('Admin123', gen_salt('bf')),
      now(),
      now(),
      now(),
      'authenticated'
    )
    RETURNING id INTO new_user_id;
  END IF;
  
  -- Now insert or update the public.users record
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
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    agent_key = EXCLUDED.agent_key,
    partner_name = EXCLUDED.partner_name,
    image_url = EXCLUDED.image_url;
END $$;