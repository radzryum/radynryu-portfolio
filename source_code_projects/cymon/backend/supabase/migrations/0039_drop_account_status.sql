-- account_status duplicated the existing patients.status (patient_status enum).
-- Registration now sets status = 'active' directly.
ALTER TABLE patients DROP COLUMN IF EXISTS account_status;
