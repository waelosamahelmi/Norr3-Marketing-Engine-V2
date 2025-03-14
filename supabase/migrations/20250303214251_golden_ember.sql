/*
  # Add agencies table and mapping

  1. New Tables
    - `agencies`
      - `id` (uuid, primary key)
      - `agency_id` (text, unique) - The ID from the JSON feed
      - `name` (text) - The human-readable agency name
      - `email` (text) - Agency email address
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `agencies` table
    - Add policies for admins to manage agencies
    - Add policies for all users to read agencies
*/

-- Create agencies table
CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read agencies
CREATE POLICY "Anyone can read agencies"
  ON agencies
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to insert agencies
CREATE POLICY "Admins can insert agencies"
  ON agencies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Allow admins to update agencies
CREATE POLICY "Admins can update agencies"
  ON agencies
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Allow admins to delete agencies
CREATE POLICY "Admins can delete agencies"
  ON agencies
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Add some initial agencies as examples
INSERT INTO agencies (agency_id, name, email) VALUES
  ('km-helsinki', 'Kiinteistömaailma Helsinki', 'helsinki@kiinteistomaailma.fi'),
  ('km-espoo', 'Kiinteistömaailma Espoo', 'espoo@kiinteistomaailma.fi')
ON CONFLICT (agency_id) DO NOTHING;