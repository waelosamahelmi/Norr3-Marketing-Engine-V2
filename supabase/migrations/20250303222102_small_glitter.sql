-- Create contacts table if it doesn't exist
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invitation_lists table if it doesn't exist
CREATE TABLE IF NOT EXISTS invitation_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invitation_list_contacts table if it doesn't exist
CREATE TABLE IF NOT EXISTS invitation_list_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES invitation_lists(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  selected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_list_contacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Drop contacts policies
  DROP POLICY IF EXISTS "Admins can read contacts" ON contacts;
  DROP POLICY IF EXISTS "Admins can insert contacts" ON contacts;
  DROP POLICY IF EXISTS "Admins can update contacts" ON contacts;
  DROP POLICY IF EXISTS "Admins can delete contacts" ON contacts;
  
  -- Drop invitation_lists policies
  DROP POLICY IF EXISTS "Admins can read invitation lists" ON invitation_lists;
  DROP POLICY IF EXISTS "Admins can insert invitation lists" ON invitation_lists;
  DROP POLICY IF EXISTS "Admins can update invitation lists" ON invitation_lists;
  DROP POLICY IF EXISTS "Admins can delete invitation lists" ON invitation_lists;
  
  -- Drop invitation_list_contacts policies
  DROP POLICY IF EXISTS "Admins can read invitation list contacts" ON invitation_list_contacts;
  DROP POLICY IF EXISTS "Admins can insert invitation list contacts" ON invitation_list_contacts;
  DROP POLICY IF EXISTS "Admins can update invitation list contacts" ON invitation_list_contacts;
  DROP POLICY IF EXISTS "Admins can delete invitation list contacts" ON invitation_list_contacts;
END $$;

-- Create policies for contacts table
CREATE POLICY "Admins can read contacts"
  ON contacts
  FOR SELECT
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can insert contacts"
  ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update contacts"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can delete contacts"
  ON contacts
  FOR DELETE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Create policies for invitation_lists table
CREATE POLICY "Admins can read invitation lists"
  ON invitation_lists
  FOR SELECT
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can insert invitation lists"
  ON invitation_lists
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update invitation lists"
  ON invitation_lists
  FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can delete invitation lists"
  ON invitation_lists
  FOR DELETE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Create policies for invitation_list_contacts table
CREATE POLICY "Admins can read invitation list contacts"
  ON invitation_list_contacts
  FOR SELECT
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can insert invitation list contacts"
  ON invitation_list_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update invitation list contacts"
  ON invitation_list_contacts
  FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can delete invitation list contacts"
  ON invitation_list_contacts
  FOR DELETE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');