-- 0093: normalize legacy IEP rows stored as progress_summary (non-destructive).
--
-- Migration 0051 already normalized IEP-like titles once, but newer rows can
-- still arrive via the legacy fallback in POST /iep (report_type defaulting to
-- progress_summary when the enum lacks 'iep'). This re-normalizes without
-- deleting any monthly reports, so the suggestion count
-- (GET /roster/:patientId/suggestion) stops counting IEPs as monthlies.
--
-- Safe to re-run.

update public.assessment_reports
set report_type = 'iep'
where report_type = 'progress_summary'
  and title ~* '(individualized education plan|individualized educational plan|\mIEP\M)';
