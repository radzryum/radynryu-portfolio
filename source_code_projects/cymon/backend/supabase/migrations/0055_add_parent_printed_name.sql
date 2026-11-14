ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS parent_printed_name text;
