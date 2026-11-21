-- ============================================================================
-- Awrady (أورادي) - PostgreSQL Database Schema for Supabase
-- Fully idempotent: safe to run multiple times on fresh or existing databases
-- Production-grade Supabase Auth integration & Row Level Security (RLS)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. PRE-MIGRATION REPLICA IDENTITY & CONSTRAINT SAFEGUARDS
-- When tables are published to supabase_realtime, dropping a primary key blocks
-- DELETE statements unless REPLICA IDENTITY is set to FULL.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        ALTER TABLE public.users REPLICA IDENTITY FULL;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tasks') THEN
        ALTER TABLE public.tasks REPLICA IDENTITY FULL;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_progress') THEN
        ALTER TABLE public.daily_progress REPLICA IDENTITY FULL;
    END IF;

    -- Drop legacy foreign keys early to decouple table migrations
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_username_fkey') THEN
        ALTER TABLE public.tasks DROP CONSTRAINT tasks_username_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_progress_username_fkey') THEN
        ALTER TABLE public.daily_progress DROP CONSTRAINT daily_progress_username_fkey;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. USERS PROFILE TABLE (Linked to auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Upgrade from legacy schema if public.users exists without id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
    ) THEN
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey;
        ALTER TABLE public.users ADD COLUMN id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
        DELETE FROM public.users WHERE id IS NULL;
        ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
        ALTER TABLE public.users ADD CONSTRAINT users_username_unique UNIQUE (username);
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
    ) THEN
        DELETE FROM public.users WHERE id IS NULL;
        ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey' AND contype = 'p') THEN
            ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
        END IF;
    END IF;
END $$;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. TASKS TABLE (Scoped by user_id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id VARCHAR(100) NOT NULL,
    username VARCHAR(100),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    target NUMERIC DEFAULT 1,
    schedule VARCHAR(100) DEFAULT 'Everyday',
    daily_targets JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    total_achieved NUMERIC DEFAULT 0 NOT NULL,
    total_hours NUMERIC DEFAULT 0 NOT NULL,
    total_score NUMERIC DEFAULT 0 NOT NULL,
    one_time_date DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (user_id, task_id)
);

-- Upgrade existing tasks table if missing user_id or legacy PK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.tasks ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tasks_pkey' AND contype = 'p'
    ) OR EXISTS (
        SELECT 1 FROM information_schema.key_column_usage 
        WHERE table_schema = 'public' AND table_name = 'tasks' AND constraint_name = 'tasks_pkey' AND column_name = 'username'
    ) THEN
        ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_pkey;
        DELETE FROM public.tasks WHERE user_id IS NULL;
        ALTER TABLE public.tasks ALTER COLUMN user_id SET NOT NULL;
        ALTER TABLE public.tasks ADD PRIMARY KEY (user_id, task_id);
    END IF;
END $$;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS daily_targets JSONB DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS one_time_date DATE;

-- ----------------------------------------------------------------------------
-- 3. DAILY PROGRESS TABLE (Scoped by user_id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_progress (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    username VARCHAR(100),
    task_progress JSONB DEFAULT '{}'::jsonb NOT NULL,
    total_score NUMERIC DEFAULT 0 NOT NULL,
    total_hours NUMERIC DEFAULT 0 NOT NULL,
    prayer_extras JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (user_id, date)
);

-- Upgrade existing daily_progress table if missing user_id or legacy PK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'daily_progress' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.daily_progress ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'daily_progress_pkey' AND contype = 'p'
    ) OR EXISTS (
        SELECT 1 FROM information_schema.key_column_usage 
        WHERE table_schema = 'public' AND table_name = 'daily_progress' AND constraint_name = 'daily_progress_pkey' AND column_name = 'username'
    ) THEN
        ALTER TABLE public.daily_progress DROP CONSTRAINT IF EXISTS daily_progress_pkey;
        DELETE FROM public.daily_progress WHERE user_id IS NULL;
        ALTER TABLE public.daily_progress ALTER COLUMN user_id SET NOT NULL;
        ALTER TABLE public.daily_progress ADD PRIMARY KEY (user_id, date);
    END IF;
END $$;

ALTER TABLE public.daily_progress ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.daily_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. RESTORE DEFAULT REPLICA IDENTITY (Using new primary keys)
-- ----------------------------------------------------------------------------
ALTER TABLE public.users REPLICA IDENTITY DEFAULT;
ALTER TABLE public.tasks REPLICA IDENTITY DEFAULT;
ALTER TABLE public.daily_progress REPLICA IDENTITY DEFAULT;

-- ----------------------------------------------------------------------------
-- 5. TRIGGERS & FUNCTIONS
-- ----------------------------------------------------------------------------

-- Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_users ON public.users;
CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_tasks ON public.tasks;
CREATE TRIGGER set_updated_at_tasks
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_daily_progress ON public.daily_progress;
CREATE TRIGGER set_updated_at_daily_progress
    BEFORE UPDATE ON public.daily_progress
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-confirm synthetic username-only users so they are not blocked by "Confirm email"
CREATE OR REPLACE FUNCTION public.handle_synthetic_user_confirm()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email LIKE '%.awrady@gmail.com' OR NEW.email LIKE '%@awrady.internal' THEN
        IF NEW.email_confirmed_at IS NULL THEN
            NEW.email_confirmed_at := timezone('utc'::text, now());
        END IF;
        IF NEW.confirmed_at IS NULL THEN
            NEW.confirmed_at := timezone('utc'::text, now());
        END IF;
    END IF;

    -- If an email update queued a synthetic address, promote it immediately without sending confirmation emails
    IF NEW.new_email LIKE '%.awrady@gmail.com' OR NEW.new_email LIKE '%@awrady.internal' THEN
        NEW.email := NEW.new_email;
        NEW.new_email := NULL;
        NEW.email_change_token_new := NULL;
        NEW.email_change := NULL;
        NEW.email_confirmed_at := timezone('utc'::text, now());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_synthetic_confirm ON auth.users;
