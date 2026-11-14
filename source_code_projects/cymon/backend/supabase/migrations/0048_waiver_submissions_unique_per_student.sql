-- 0048_waiver_submissions_unique_per_student.sql
-- Keep only one waiver row per student per document type.

delete from public.waiver_submissions w
using (
  select id,
         row_number() over (
           partition by patient_id, document_type_code
           order by coalesce(updated_at, created_at) desc, coalesce(signed_at, created_at) desc, created_at desc
         ) as rn
  from public.waiver_submissions
) dup
where w.id = dup.id
  and dup.rn > 1;

create unique index if not exists waiver_submissions_patient_doc_unique
  on public.waiver_submissions (patient_id, document_type_code);
