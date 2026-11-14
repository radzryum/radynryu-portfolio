-- Migration: 0033_add_daily_activity_report_type.sql
-- Add 'daily_activity' to report_type enum for auto-populated DAR entries

ALTER TYPE public.report_type ADD VALUE IF NOT EXISTS 'daily_activity';
