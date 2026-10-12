-- ============================================================================
-- Enjaz (Awrady) - PostgreSQL Database Schema for Supabase
-- Fully idempotent: safe to run multiple times without errors
-- ============================================================================

-- 1. USERS
CREATE TABLE IF NOT EXISTS public.users (
    username VARCHAR(100) PRIMARY KEY,
    password_hash TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Seed default user
INSERT INTO public.users (username, password_hash)
VALUES ('primary_user', '')
ON CONFLICT (username) DO NOTHING;

-- 2. TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
    username VARCHAR(100) NOT NULL REFERENCES public.users(username) ON DELETE CASCADE ON UPDATE CASCADE,
    task_id VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    target NUMERIC DEFAULT 1,
    schedule VARCHAR(100) DEFAULT 'Everyday',
    is_archived BOOLEAN DEFAULT FALSE,
    total_achieved NUMERIC DEFAULT 0 NOT NULL,
    total_hours NUMERIC DEFAULT 0 NOT NULL,
    total_score NUMERIC DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (username, task_id)
);

-- 3. DAILY PROGRESS (Precalculated day snapshots for instant UI rendering)
CREATE TABLE IF NOT EXISTS public.daily_progress (
    username VARCHAR(100) NOT NULL REFERENCES public.users(username) ON DELETE CASCADE ON UPDATE CASCADE,
    date DATE NOT NULL,
    task_progress JSONB DEFAULT '{}'::jsonb NOT NULL,
    total_score NUMERIC DEFAULT 0 NOT NULL,
    total_hours NUMERIC DEFAULT 0 NOT NULL,
    prayer_extras JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (username, date)
);

-- Ensure updated_at exists if tables were already created
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.daily_progress ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.daily_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_tasks ON public.tasks;
CREATE TRIGGER set_updated_at_tasks
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_daily_progress ON public.daily_progress;
CREATE TRIGGER set_updated_at_daily_progress
    BEFORE UPDATE ON public.daily_progress
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Automatic lowercase username normalization trigger function
CREATE OR REPLACE FUNCTION public.handle_lowercase_username()
RETURNS TRIGGER AS $$
BEGIN
    NEW.username = LOWER(TRIM(NEW.username));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_lowercase_username_users ON public.users;
CREATE TRIGGER ensure_lowercase_username_users
    BEFORE INSERT OR UPDATE OF username ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_lowercase_username();

DROP TRIGGER IF EXISTS ensure_lowercase_username_tasks ON public.tasks;
CREATE TRIGGER ensure_lowercase_username_tasks
    BEFORE INSERT OR UPDATE OF username ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_lowercase_username();

DROP TRIGGER IF EXISTS ensure_lowercase_username_daily_progress ON public.daily_progress;
CREATE TRIGGER ensure_lowercase_username_daily_progress
    BEFORE INSERT OR UPDATE OF username ON public.daily_progress
    FOR EACH ROW EXECUTE FUNCTION public.handle_lowercase_username();

-- Ensure lowercase username constraints exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_username_lowercase_check'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_username_lowercase_check CHECK (username = LOWER(TRIM(username)));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tasks_username_lowercase_check'
    ) THEN
        ALTER TABLE public.tasks ADD CONSTRAINT tasks_username_lowercase_check CHECK (username = LOWER(TRIM(username)));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'daily_progress_username_lowercase_check'
    ) THEN
        ALTER TABLE public.daily_progress ADD CONSTRAINT daily_progress_username_lowercase_check CHECK (username = LOWER(TRIM(username)));
    END IF;
END $$;

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_tasks_user_cat_sub ON public.tasks (username, category, subcategory);
CREATE INDEX IF NOT EXISTS idx_daily_progress_user_date ON public.daily_progress (username, date DESC);

-- 5. ROW-LEVEL SECURITY (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_progress ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Allow access on users" ON public.users;
DROP POLICY IF EXISTS "Allow access on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow access on daily progress" ON public.daily_progress;

CREATE POLICY "Allow access on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access on tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access on daily progress" ON public.daily_progress FOR ALL USING (true) WITH CHECK (true);

-- 6. REALTIME PUBLICATION (Enables live multi-device WebSockets sync)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'daily_progress'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_progress;
    END IF;
END $$;
