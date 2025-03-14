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

-- Create more permissive policies for contacts table
CREATE POLICY "Admins can read contacts"
  ON contacts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert contacts"
  ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update contacts"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can delete contacts"
  ON contacts
  FOR DELETE
  TO authenticated
  USING (true);

-- Add indexes to improve performance
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(first_name, last_name);