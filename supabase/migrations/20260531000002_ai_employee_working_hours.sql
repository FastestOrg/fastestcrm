-- Migration: Add working hours and timezone columns to ai_employees table

DO $$ BEGIN
  ALTER TABLE public.ai_employees ADD COLUMN working_hours_start TEXT NOT NULL DEFAULT '09:00';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employees ADD COLUMN working_hours_end TEXT NOT NULL DEFAULT '18:00';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employees ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
