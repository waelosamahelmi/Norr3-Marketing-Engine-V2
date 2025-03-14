/*
  # Add BidTheatre Integration Fields

  1. Changes
     - Adds BidTheatre integration fields to campaigns table

  2. New Fields
     - bt_campaign_id: The BidTheatre campaign ID
     - bt_sync_status: The synchronization status with BidTheatre
     - bt_last_sync: The timestamp of the last synchronization
     - bt_sync_error: The error message if synchronization failed
*/

-- Add BidTheatre campaign ID column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'bt_campaign_id'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN bt_campaign_id TEXT;
  END IF;
END $$;

-- Add BidTheatre sync status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'bt_sync_status'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN bt_sync_status TEXT;
  END IF;
END $$;

-- Add BidTheatre last sync timestamp column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'bt_last_sync'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN bt_last_sync TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add BidTheatre sync error column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'bt_sync_error'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN bt_sync_error TEXT;
  END IF;
END $$;