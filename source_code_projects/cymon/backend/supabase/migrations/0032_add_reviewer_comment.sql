-- Migration: 0032_add_reviewer_comment.sql
-- Add reviewer_comment column to assessment_reports and assessment_submissions

alter table public.assessment_reports     add column if not exists reviewer_comment text;
alter table public.assessment_submissions add column if not exists reviewer_comment text;
