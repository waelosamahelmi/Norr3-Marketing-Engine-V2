-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Drop contacts policies
  DROP POLICY IF EXISTS "Admins can read contacts" ON contacts;
  DROP POLICY IF EXISTS "Admins can insert contacts" ON contacts;
  DROP POLICY IF EXISTS "Admins can update contacts" ON contacts;
  DROP POLICY IF EXISTS "Admins can delete contacts" ON contacts;
  DROP POLICY IF EXISTS "Anyone can delete contacts" ON contacts;
END $$;

-- Create simplified policies for contacts table
CREATE POLICY "Admins can manage contacts"
  ON contacts
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Add indexes to improve performance
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(first_name, last_name);