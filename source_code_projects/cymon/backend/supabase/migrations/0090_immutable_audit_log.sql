-- Make the audit trail structurally append-only (Obj 2.6 / SEC-IT-05).
--
-- Application code writes audit events with the service-role key and the
-- admin UI only reads them, but nothing in the database stopped an UPDATE or
-- DELETE — not even the old scripts/clear_audit.js helper. This trigger turns
-- "append-only by convention" into "append-only by constraint": any attempt
-- to modify or remove a logged event fails loudly instead of silently
-- rewriting history.



CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not allowed (id %)',
    TG_OP, COALESCE(OLD.id::text, 'unknown');
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON public.audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();
