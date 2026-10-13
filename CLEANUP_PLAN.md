# Enjaz Cleanup Plan

Make the code as small and direct as possible without changing what the user sees:
remove dead code, remove defensive checks and fallbacks that can never trigger, put every
key / ID / limit in `js/config/constants.js`, and split the oversized files.

Findings come from reading every JS file, grep cross-checks, and the graphify graph
(`graphify-out/graph.html`, refreshed 2026-10-13: 250 nodes, 500 edges). Graphify cannot
see calls made through `window.*` and `typeof` guards, so nothing below is called "dead"
on the graph's word alone — each item was confirmed with grep.

## Ground rules

- One step = one commit. The UI must look and behave the same after every step, except for
  the features the decided **Data model** removes (per-weekday targets, task comment, the
  "always bonus" checkbox).
- There is no test suite, so run the **smoke checklist** after every step:
  1. Log in as guest. 2. Mark a fard prayer "جماعة" (nawafel prompt appears once). 3. `+`/`-` on a
  counter task. 4. Type hours/minutes on a time task. 5. Complete a whole task (it moves to
  "مكتملة"). 6. Disable/re-enable a task for today. 7. Quick-add an unscheduled task as bonus.
  8. Edit a task's target, check the card updates. 9. Archive, restore, delete a task.
  10. Open analytics, switch 7/30/all. 11. Run and finish a pomodoro on a time task.
  12. Reload — everything from 2–11 is still there. 13. Go offline, log progress, reload — the
  progress is still there and the sync pill shows pending changes. Go back online — the
  changes reach Supabase and the pill shows synced.
- Bump `CACHE_NAME` in `sw.js` and the `?v=` query strings in `index.html` in any commit
  that adds, removes, or renames a file.

---

## Step 0 — Fix the live bugs found during the audit

These are bugs in today's code. Fix the ones marked for Step 0 first so the cleanup doesn't
get blamed for them; the rest are fixed by the step named in the "Fix" column.

| # | Bug | Where | Fix |
|---|-----|-------|-----|
| B1 | `isTime` is used before its `const` declaration → `ReferenceError` the moment any task is completed; the daily grid stops rendering. Introduced in `7b1e16a`. | `js/app.js:901` (declared at `:907`) | Step 0: move the declaration above its use. |
| B2 | Day-score cache is never invalidated: invalidation is wired to `window.stateManager` / `window.storageEngine`, both deleted in `e473b47`. Score ring and header % stay stale until reload. | `js/core/scoring-engine.js:7-24, 223-238` | Delete the cache (Step 2) — data is ~25 tasks × N days. |
| B3 | Editing a task never clears `ScheduleEngine`'s per-task cache, so a new target/schedule isn't used until reload (archive/delete do clear it). | `js/components/task-manager.js:654-814` | Removed together with the cache in Step 2. |
| B4 | Realtime listener doesn't filter by user. With RLS `USING (true)`, another user's row for today overwrites your daily view. | `js/app.js:170-195`, `js/api.js:32-39` | Step 0: subscribe with `filter: "username=eq.<user>"` and drop old channels on re-init. |
| B5 | Task fields that aren't DB columns are lost on reload: `history`, `dayTargets`, `isBonus`, `comment`, `isOneTime`, `oneTimeDate`, `archivedAt`, `type`, `multiplier`. Per-day `disabledTaskIds` / `bonusTaskIds` aren't saved either. Example: `task_study_practice` (unit تكرار) turns into a time task after reload because `type` is dropped. | `js/api.js:50-89, 112-125` | Decided: keep schema fields only — see **Data model** below (done in Step 2). |
| B6 | "Reset progress" and "Import JSON" only change the in-memory/local copy; the next load re-hydrates from Supabase, so neither works. | `js/components/data-manager.js:109-165` | Write through `enjazAPI` (delete rows / upsert imported rows). |
| B7 | The nawafel prompt is triggered twice per prayer tap (once inside `setTaskVal`, once by the caller). Same double-trigger in `adjustTaskVal`. | `js/app.js:1054-1059`, `1228-1237`, `1345-1355` | Step 0: only `setTaskVal` triggers prompts. |
| B8 | "Is this a time task?" has 8 different implementations that disagree — scoring treats every مذاكرة/شغل/استماع task as hours, the daily view doesn't, pomodoro does substring matching. The same task is scored on a different scale than it's displayed. | `app.js:542`, `scoring-engine.js:50,152`, `analytics-view.js:572,591`, `pomodoro.js:204-223`, `task-manager.js:491,903` | One `isTimeTask()` (Step 3). |
| B9 | Service worker precaches the unused `./style.css` and misses `js/components/auth-manager.js`. | `sw.js:8-32` | Fixed by Step 1 / Step 5 list updates. |
| B10 | Any realtime `tasks` event (including the echo of your own save) replaces the whole task list with `getTasks()`, which excludes archived tasks and has no default tasks. Archiving a task makes it vanish so it can't be restored; creating one task hides all defaults. Today's realtime echo also wiped the paused/bonus lists. | `js/app.js:170-195` | Step 0: merge only the changed row. |
| B11 | `saveTaskFromModal` closes the modal (clearing `editingTaskId`) before choosing which task to push, so an edit pushes the **last** task in the list, unchanged. Task edits never reached Supabase. | `js/components/task-manager.js:803-808` | Step 0: pick the task before closing. |
| B12 | Default tasks are never saved to Supabase, and `initData` saves on every load. After a reload the task list is only what's in the DB, then the save-on-load rewrites today's row from that partial list, deleting the progress of every task not in the DB. | `js/app.js:236-241` | Step 2: seed defaults once; never save on load. |

