# Enjaz (Awrady) Refinement Plan

A streamlined roadmap to transition the Enjaz project from client-side JSON/localStorage state management to a clean SQL-backed architecture with direct UI data rendering.

---

## 1. Project Overview & Core Features
**Enjaz (أورادي)** is a daily habit and productivity tracking dashboard tailored for daily spiritual routines, learning, and work goals.

### Core Features:
- **Daily Routine & Prayer Tracker:** Habit tracking across prayers (fard, nawafel, qiyam), azkar, Quran, fasting, reading, study, and work.
- **Dynamic Task Scheduling:** Support for daily, specific weekly days, Hijri white days, and optional tasks.
- **Focus / Pomodoro Engine:** Integrated timer to track dedicated work and study sessions.
- **Performance Analytics:** Historical trends, completion rates, and daily achievement summaries.
- **Data Safety:** Local and cloud-synchronized state, backups, and security locking.

---

## 2. File Organization
Target structure separating the database layer and frontend client:

```text
Enjaz/
├── database/                 # SQL schemas and seed scripts
│   ├── schema.sql            # Table definitions (users, tasks, daily_progress)
│   └── seed_data.sql         # Legacy migration seed script (Step 7)
├── frontend/                 # Clean UI (exact existing design, direct Supabase API)
│   ├── index.html            # Main dashboard interface
│   ├── css/                  # Styles & layouts
│   ├── js/
│   │   ├── api.js            # Direct Supabase client & realtime sync
│   │   ├── app.js            # Core UI controller & event listeners
│   │   ├── components/       # UI view renderers (daily, analytics, pomodoro)
│   │   └── config/           # Constants (categories, units, defaults)
│   └── assets/               # Icons, fonts, and manifests
├── awrad-ui/                 # Production Git repo clone (untouched during development)
├── awrady_backup_fixed.json  # Legacy backup source data
└── REFINEMENT_PLAN.md        # This master plan
```

---

## 3. Database Architecture (SQL Tables)

Categories and subcategories are maintained as constant definitions in `frontend/js/config/constants.js` with zero database overhead.

### Table 1: `users`
Stores user authentication credentials.
- **Columns:**
  - `username` (VARCHAR, Primary Key)
  - `password_hash` (TEXT)

### Table 2: `tasks`
Stores current task definitions and cached lifetime statistics.
- **Primary Key:** Composite (`username`, `task_id`)
- **Columns:**
  - `username` (VARCHAR, Foreign Key -> `users.username`)
  - `task_id` (VARCHAR)
  - `name` (VARCHAR)
  - `category` (VARCHAR)
  - `subcategory` (VARCHAR)
  - `target` (NUMERIC)
  - `schedule` (VARCHAR) — e.g. "Everyday", "Mon, Thu", "WhiteDays", "OneTime"
  - `is_archived` (BOOLEAN DEFAULT FALSE)
  - `total_achieved` (NUMERIC DEFAULT 0) — lifetime units completed
  - `total_hours` (NUMERIC DEFAULT 0) — lifetime hours completed
  - `total_score` (NUMERIC DEFAULT 0) — lifetime score points earned
  - `created_at` (TIMESTAMPTZ)

### Table 3: `daily_progress`
Immutable historical log of daily requirements and accomplishments.
- **Primary Key:** Composite (`username`, `date`)
- **Columns:**
  - `username` (VARCHAR, Foreign Key -> `users.username`)
  - `date` (DATE) — formatted as YYYY-MM-DD
  - `task_progress` (JSONB) — `{ [task_id]: { "target": NUMERIC, "achieved": NUMERIC, "hours": NUMERIC, "score": NUMERIC } }`
    - If disabled or bonus: `target = 0`
  - `total_score` (NUMERIC DEFAULT 0) — day score ratio
  - `total_hours` (NUMERIC DEFAULT 0) — total day hours
  - `prayer_extras` (JSONB) — `{ [task_id]: { "nawafel": NUMERIC, "azkar": BOOLEAN } }`

---

## 4. Supabase Client & Database Service (`frontend/js/api.js`)
- Adopt **Direct Supabase (Client + DB)** architecture (zero standalone server, serverless & free-tier friendly).
- Implement modular `frontend/js/api.js` wrapping the official Supabase JS client:
  - **Auth Service:** User authentication and session state mapped to `public.users` & Supabase Auth.
  - **Tasks Service:** Query, create, update, and archive tasks in `public.tasks`.
  - **Daily Progress Service:** 
    - **Read:** Direct fetch of precalculated day row (`task_progress`, `prayer_extras`, `total_score`, `total_hours`) for instant UI rendering.
    - **Write / Calculation on Save:** On task completion, compute task scores, total day score, and total hours, then upsert the precalculated snapshot into `public.daily_progress`.
  - **Analytics Service:** Fast date-range query (`SELECT date, total_score, total_hours FROM daily_progress WHERE date BETWEEN ...`).
  - **Realtime Sync:** Native PostgreSQL Change listener (`supabase.channel('daily_progress')`) for instantaneous multi-device updates.

---

## 5. UI Shape Preservation & View Integration
- Keep 100% of the existing UI layout, CSS design, modal behaviors, and visual themes intact.
- Replace legacy `localStorage` adapters and in-memory JSON state pipelines with `api.js` calls.
- Integrate views:
  - Daily View: Fetches day's `daily_progress` record $\rightarrow$ renders directly.
  - Task Manager: Manages task records via `api.tasks`.
  - Analytics View: Queries range aggregates via `api.analytics`.

---

## 6. System Integration & End-to-End Verification
- Validate the new database schema and RLS policies on Supabase with test data:
  - Test user session $\rightarrow$ Create test tasks $\rightarrow$ Save day progress $\rightarrow$ Verify Realtime sync on another tab/device.
- Ensure all API methods and database interactions are 100% stable.

---

## 7. Legacy Data Migration & Seeding (Option A - Final Step)
- Once the direct Supabase system is verified end-to-end:
- Generate `database/seed_data.sql` from `awrady_backup_fixed.json` (Option A).
- Map legacy `category_id` references (e.g. `cat_1`, `cat_2`) to canonical category names (e.g. `صلاة`, `قرآن`) when migrating tasks and logs.
- Flatten legacy "مذاكرة" tasks: strip old subcategories (`تعلم`, `حل وتمارين`, `بروجكتات`) and set `subcategory` to `NULL` since "مذاكرة" is now a direct category without subcategories.
- Populate `users` with default credentials.
- Extract all default and custom tasks into `tasks` with computed lifetime totals.
- Extract `logs` records into `daily_progress`, converting each day's entries into the `{ target, achieved, hours, score }` structure.
- Execute `database/seed_data.sql` against Supabase to hydrate the verified system with full historical records.

---

## 8. Release & Deployment Strategy (Option 2: Safe In-Place Transition)
- **Local Isolation:** Execute all database migrations, backend builds, and frontend tests in the `Enjaz/` workspace locally. The live production repository (`awrad-ui`) remains completely untouched during development.
- **Branch Preparation:** When the implementation and tests pass locally, create a new branch (e.g. `refactor-v2`) inside the `awrad-ui` repository.
- **Staging & Verification:** Transfer the refined code into `awrad-ui`, run staging checks, and verify end-to-end stability.
- **Production Merge:** Merge `refactor-v2` into `main` to trigger the production deployment on Vercel without risk or downtime.
