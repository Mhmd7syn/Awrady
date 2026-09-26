-- ============================================================================
-- Awrady Dashboard (أورادي)
-- Supabase Database Schema for 24/7 Cloud Sync
-- ============================================================================
-- Run this script in your Supabase project: SQL Editor -> New Query -> Run

-- 1. Create the sync table
CREATE TABLE IF NOT EXISTS public.awrady_sync (
    id TEXT PRIMARY KEY DEFAULT 'primary_user',
    data JSONB NOT NULL,
    version BIGINT DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row-Level Security (RLS)
ALTER TABLE public.awrady_sync ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow read access via API anon key
CREATE POLICY "Allow anon read access"
ON public.awrady_sync
FOR SELECT
TO anon
USING (true);

-- 4. Policy: Allow write/upsert access via API anon key
CREATE POLICY "Allow anon insert & update access"
ON public.awrady_sync
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- 5. Enable Real-Time publication for instant multi-device syncing
ALTER PUBLICATION supabase_realtime ADD TABLE public.awrady_sync;

-- All set! Your database is now ready for instant multi-device sync.