## Decisions

| # | Question | Status |
|---|----------|--------|
| D1 | What happens when Supabase is unreachable? | **Decided: work from a local cache and merge when connected.** See "Offline cache and sync" below. |
| D2 | Persist the non-schema fields, or drop them? | **Decided: keep only fields that exist in `database/schema.sql`.** See "Data model" below. |
| D3 | Keep the local user DB (`AWRAD_USERS_DB`) alongside the cloud `users` table? | Open. Recommendation: **drop it**, keep the guest login — one auth path instead of two. |
| D4 | Keep the legacy PIN-salt migration (`enjaz_secure_salt_v1`)? | Open. Recommendation: drop once no device still has an old PIN. |
| D5 | Move from classic `<script>` globals to ES modules? | Open. Recommendation: **yes, at the end of Step 5.** Every dead duplicate in Step 1 exists because a later global silently overrides an earlier one. With imports that can't happen, the 15 `window.X = X` export blocks go away, and graphify can see cross-file calls. |
| D6 | `tasks.total_achieved / total_hours / total_score` are schema columns that nothing ever writes. Drop the columns too? | Open. The app stops reading them either way. Dropping them is a live-DB change, so it's your call. |

## Data model (decided: schema fields only)

The app keeps only what the schema stores — in Supabase and in the local cache alike.

**Task** — one row of `tasks`:

| App field | Column | Notes |
|-----------|--------|-------|
| `id` | `task_id` | |
| `name` | `name` | |
| `category` | `category` | Must be a name from `APP_CONSTANTS.CATEGORIES`. |
| `subcategory` | `subcategory` | |
| `target` | `target` | |
| `schedule` | `schedule` | `Everyday`, `"Mon, Thu"`, `WhiteDays`, `Ramadan`, `Optional`, `OneTime`. |
| `isArchived` | `is_archived` | |
| `createdAt` | `created_at` | Start date of the task; for `OneTime` tasks it **is** the task's date. |

**Day** — one row of `daily_progress`:

| App field | Column |
|-----------|--------|
| `entries[taskId]` | `task_progress[taskId].achieved` |
| per-task target that day | `task_progress[taskId].target` |
| `prayerExtras` | `prayer_extras` |
| day score / hours | `total_score` / `total_hours` |

**Removed fields and what replaces them**

