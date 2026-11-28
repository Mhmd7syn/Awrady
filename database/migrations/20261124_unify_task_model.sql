-- Migration: Unify task model into binary Scheduled vs Unscheduled
-- Deprecates legacy OneTime and Archived task states
-- Maps schedule = 'OneTime' or is_archived = TRUE to schedule = 'Unscheduled'

DO $$
BEGIN
    -- 1. Map legacy OneTime and archived tasks to Unscheduled
    UPDATE public.tasks
    SET schedule = 'Unscheduled',
        is_archived = FALSE
    WHERE schedule = 'OneTime' OR is_archived = TRUE;

    -- 2. Drop legacy one_time_date column if present
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'one_time_date'
    ) THEN
        ALTER TABLE public.tasks DROP COLUMN one_time_date;
    END IF;
END $$;
