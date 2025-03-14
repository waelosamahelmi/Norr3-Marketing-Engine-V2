/*
  # Fix date format for campaigns table

  1. Changes
    - Modify campaign_start_date and campaign_end_date columns to use text type instead of date
    - This allows storing dates in YYYY-MM format
  
  2. Data Migration
    - Convert existing date values to YYYY-MM format
*/

-- First, create temporary columns with text type
ALTER TABLE campaigns ADD COLUMN campaign_start_date_text TEXT;
ALTER TABLE campaigns ADD COLUMN campaign_end_date_text TEXT;

-- Copy data from date columns to text columns in YYYY-MM format
UPDATE campaigns 
SET 
  campaign_start_date_text = to_char(campaign_start_date, 'YYYY-MM'),
  campaign_end_date_text = CASE 
    WHEN campaign_end_date IS NOT NULL THEN to_char(campaign_end_date, 'YYYY-MM')
    ELSE NULL
  END;

-- Drop the original date columns
ALTER TABLE campaigns DROP COLUMN campaign_start_date;
ALTER TABLE campaigns DROP COLUMN campaign_end_date;

-- Rename the text columns to the original column names
ALTER TABLE campaigns RENAME COLUMN campaign_start_date_text TO campaign_start_date;
ALTER TABLE campaigns RENAME COLUMN campaign_end_date_text TO campaign_end_date;

-- Add NOT NULL constraint to campaign_start_date
ALTER TABLE campaigns ALTER COLUMN campaign_start_date SET NOT NULL;