| Removed | Replacement / consequence |
|---------|---------------------------|
| `type` (unit) | Derived from subcategory → category `defaultUnit` in `constants.js` (the task modal already derives it this way). **Consequence:** "حل مسائل وتمارين" (`task_study_practice`, category مذاكرة, was تكرار) becomes an hours task. Tasks loaded from the DB already behave like this today. To keep it as a counter, move it to a category whose unit is تكرار. |
| `history` | Removed. Past days already keep their own target in `task_progress`, and analytics reads the stored `total_score` / `total_hours` instead of recomputing old days. Only the day being edited is computed. |
| `multiplier` | Removed (no UI, always 1). |
| `dayTargets` | **Feature removed:** per-weekday targets — `index.html:610-620`, `renderDayTargetsInputs`, and its listeners. |
| `isBonus` (task flag) | **Feature removed:** the "always bonus" checkbox (`index.html:591-598`). A task counts as bonus on a day it's logged but not scheduled. |
| `comment` | **Feature removed:** the input (`index.html:560-563`) and the text under the card title (`app.js:795`). |
| `isOneTime`, `oneTimeDate`, `oneTimeDates` | `schedule === "OneTime"` plus `created_at`. The modal's date picker writes `created_at` at noon UTC, so `.slice(0, 10)` gives the same date in every time zone. |
| `archivedAt` | Removed. An archived task only appears on days where it has logged progress (already the behavior after a reload). |
| `disabledTaskIds` (pause for today) | Kept as a feature, stored inside the existing `task_progress` column: a paused task is an entry with `target: 0`. |
| `bonusTaskIds` (quick-add for today) | Kept as a feature, also inside `task_progress`: an unscheduled task with an entry for the day is that day's bonus. This means `saveData` must write only the day's visible tasks; today it writes every task. |
| `precomputedScore`, `totalHours`, `legacyTotalScore`, `_loadedFromDB`, `deletedTaskIds` | Use the column names (`total_score`, `total_hours`) or delete. |
| `icon`, `allowNotes` in `DEFAULT_TASKS` | Removed. |

With `history` and `dayTargets` gone, `ScheduleEngine.getTaskEffectiveProps` (and its cache) has nothing left to resolve. Delete it and read the task's fields directly — `schedule-engine.js` drops from 279 to roughly 80 lines.

## Offline cache and sync (decided)

Supabase is the source of truth. The browser keeps a cache so the app keeps working when
Supabase is unreachable, and pushes the changes once it's back.

- **One cache, schema-shaped.** One localStorage entry per user:
  `{ tasks: { [task_id]: row }, days: { [date]: row }, pending: { tasks: { [task_id]: editedAt }, days: { [date]: editedAt }, deletedTasks: [task_id] } }`.
  Rows use the column names from `schema.sql`, so the cache, the API and the views share one
  data shape. This replaces today's `AWRAD_APP_DATA_V1*` blob, which re-serializes all of
  `appData` on every tap and is only ever read when Supabase fails.
- **Load:** render from the cache right away, then fetch from Supabase. If the fetch fails,
  keep running on the cache and show "offline" in the sync pill.
- **Write:** every change updates the cache, marks the row pending with the local edit time,
  and tries to push. A successful push clears the mark; a failed push leaves it.
- **Merge when connected** (on startup, on the browser `online` event, and after the next
  successful request): for each pending row, last write wins per row. If the server row's
  `updated_at` is newer than the local edit time, another device changed it later, so keep
  the server's row; otherwise push the local row. Pending task deletes are sent as deletes.
  Rows that aren't pending are replaced by the server's version.
- **Realtime** events update the cache the same way, filtered to the logged-in user (B4).
- **Sync pill:** synced / syncing / offline, plus the number of pending changes.
- **First login** with no tasks in either the cache or Supabase: upsert `DEFAULT_TASKS` once.
  Today the defaults only live in memory and are never saved, so progress rows point at
  task IDs that aren't in `tasks`.
- **"Reset to defaults", "Reset progress" and "Import JSON"** go through the same write path,
  so they reach Supabase (fixes B6).
