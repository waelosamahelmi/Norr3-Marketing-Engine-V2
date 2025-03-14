/*
  # Add Manager Access to Activity Logs

  1. Changes
     - Add policy for managers to read (SELECT) activity logs
     - Exclude logs from users with email domains norr3.fi and helmies.fi
  
  2. Security
     - Managers will be able to view activity logs for most users
     - Sensitive logs from norr3.fi and helmies.fi domains will remain private
*/

-- Create policy for managers to read activity logs (excluding specific domains)
CREATE POLICY "managers_can_read_activity_logs" 
ON public.activity_logs
FOR SELECT 
TO authenticated
USING (
  (
    -- Check if user is a manager
    (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
    -- And the email in the activity log is not from norr3.fi or helmies.fi
    AND (user_email NOT ILIKE '%@norr3.fi' AND user_email NOT ILIKE '%@helmies.fi')
  )
);