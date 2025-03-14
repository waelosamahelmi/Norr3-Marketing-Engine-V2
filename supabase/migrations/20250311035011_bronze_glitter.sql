/*
  # Add agency_id to campaigns table

  1. Changes
    - Add agency_id column to campaigns table
    - Add foreign key constraint to agencies table
    - Add index on agency_id for better query performance

  2. Security
    - No changes to RLS policies needed as existing policies cover the new column
*/

-- Add agency_id column to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS agency_id text REFERENCES agencies(agency_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_campaigns_agency_id ON campaigns(agency_id);