- **Code:** one module, `js/core/store.js` (cache + pending queue + sync), between `api.js`
  and the views. It replaces `initData`'s three loaders and four row-mapping copies,
  `saveData`'s dual write, `getUserStorageKey`, and the `STORAGE_KEY` legacy copy.
- localStorage also keeps the session user, the PIN, and the pomodoro state. The service
  worker keeps caching the app shell (HTML/CSS/JS).

---

## Step 1 — Delete dead files and dead code (no behavior change)

**Whole files**

| Delete | Evidence |
|--------|----------|
| `style.css` (root, 2150 lines) | Not linked anywhere; `index.html` loads `css/style.css`. Only listed in `sw.js`. |
| `assets/app-icon.ico` | Byte-identical to `app-icon.ico`; never referenced. |
| `js/utils/debounce.js` | `debounce` / `throttle` are never called. |
| `js/components/daily-view.js` | All 11 functions are re-declared in files loaded later (`app.js`, `task-manager.js`), and the last global declaration wins. Graphify lists all 11 as duplicate definitions; this copy never runs. |

**Dead UI**

- Bonus-task modal: nothing calls `openBonusTaskModal`. Remove `index.html:696-713`,
  `task-manager.js:816-883`, the close-button wiring at `app.js:532-540`, and the
  `options.isBonus` branch in `openTaskModal` (`task-manager.js:614-618`). Keep
  `addBonusTaskToDate` — quick-add uses it.
- Old nested-category navigation: `#daily-breadcrumb`, `#btn-daily-back`,
  `#daily-current-level-title`, `#daily-nav-grid`, `#empty-tasks-message`
  (`index.html:194-212`), the code that hides them (`app.js:586-588`), and the unused
  variables `currentTab`, `currentViewCategory`, `currentViewSubcategory`,
  `nawafelPromptTimeout` (`app.js:25-34`).
- Analytics "removed" status: `deletedAt` is never set, so this filter is always empty
  (the button is already `display:none`). Remove `index.html:283-285` and the `removed`
  branches in `analytics-view.js`.
- Two export buttons with two implementations (`#btn-download-cloud-backup`,
  `#btn-export-json`) → keep one button, one function.
- `<audio id="pomodoro-alarm">` loads a remote mp3 *and* a Web Audio chime is synthesized
  → keep the chime, drop the remote file (one less external dependency).

**Dead functions** (confirmed with grep: defined, never called)

