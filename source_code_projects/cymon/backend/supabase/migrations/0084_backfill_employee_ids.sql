-- 0084_backfill_employee_ids.sql
-- Every employee (staff + admins) must have an Employee ID so the sidebar can
-- always show one. Admin creation already auto-generates CMPS-EMP-<year>-<seq>,
-- but clinical staff historically were created with a NULL employee_id. Backfill
-- those now. Clients are excluded: they use patient_id, not an employee_id.
--
-- The generated IDs reuse the same format and share the global sequence counter
-- as the API, so newly created employees (count + 1) will not collide.

DO $$
DECLARE
  r RECORD;
  seq INT;
  candidate TEXT;
  existing BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO seq FROM public.profiles WHERE employee_id IS NOT NULL;

  FOR r IN
    SELECT id, EXTRACT(YEAR FROM created_at)::INT AS yr
    FROM public.profiles
    WHERE role <> 'client' AND employee_id IS NULL
    ORDER BY created_at, id
  LOOP
    seq := seq + 1;
    candidate := 'CMPS-EMP-' || r.yr || '-' || LPAD(seq::TEXT, 3, '0');
    LOOP
      SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE employee_id = candidate
      ) INTO existing;
      EXIT WHEN NOT existing;
      seq := seq + 1;
      candidate := 'CMPS-EMP-' || r.yr || '-' || LPAD(seq::TEXT, 3, '0');
    END LOOP;

    UPDATE public.profiles SET employee_id = candidate WHERE id = r.id;
  END LOOP;
END $$;
