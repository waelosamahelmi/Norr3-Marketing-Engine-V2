/*
  # Create campaigns table

  1. New Tables
    - `campaigns`
      - `id` (uuid, primary key)
      - `partner_id` (text)
      - `partner_name` (text)
      - `agent` (text)
      - `agent_key` (text)
      - `campaign_address` (text)
      - `campaign_postal_code` (text)
      - `campaign_city` (text)
      - `campaign_radius` (integer)
      - `campaign_start_date` (date)
      - `campaign_end_date` (date, nullable)
      - `active` (boolean)
      - `channel_meta` (integer)
      - `channel_display` (integer)
      - `channel_pdooh` (integer)
      - `budget_meta` (numeric)
      - `budget_display` (numeric)
      - `budget_pdooh` (numeric)
      - `budget_meta_daily` (numeric)
      - `budget_display_daily` (numeric)
      - `budget_pdooh_daily` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (text)
      - `user_id` (uuid, references users.id)
  2. Security
    - Enable RLS on `campaigns` table
    - Add policy for authenticated users to read their own campaigns
    - Add policy for admins to read all campaigns
    - Add policy for users to update their own campaigns
    - Add policy for admins to update all campaigns
*/

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id text NOT NULL,
  partner_name text NOT NULL,
  agent text NOT NULL,
  agent_key text NOT NULL,
  campaign_address text NOT NULL,
  campaign_postal_code text NOT NULL,
  campaign_city text NOT NULL,
  campaign_radius integer NOT NULL DEFAULT 1500,
  campaign_start_date date NOT NULL,
  campaign_end_date date,
  active boolean NOT NULL DEFAULT true,
  channel_meta integer NOT NULL DEFAULT 0,
  channel_display integer NOT NULL DEFAULT 0,
  channel_pdooh integer NOT NULL DEFAULT 0,
  budget_meta numeric NOT NULL DEFAULT 0,
  budget_display numeric NOT NULL DEFAULT 0,
  budget_pdooh numeric NOT NULL DEFAULT 0,
  budget_meta_daily numeric NOT NULL DEFAULT 0,
  budget_display_daily numeric NOT NULL DEFAULT 0,
  budget_pdooh_daily numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text NOT NULL,
  user_id uuid REFERENCES users(id) NOT NULL
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own campaigns
CREATE POLICY "Users can read own campaigns"
  ON campaigns
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy: Users can insert their own campaigns
CREATE POLICY "Users can insert own campaigns"
  ON campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy: Users can update their own campaigns
CREATE POLICY "Users can update own campaigns"
  ON campaigns
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy: Users can delete their own campaigns
CREATE POLICY "Users can delete own campaigns"
  ON campaigns
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );