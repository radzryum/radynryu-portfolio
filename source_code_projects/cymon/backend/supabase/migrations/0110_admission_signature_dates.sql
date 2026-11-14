-- Admission signature dates: the FO-01 sign-off captions read
-- "SIGNATURE OVER PRINTED NAME ... /DATE", but only the ink was stored.
-- These columns persist the DatePicker values from the admission form
-- (parent + CMPS representative) so the official PDF can print them.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS parent_signature_date date;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS rep_signature_date date;
