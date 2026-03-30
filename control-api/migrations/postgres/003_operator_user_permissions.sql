ALTER TABLE operator_users
  ADD COLUMN IF NOT EXISTS first_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS permissions_json JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE operator_users
SET permissions_json = CASE
  WHEN role = 'platform_admin' THEN jsonb_build_object(
    'manageCustomers', TRUE,
    'manageEnvironments', TRUE,
    'manageOperations', TRUE,
    'manageUsers', TRUE
  )
  ELSE jsonb_build_object(
    'manageCustomers', FALSE,
    'manageEnvironments', FALSE,
    'manageOperations', FALSE,
    'manageUsers', FALSE
  )
END
WHERE permissions_json = '{}'::jsonb
   OR permissions_json IS NULL;