`app.js`: `removeBonusTaskFromDate`, `removeOneTimeTask`, `triggerNawafelPrompt` calls
(the function doesn't exist) · `task-manager.js`: `isTimeBasedType`, `syncUnitEstMinsState` ·
`data-manager.js`: `updateStorageUIStatus`, the one-off removal of
`AWRAD_SUPABASE_URL/KEY`, `AWRAD_ACTIVE_USER` · `pomodoro.js`: `clearPomoState` ·
`date-utils.js`: `clearHijriDateCache` · `scoring-engine.js`: `clearScoreCache`,
`ScoringEngine.updateHeaderTodayScore`, the `stateManager`/`storageEngine` wrappers ·
`schedule-engine.js`: `isPrayerSelector`, `isObligatoryPrayerTask`, `clearAllCaches` ·
`category-manager.js`: `setupCategoryManager` (empty) · `api.js`: `deleteTask`.

**Fields read but never written** — delete the branches that read them:
`parentTaskId`, `pairedTaskId`, `legacyTotalScore`, `deletedAt`, `oneTimeDates`,
`deactivatedTaskIds`, `INITIAL_APP_DATA`; `deletedTaskIds` (written, never read);
`icon` and `allowNotes` in `default-data.js`; the non-existent category `خروج`; legacy
names `الصلاة`, `فرائض`, `صيام`, `البيض`; legacy task ID `task_3`; `generic_prayer`.

## Step 2 — Remove checks and fallbacks that can't trigger

Every script is loaded in a fixed order by `index.html`, so every module always exists.
There are **260** `typeof X === "function" / !== "undefined"` guards (85 in `app.js`).

1. Delete guards around app modules and globals (`ScheduleEngine`, `ScoringEngine`,
   `APP_CONSTANTS`, `currentDateStr`, `renderDailyView`, `getLocalTodayString`, …).
2. Delete the duplicate fallback bodies in `app.js`: `getTaskEffectiveProps`,
   `isBonusTaskForDate`, `isTaskScheduledForDate` (`app.js:304-408`, ~100 lines), and the
   `calculateDayScore` / `getTaskWeightMinutes` wrappers with their `|| 15` / `|| 0` defaults
   (`app.js:1361-1382`). Call `ScheduleEngine` / `ScoringEngine` directly.
3. Delete self-override checks (`window.X !== X`) at `app.js:305`, `app.js:577`.
4. Delete the `new Date().toISOString().split("T")[0]` fallbacks (11×). They are also wrong —
   they return the UTC date, not the local date.
5. Delete the non-crypto hash fallbacks in `auth-manager.js:14-28` and
   `security-lock.js:28-45`. The app is only served over https/localhost, where
   `crypto.subtle` always exists.
6. Delete the alias layer in `date-utils.js` (`getHijriDetails`, `formatDateArabic`,
   `getDayOfWeekStr`, `formatDateStr`) and the duplicate result fields (`dateStringAr` /
   `formatted` / `hijriFormatted`, `day` / `hDay`). One name each; update call sites.
7. Delete the argument-shape guessing in `ScheduleEngine.isTaskScheduledForDate`
   (`schedule-engine.js:175-183`); give it one signature.
8. `api.js`: initialize once at startup and fail loudly, instead of
   `if (!this.client) return` in every method. Map each column to one name (not
   `id` + `task_id`, `isArchived` + `is_archived`).
9. `pomodoro.js` `getActiveAppData()` falls back to `DEFAULT_AWRAD_DATA` — minutes would be
   logged into throwaway default data. Use `appData` directly.
10. `nawafel-toast.js`: find the sunnah / azkar / quran tasks by constant ID, not by
    name-substring search, and stop recreating default tasks inline (they duplicate
    `default-data.js`).
11. `weekly-modal.js`: remove the `day.mockDate`, `day.name`, `day.key` fallbacks (those
    fields don't exist).
12. One startup path: `DOMContentLoaded` (`app.js:44-68`) and `window.startApp`
    (`app.js:70-91`) duplicate each other → one `startApp(user)`. Pomodoro sets itself up
    and then gets set up again by `app.js` → set up once.
13. One data load: `initData` fetches today's row **and** every row (which already
    includes today), and the analytics tab re-fetches every row on every open
    (`app.js:441-469`). Load once; realtime keeps the data fresh. Replace the hard-coded
    `"2020-01-01"`–`"2099-12-31"` range with a `getAllProgress()` query that has no date
    filter.
14. Delete the score cache and the effective-props cache (fixes B2/B3). Re-add a cache only
    if a measured slowdown shows up.
15. Apply **Data model** and **Offline cache and sync** (above): trim `DEFAULT_TASKS`, `api.js`
    mapping, `saveTaskFromModal`, the task modal, `ScheduleEngine`, and `ScoringEngine` to
    the schema fields; delete the removed features' UI. Apply D3 / D4 once decided.

## Step 3 — One implementation per rule

| Rule | Copies today | Becomes |
|------|-------------|---------|
| Is time task / unit of a task | 8 (see B8) | `getTaskUnit(task)`, `isTimeTask(task)` in `js/core/task-rules.js` |
| Category lookup | `appData.categories` is always a copy of `APP_CONSTANTS.CATEGORIES` | Read the constant; remove `categories` from `appData` |
| "Should this task show today?" (archived/bonus filter) | `app.js:667-676` and `app.js:1403-1413` | `ScheduleEngine.isVisibleOn(task, date)` |
| Group tasks by category → subcategory | `task-manager.js:166-271`, `analytics-view.js:447-505` | `groupTasksByCategory(tasks)` |
| Prayer / time / counter controls HTML | pending card `app.js:805-852` vs completed pill `app.js:909-947` | `renderTaskControls(task, val, { compact })` |
| DB row → log entry | 4× in `app.js` (`136-150`, `154-166`, `174-184`, `494-503`) | `rowToLog(row)` in `js/core/state.js` |
| Weekday names | 5 tables (`date-utils.js` ×3, `task-manager.js` ×2) | `APP_CONSTANTS.WEEKDAYS` |
| Prayer-value buttons (1 / 0.5 / 0) | 2 HTML copies + in-place updater | Driven by `APP_CONSTANTS.PRAYER_VALUES` |

## Step 4 — Move hard-coded values into `constants.js`

Rule: **keys, IDs, enums, limits, thresholds, URLs, table names → `constants.js`.**
Colors → CSS variables (they already exist in `css/style.css:8-32`). Arabic UI copy stays
next to the markup that renders it.

Already in `constants.js` but **never used**, so the literal is repeated elsewhere instead:
`SCHEDULE_TYPES`, `POMODORO_DEFAULTS`, `AUDIO.ALARM_URL`, `SUPABASE.DEFAULT_USER_ID`.
Wire them in.

Add:

```js
STORAGE_KEYS: { SESSION_USER: "AWRAD_AUTH_USER", PIN_HASH: "AWRAD_PIN_HASH",
                PIN_SESSION: "AWRAD_AUTH_SESSION", POMODORO: "AWRAD_POMO_STATE" },
HASH_SALTS:   { PASSWORD: "awrady_salt_v1", PIN: "awrady_secure_salt_v1" }, // not secrets; never change them
DB: { TABLES: { USERS: "users", TASKS: "tasks", PROGRESS: "daily_progress" }, CHANNEL: "enjaz_live_sync" },
GUEST_USER: "primary_user",                        // repeated in api.js, app.js, auth-manager.js
TIME_UNITS: ["ساعة", "ساعات", "ساعات ودقايق", "وقت", "دقيقة"], // ~50 literals across 7 files today
PRAYER_VALUES: { CONGREGATION: 1, ALONE: 0.5, MISSED: 0 },
TASK_IDS: { FARD: ["task_fajr", "task_dhuhr", "task_asr", "task_maghrib", "task_isha"],
            SUNNAH: "task_sunnah", PRAYER_AZKAR: "task_azkar_prayer", QURAN_WIRD: "task_quran_read" },
WEEKDAYS: [{ key: "Sat", ar: "السبت" }, /* … */],
HIJRI_MONTHS: ["محرم", /* … */],
WHITE_DAYS: [13, 14, 15], RAMADAN_MONTH: 9,
LIMITS: { USERNAME_MIN: 3, PASSWORD_MIN: 4, PIN_MIN: 4, PIN_MAX: 6,
          POMO_WORK_MAX: 180, POMO_REST_MAX: 60, TIME_STEP_MIN: 15, NAWAFEL_STEP: 2 },
UI: { SAVE_DEBOUNCE_MS: 350, SCORE_RING_CIRCUMFERENCE: 314,
      SCORE_THRESHOLDS: { GOLD: 100, GREEN: 70, BLUE: 40 },
      CHART_MAX_POINTS: 30, CHART_MAX_POINTS_MOBILE: 15, MOBILE_BREAKPOINT: 500 },
```

Also:
- Replace the **164** inline `style="…"` attributes in `index.html` and the ~150 hex/`rgba()`
  literals in JS template strings with CSS classes that use the existing `:root` variables.
- Remove the inline `onclick=` handlers (`index.html:112,115`, `weekly-modal.js`) — bind in JS.
- Pin `@supabase/supabase-js@2` to an exact version (`index.html:19`).
- The Supabase URL and publishable key stay in `constants.js`. This key is public by
  design; protection has to come from RLS (see Security below).

## Step 5 — Split the big files

Sizes after Steps 1–4 are estimates.

| Today | Split into |
|-------|-----------|
| `js/app.js` (1491) | `js/app.js` — bootstrap/start/logout (~80) · `js/core/state.js` — current date, `get/set/adjustTaskVal` (~80) · `js/core/store.js` — cache, pending queue, sync with Supabase (~150) · `js/core/task-rules.js` — unit, target, completed, prayer/qiyam checks (~80) · `js/components/daily-view.js` — grid render, listeners, in-place updates (~400) · `js/components/day-summary.js` — score ring, badges, remaining time (~100) · `js/components/fasting-banner.js` — tomorrow-fasting reminder (~60) |
| `js/components/task-manager.js` (1095) | `task-manager.js` — lists, archive, delete (~300) · `task-modal.js` — edit/create form (~280) · `quick-add-modal.js` (~160) |
| `js/components/pomodoro.js` (1027) | `pomodoro.js` — timer state, controls, persistence (~400) · `pomodoro-alerts.js` — keep-alive audio, chime, notification, title blink (~220) |
| `js/components/analytics-view.js` (697) | `analytics-chart.js` — chart + LTTB downsampling (~220) · `analytics-breakdown.js` — per-task consistency (~200) |
| `css/style.css` (2254) | `css/base.css`, `css/layout.css`, `css/daily.css`, `css/modals.css`, `css/auth-lock.css` (optional; split by section, no rule changes) |

`index.html` stays one file (there is no build step). Update the script list in
`index.html` and `PRECACHE_ASSETS` in `sw.js` in the same commit. Then apply **D5**
(ES modules): one `<script type="module" src="js/app.js">`, explicit `import`/`export`,
and delete the `window.X = X` blocks.

## Step 6 — Verify

1. Run the full smoke checklist on desktop and on a phone-width window.
2. `graphify update . --force`. Expect **0** duplicate definitions, and every function in
   `js/` reachable from `app.js` (ES modules make the graph's call edges complete).
3. Line count: Step 1 alone removes ~2,400 lines (`style.css` 2150, `daily-view.js` 227,
   `debounce.js` 44). Record the before/after counts in the PR description.

---

## Security (out of scope, needs its own task)

`database/schema.sql:137-139` gives every table `USING (true) WITH CHECK (true)`. With the
publishable key, anyone can read every user's tasks, progress, and `users.password_hash`,
and can write any user's rows. Passwords are hashed in the browser with a fixed, shared
salt. The real fix is Supabase Auth plus RLS on `auth.uid()`. That changes the auth flow
and schema, so it is not part of this cleanup.

---

## Status (2026-10-13)

| Step | State |
|------|-------|
| 0 (live bugs) | Done |
| 1 (dead files/code) | Done — `d204bb9` |
| 2 (guards/fallbacks) | Done — `1354be0`, `ac7d857` |
| 3 (one implementation per rule) | Done — `d96159c` |
| 4 (constants) | Done for keys, salts, tables, limits, thresholds. Inline styles deferred (below). |
| 5 (split files) | Done for JS: `daily-view`, `day-summary`, `task-modal`, `quick-add-modal`, `analytics-breakdown`, `pomodoro-alerts`. ES modules and CSS split deferred (below). |
| 6 (verify) | Graphify rebuilt: 245 nodes, no duplicate definitions. Browser smoke test: app boots, all tabs switch, modals open, no console errors on the current script versions. JS is 5,908 lines; `css/style.css` 1,922. |

## Deferred (optional, do later)

1. **ES modules (D5)** — one `<script type="module">`, explicit imports/exports, delete `window.X = X` blocks. Large, touches every file; needs a test pass afterwards.
2. **Split `css/style.css`** into `base/layout/daily/modals/auth-lock.css`. No rule changes; update `index.html` and `sw.js`.
3. **Inline styles** — ~140 `style="…"` attributes in `index.html` and hex/`rgba()` colors in JS template strings → CSS classes using the `:root` variables.
4. **Data model / offline cache (`store.js`, `state.js`)** — the planned cache + pending queue module was not built.
5. **Security** — Supabase RLS / auth (see Security section); separate task.
