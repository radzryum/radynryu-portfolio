-- Migration: 0035_widen_session_activity.sql
-- Widen activity column from VARCHAR(255) to TEXT to support longer session activity titles

alter table public.student_session_records alter column activity type text;
