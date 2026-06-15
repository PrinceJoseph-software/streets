-- =============================================================================
-- STREETS — Phase 1: pg_cron Schedule
-- Run AFTER 001_schema.sql and 002_functions.sql
--
-- BEFORE running this file, you must enable pg_cron in Supabase:
--   Dashboard → Database → Extensions → search "pg_cron" → toggle ON
--
-- pg_cron jobs run as the 'postgres' superuser, which bypasses RLS —
-- correct for recompute_pulse (it writes rankings and ledger rows).
-- =============================================================================

-- Remove existing job if it exists — uses a DO block because
-- cron.unschedule() raises an exception if the job doesn't exist,
-- and you cannot use WHERE on a bare SELECT function() call.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'streets-recompute-pulse'
  ) THEN
    PERFORM cron.unschedule('streets-recompute-pulse');
  END IF;
END $$;

-- Schedule recompute_pulse every 3 minutes
SELECT cron.schedule(
  'streets-recompute-pulse',          -- job name (unique key)
  '*/3 * * * *',                      -- every 3 minutes
  'SELECT public.recompute_pulse()'
);

-- Verify the job is registered
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'streets-recompute-pulse';
