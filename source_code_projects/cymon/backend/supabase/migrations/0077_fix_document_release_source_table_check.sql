-- Fix: the app allows session_logs as a source_table for document release items
-- but the original check constraint only permitted assessment_submissions and assessment_reports.
-- This causes a check constraint violation when clients request release of Daily Activity Reports.

ALTER TABLE assessment_document_release_items
  DROP CONSTRAINT IF EXISTS assessment_document_release_items_source_table_check;

ALTER TABLE assessment_document_release_items
  ADD CONSTRAINT assessment_document_release_items_source_table_check
  CHECK (source_table IN ('assessment_submissions', 'assessment_reports', 'session_logs'));
