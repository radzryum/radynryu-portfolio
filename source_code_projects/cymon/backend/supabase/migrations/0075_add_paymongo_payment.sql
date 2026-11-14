-- Migration 0075: Add PayMongo online payment support to document release requests
-- Adds payment_preference (onsite | online), PayMongo checkout/payment tracking columns,
-- and updates the payment_method constraint to include 'paymongo'.

-- 1. Add payment_preference column
alter table public.assessment_document_release_requests
  add column if not exists payment_preference text not null default 'onsite'
    check (payment_preference in ('onsite', 'online'));

-- 2. Add PayMongo checkout session tracking
alter table public.assessment_document_release_requests
  add column if not exists paymongo_checkout_id text,
  add column if not exists paymongo_payment_id text,
  add column if not exists paymongo_checkout_url text;

-- 3. Widen payment_method to also accept 'paymongo'
-- Drop the old check constraint first (Postgres requires this approach)
alter table public.assessment_document_release_requests
  drop constraint if exists assessment_document_release_requests_payment_method_check;

alter table public.assessment_document_release_requests
  add constraint assessment_document_release_requests_payment_method_check
    check (payment_method in ('cash', 'gcash', 'paymongo'));

-- 4. Index for quick lookup by paymongo_checkout_id (webhook resolution)
create index if not exists assessment_document_release_requests_paymongo_checkout_idx
  on public.assessment_document_release_requests (paymongo_checkout_id)
  where paymongo_checkout_id is not null;

comment on column public.assessment_document_release_requests.payment_preference is
  'Patient-chosen payment path: onsite (pay at clinic counter) or online (PayMongo checkout).';
comment on column public.assessment_document_release_requests.paymongo_checkout_id is
  'PayMongo Checkout Session ID used to redirect the patient to the hosted payment page.';
comment on column public.assessment_document_release_requests.paymongo_payment_id is
  'PayMongo Payment ID received via webhook upon successful payment.';
comment on column public.assessment_document_release_requests.paymongo_checkout_url is
  'PayMongo-hosted checkout URL the patient is redirected to for online payment.';

notify pgrst, 'reload schema';
