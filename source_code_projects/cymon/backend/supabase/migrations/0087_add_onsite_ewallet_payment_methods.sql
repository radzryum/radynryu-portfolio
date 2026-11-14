-- Migration 0087: Add onsite e-wallet/bank payment methods to document release requests
-- Widens the payment_method constraint to also accept 'maya', 'gotyme', and 'maribank'.

alter table public.assessment_document_release_requests
  drop constraint if exists assessment_document_release_requests_payment_method_check;

alter table public.assessment_document_release_requests
  add constraint assessment_document_release_requests_payment_method_check
    check (payment_method in ('cash', 'gcash', 'maya', 'gotyme', 'maribank', 'paymongo'));

notify pgrst, 'reload schema';