CREATE TRIGGER on_auth_user_synthetic_confirm
    BEFORE INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_synthetic_user_confirm();

-- Auto-provision public profile on Supabase auth.users sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    clean_email TEXT;
BEGIN
    IF NEW.email LIKE '%.awrady@gmail.com' OR NEW.email LIKE '%@awrady.internal' THEN
        clean_email := NULL;
    ELSE
        clean_email := NEW.email;
    END IF;

    INSERT INTO public.users (id, username, email)
    VALUES (
        NEW.id,
        LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)))),
        clean_email
    )
    ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        email = clean_email,
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 6. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_cat_sub ON public.tasks (user_id, category, subcategory);
CREATE INDEX IF NOT EXISTS idx_daily_progress_user_date ON public.daily_progress (user_id, date DESC);

-- ----------------------------------------------------------------------------
-- 7. ROW-LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_progress ENABLE ROW LEVEL SECURITY;

-- Clean legacy and open policies
DROP POLICY IF EXISTS "Allow access on users" ON public.users;
DROP POLICY IF EXISTS "Allow access on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow access on daily progress" ON public.daily_progress;
DROP POLICY IF EXISTS "Users can only access own profile" ON public.users;
DROP POLICY IF EXISTS "Users can only access own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can only access own daily progress" ON public.daily_progress;

-- Strict RLS policies bound to auth.uid()
CREATE POLICY "Users can only access own profile"
    ON public.users
    FOR ALL
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can only access own tasks"
    ON public.tasks
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only access own daily progress"
    ON public.daily_progress
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 8. REALTIME PUBLICATION
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 9. USER SELF-DELETION RPC
-- Allows authenticated users to delete their own account and all cascaded data
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
DECLARE
    curr_uid UUID;
BEGIN
    curr_uid := auth.uid();
    IF curr_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Delete data rows from public schema
    DELETE FROM public.daily_progress WHERE user_id = curr_uid;
    DELETE FROM public.tasks WHERE user_id = curr_uid;
    DELETE FROM public.users WHERE id = curr_uid;

    -- Delete user from Supabase auth.users (requires SECURITY DEFINER)
    DELETE FROM auth.users WHERE id = curr_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- ----------------------------------------------------------------------------
-- 10. USERNAME-ONLY REGISTRATION (Prevents email bounce-backs)
-- Allows users registering with just a username to get a pre-confirmed auth record
-- without invoking GoTrue's transactional email sender.
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.register_username_user(p_username text, p_password text)
RETURNS jsonb AS $$
DECLARE
    clean_user text;
    user_email text;
    new_user_id uuid;
    hashed_pwd text;
BEGIN
    clean_user := lower(trim(p_username));
    IF length(clean_user) < 3 THEN
        RAISE EXCEPTION 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل.';
    END IF;
    IF length(p_password) < 6 THEN
        RAISE EXCEPTION 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
    END IF;

    -- Check for existing username in public or auth
    IF EXISTS (SELECT 1 FROM public.users WHERE lower(username) = clean_user) THEN
        RAISE EXCEPTION 'اسم المستخدم مسجل مسبقاً، يمكنك تسجيل الدخول به.';
    END IF;

    user_email := clean_user || '@awrady.internal';
    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = user_email) THEN
        RAISE EXCEPTION 'اسم المستخدم مسجل مسبقاً، يمكنك تسجيل الدخول به.';
    END IF;

    new_user_id := gen_random_uuid();

    BEGIN
        hashed_pwd := extensions.crypt(p_password, extensions.gen_salt('bf'));
    EXCEPTION WHEN OTHERS THEN
        hashed_pwd := crypt(p_password, gen_salt('bf'));
    END;

    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        user_email,
        hashed_pwd,
        timezone('utc'::text, now()),
        '{"provider":"email","providers":["email"]}'::jsonb,
        json_build_object('username', clean_user),
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        '',
        '',
        '',
        ''
    );

    RETURN json_build_object(
        'id', new_user_id,
        'username', clean_user,
        'email', user_email
    )::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.register_username_user(text, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11. REMOVE USER EMAIL RPC
-- Allows authenticated users to revert to username-only authentication
-- without triggering GoTrue email-change confirmation tokens.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_user_email()
RETURNS void AS $$
DECLARE
    curr_uid UUID;
    curr_username text;
BEGIN
    curr_uid := auth.uid();
    IF curr_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT username INTO curr_username FROM public.users WHERE id = curr_uid;
    IF curr_username IS NULL OR curr_username = '' THEN
        curr_username := 'user';
    END IF;

    UPDATE auth.users
    SET email = curr_username || '@awrady.internal',
        new_email = NULL,
        email_change_token_new = NULL,
        email_change = NULL,
        email_confirmed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = curr_uid;

    UPDATE public.users
    SET email = NULL,
        updated_at = timezone('utc'::text, now())
    WHERE id = curr_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.remove_user_email() TO authenticated;


