# Awrady Project Backlog & Feature Roadmap

A prioritized inventory of 31 planned features, UX enhancements, scoring fixes, and architectural refinements for **Awrady**, sorted by implementation priority and difficulty.

---

## 📊 Master Prioritization Matrix

> **Priority Tiers:**
> - **P1 (High)**: Data integrity, sync safety, calculation correctness, and core worship mechanics.
> - **P2 (Medium)**: Daily dashboard workflow, user personalization, navigation, and analytics.
> - **P3 (Low)**: Advanced focus timers and heavy administrative consolidation.

| Rank | Issue # | Issue Title | Priority | Difficulty | Primary Files |
| :---: | :---: | :--- | :---: | :---: | :--- |
| **1** | **#15** | Show prayer as completed in UI when prayed alone while retaining 50% score | **P1 (High)** | **Low (1.5/5)** | `js/core/task-rules.js`, `js/components/daily-view.js` |
| **2** | **#2** | Restrict time-based conflict resolution strictly to dirty fields | **P1 (High)** | **Medium (3.5/5)** | `js/app.js`, `js/api.js` |
| **3** | **#5** | Freeze historical days' score/values from DB without dynamic recalculation | **P1 (High)** | **Medium (2.5/5)** | `js/core/scoring-engine.js`, `js/app.js` |
| **4** | **#13** | Prevent retroactive bonus reclassification on past days when task settings change | **P1 (High)** | **Medium (3.0/5)** | `js/core/schedule-engine.js`, `js/core/scoring-engine.js` |
| **5** | **#12** | Fix bonus entries acting as required targets that decrease task/day progress | **P1 (High)** | **Low (2.0/5)** | `js/components/analytics-breakdown.js`, `js/core/scoring-engine.js` |
| **6** | **#11** | Exclude stopped/deactivated tasks from scheduled days count in stats | **P1 (High)** | **Low (1.5/5)** | `js/components/analytics-breakdown.js` |
| **7** | **#31** | Consolidate overlapping fasting tasks into a single task (Ramadan > White Days > Mon/Thu) | **P1 (High)** | **Low (2.0/5)** | `js/core/schedule-engine.js`, `js/components/daily-view.js` |
| **8** | **#26** | Split midnight-spanning Pomodoro time accurately across both consecutive days | **P1 (High)** | **Medium (2.5/5)** | `js/components/pomodoro.js`, `js/app.js` |
| **9** | **#27** | Open interactive calendar datepicker upon clicking header date on home page | **P2 (Med)** | **Low (1.5/5)** | `js/components/daily-view.js`, `index.html` |
| **10** | **#28** | Clicking a day point on the chart navigates to home page to inspect that day | **P2 (Med)** | **Low (1.5/5)** | `js/components/analytics-view.js` |
| **11** | **#22** | Show explicit percentage progress and total time on task cards | **P2 (Med)** | **Low (1.5/5)** | `js/components/daily-view.js`, `css/style.css` |
| **12** | **#4** | Daily view counters: time (done & rem.) + tasks (done, running, rem.) | **P2 (Med)** | **Low (2.0/5)** | `js/components/day-summary.js`, `index.html` |
| **13** | **#25** | Change Pomodoro modal "✕" close button to "إخفاء" (Hide) | **P2 (Med)** | **Very Low (1.0/5)** | `js/components/pomodoro.js`, `index.html` |
| **14** | **#29** | Add self-encouragement motivational note widget on the home page | **P2 (Med)** | **Low (1.5/5)** | `js/components/daily-view.js`, `index.html` |
| **15** | **#14** | Remove redundant Save/Cancel buttons from Sunan & Azkar prayer toast | **P2 (Med)** | **Very Low (1.0/5)** | `js/components/nawafel-toast.js`, `index.html` |
| **16** | **#24** | Remove Chart.js zoom plugin and all related gesture/zoom logic | **P2 (Med)** | **Very Low (1.0/5)** | `js/components/analytics-view.js`, `index.html` |
| **17** | **#19** | Remove the PIN GateKeeper screen, hashing logic, and modals | **P2 (Med)** | **Low (1.5/5)** | `js/components/security-lock.js`, `index.html` |
| **18** | **#17** | Add gender and religion selection fields to account registration | **P2 (Med)** | **Low (2.0/5)** | `js/components/auth-manager.js`, `database/schema.sql` |
| **19** | **#18** | Personalize tasks by demographic (omit Islamic tasks for non-Muslims; binary prayer toggle for females) | **P2 (Med)** | **Medium (2.5/5)** | `js/core/task-rules.js`, `js/app.js` |
| **20** | **#20** | Allow users to edit their profile metadata (gender, religion) and change password | **P2 (Med)** | **Low (2.0/5)** | `js/components/auth-manager.js`, `js/components/data-manager.js` |
| **21** | **#21** | Add metric selector to statistics chart (toggle between Hours and Percentage) | **P2 (Med)** | **Low (2.0/5)** | `js/components/analytics-view.js`, `index.html` |
| **22** | **#30** | Add circular doughnut chart in statistics showing share of top 4 tasks + "others" | **P2 (Med)** | **Low (2.0/5)** | `js/components/analytics-view.js`, `index.html` |
| **23** | **#10** | Unify statistics page filters to centrally control all dashboard data | **P2 (Med)** | **Medium (3.0/5)** | `js/components/analytics-view.js`, `js/components/analytics-breakdown.js` |
| **24** | **#9** | Allow excluding specific categories from chart & statistics calculations | **P2 (Med)** | **Medium (3.0/5)** | `js/components/analytics-view.js`, `index.html` |
| **25** | **#1** | Add highest and lowest progress cards to the statistics page | **P2 (Med)** | **Low (2.0/5)** | `js/components/analytics-view.js`, `index.html` |
| **26** | **#16** | Remove Guest Mode and enforce authenticated user sessions | **P2 (Med)** | **Low (2.0/5)** | `js/components/auth-manager.js`, `js/app.js` |
| **27** | **#8** | Add "أعمال منزلية" (Housework) and "أخرى" (Others) to categories | **P2 (Med)** | **Very Low (1.0/5)** | `js/config/constants.js` |
| **28** | **#23** | Persist user default timer settings to `public.users` table | **P3 (Low)** | **Low (1.5/5)** | `database/schema.sql`, `js/components/pomodoro.js` |
| **29** | **#7** | Configure Pomodoro duration using both hours and minutes | **P3 (Low)** | **Low (1.5/5)** | `js/components/pomodoro.js`, `index.html` |
| **30** | **#6** | Cross-device Pomodoro sync + remove 180-minute ceiling | **P3 (Low)** | **High (4.0/5)** | `js/components/pomodoro.js`, `js/api.js` |
| **31** | **#3** | Task merge button to consolidate multiple tasks into one | **P3 (Low)** | **High (4.5/5)** | `js/components/task-manager.js`, `js/app.js` |

---

## 🎯 Difficulty Progression

1. **Very Low (1.0/5)**:
   - **#8**: Append 2 static categories to constants.
   - **#14**: Remove Save/Cancel buttons from Sunan toast (switch to auto-save).
   - **#24**: Remove Chart.js zoom plugin and dead zoom logic.
   - **#25**: Change Pomodoro modal "✕" button label to "إخفاء" (Hide).

2. **Low (1.5 - 2.0/5)**:
   - **#15**: Obligatory prayer completion logic (`ALONE` = 100% complete).
   - **#11**: Exclude `disabledTaskIds` from scheduled days count in analytics breakdown.
   - **#7**: Dual input (hours + minutes) for Pomodoro configuration.
   - **#1**: Min/max progress cards in statistics view.
   - **#4**: Daily time done/remaining and task breakdown badges.
   - **#12**: Decouple bonus tasks from required target denominator.
   - **#16**: Remove guest mode bypass and guest buttons.
   - **#17**: Registration form gender & religion fields.
   - **#19**: Strip PIN GateKeeper lock screen and code.
   - **#20**: Profile metadata edit & password change form.
   - **#21**: Chart metric toggle (Hours vs. Percentage).
   - **#22**: Task cards progress & total time tags.
   - **#23**: Add timer columns to `users` table and persist defaults.
   - **#27**: Trigger native datepicker when clicking date on daily header.
   - **#28**: Chart data point click switches view and jumps to that day.
   - **#29**: Self-encouragement / motivational note widget on home page.
   - **#30**: Top-4 tasks + "others" circular doughnut chart.
   - **#31**: Consolidate overlapping fasting schedules into a single task.

3. **Medium (2.5 - 3.5/5)**:
   - **#18**: Demographic task presets & female binary prayer controls.
   - **#5**: Freeze historical day scores loaded from DB.
   - **#13**: Historical bonus immutability (decouple past logs from current task schedules).
   - **#26**: Split midnight-spanning Pomodoro time between Day 1 and Day 2.
   - **#9**: Category exclusion filter in analytics.
   - **#10**: Unified global filter state machine across analytics components.
   - **#2**: Granular dirty-field timestamps for offline/realtime sync.

4. **High (4.0 - 4.5/5)**:
   - **#6**: Realtime cross-device Pomodoro sync and clock drift compensation.
   - **#3**: Multi-task historical merge engine across all past records.

---

## 📝 Detailed Specifications

### 1. High Priority (P1) — Data & Scoring Correctness

#### Issue #15: Show prayer as completed in UI when prayed alone while retaining 50% score [Completed]
- **Files**: `js/core/task-rules.js`, `js/components/daily-view.js`, `js/components/day-summary.js`
- **Scope**: In `APP_CONSTANTS.PRAYER_VALUES`, `ALONE` is `0.5` and `CONGREGATION` is `1.0`. The scoring engine retains this 50% vs 100% score weighting, but in the UI, `isTaskCompleted()` now evaluates to `true` for any obligatory prayer with `val > 0`. This marks the task completed, moves it down into the completed tasks section, updates completed counters, removes remaining estimated minutes, and renders clear `منفرد (50%)` or `جماعة (100%)` status labels.

#### Issue #2: Restrict time-based conflict resolution strictly to dirty fields
- **Files**: `js/app.js`, `js/api.js`
- **Scope**: When syncing offline changes with Supabase via `mergeDayLog()`, timestamp-based conflict resolution (LWW) must only evaluate fields and tasks locally flagged as dirty (`_dirtyTasks` / `_dirtyFields`). Untouched remote fields must always take precedence over stale local cache values.

#### Issue #5: Freeze historical days' score and values from DB without dynamic recalculation
- **Files**: `js/core/scoring-engine.js`, `js/app.js`
- **Scope**: Historical days loaded from the database must use their stored `total_score` and `total_hours`. Bypasses dynamic re-weighting against current `appData.tasks` so that modifying or deleting a task today does not distort previous months' scores.

#### Issue #13: Prevent retroactive bonus reclassification on past days when task settings change
- **Files**: `js/core/schedule-engine.js`, `js/core/scoring-engine.js`
- **Scope**: Changing a task's schedule type (e.g. to "Optional" or "OneTime") must not alter how past days are interpreted. Historical logs must derive their scheduled vs. bonus status from the database record rather than the current live task definition.

#### Issue #12: Fix bonus entries acting as required targets that decrease task/day progress
- **Files**: `js/components/analytics-breakdown.js`, `js/core/scoring-engine.js`
- **Scope**: Bonus activities must be strictly additive. Ensure partial or zero completion on a bonus task never increments `scheduledDaysCount` or adds to `reqTotalWeight`, preventing bonus tasks from dragging down consistency rates.

#### Issue #11: Exclude stopped/deactivated tasks from scheduled days count in stats
- **Files**: `js/components/analytics-breakdown.js`
- **Scope**: In `renderTaskBreakdown()`, verify whether `log.disabledTaskIds` includes the task ID on that date. Days where the task was deactivated/paused must not increment `scheduledDaysCount` if no value was recorded.

#### Issue #31: Consolidate overlapping fasting tasks into a single task with priority resolution
- **Files**: `js/core/schedule-engine.js`, `js/components/daily-view.js`
- **Scope**: When Monday/Thursday fasting coincides with the White Days (13, 14, 15 Hijri) or Ramadan, prevent rendering multiple duplicate fasting tasks on the daily dashboard. Apply the Islamic hierarchical priority:
  1. **Ramadan (رمضان)**: Suppresses all voluntary fasting tasks.
  2. **White Days (الأيام البيض)**: Suppresses regular Monday/Thursday fasting ("صيام الإثنين والخميس") when they occur on the same date, displaying only the White Days task (or unified label).
  3. **Monday/Thursday (صيام الإثنين والخميس)**: Displayed on regular non-White Mondays and Thursdays.
- **Acceptance Criteria**: A user is never required to log two separate fasts on a single day, eliminating false incomplete penalties in day scores and streaks.

#### Issue #26: Split midnight-spanning Pomodoro time accurately across both consecutive days
- **Files**: `js/components/pomodoro.js`, `js/app.js`
- **Scope**: If a focus session starts before midnight and completes after midnight (e.g. 11:45 PM to 12:15 AM), calculate the pre-midnight minutes for Day 1 and post-midnight minutes for Day 2, persisting to both day logs independently.

---

### 2. Medium Priority (P2) — Personalization, Daily UX & Analytics

#### Issue #27: Open interactive calendar datepicker upon clicking header date on home page
- **Files**: `js/components/daily-view.js`, `index.html`
- **Scope**: Make the date header (`#current-date-display`) clickable with a cursor pointer. Attach a hidden HTML5 datepicker input that triggers on click, allowing users to jump directly to any selected date.

#### Issue #28: Clicking a day point on the chart navigates to home page to inspect that day
- **Files**: `js/components/analytics-view.js`
- **Scope**: Add an `onClick` event listener to Chart.js elements. Clicking a specific date point sets `currentDateStr` to that date, switches the active tab to `#view-daily`, and renders that day's entries.

#### Issue #22: Show explicit percentage progress and total time on task cards
- **Files**: `js/components/daily-view.js`, `css/style.css`
- **Scope**: Add clear numerical progress labels (`progressPct% (val/target)`) and total logged time tags (`الوقت: X دقيقة/ساعة`) to task cards in the daily dashboard.

#### Issue #4: Daily view counters: time (done & rem.) + tasks (done, running, rem.)
- **Files**: `js/components/day-summary.js`, `index.html`
- **Scope**: Expand `#daily-summary-stats` to display time completed vs. time remaining, and a 3-way status counter: Completed Tasks, In-Progress/Running Tasks, and Unstarted Remaining Tasks.

#### Issue #25: Change Pomodoro modal "✕" close button to "إخفاء" (Hide)
- **Files**: `js/components/pomodoro.js`, `index.html`
- **Scope**: Replace the close "✕" icon with an eye-slash icon and label "إخفاء المؤقت" to clarify that the focus timer continues running in the background.

#### Issue #29: Add self-encouragement motivational note widget on the home page
- **Files**: `js/components/daily-view.js`, `index.html`
- **Scope**: Add a dedicated "رسالة إلى نفسي / تشجيع ذاتي" card on the home tab with an editable text area that autosaves to local and cloud storage.

#### Issue #14: Remove redundant Save/Cancel buttons from Sunan & Azkar prayer toast
- **Files**: `js/components/nawafel-toast.js`, `index.html`
- **Scope**: Eliminate `#btn-nawafel-save` and `#btn-nawafel-cancel`. Auto-save changes immediately upon counter adjustments or checkbox toggles, and allow dismissing the toast by tapping outside or on a close button.

#### Issue #24: Remove Chart.js zoom plugin and all related gesture/zoom logic
- **Files**: `js/components/analytics-view.js`, `index.html`
- **Scope**: Remove `chartjs-plugin-zoom` script and its options block to prevent chart gesture interference with page scrolling on touchscreens.

#### Issue #19: Remove the PIN GateKeeper screen, hashing logic, and modals
- **Files**: `js/components/security-lock.js`, `index.html`, `css/security-lock.css`
- **Scope**: Strip the client-side PIN padlock screen, settings controls, and hashing listeners, allowing direct dashboard entry upon account login.

#### Issue #17: Add gender and religion selection fields to account registration
- **Files**: `js/components/auth-manager.js`, `database/schema.sql`, `index.html`
- **Scope**: Add `gender` (`male`/`female`) and `religion` (`muslim`/`non_muslim`) columns to `public.users` and render corresponding selection inputs in the registration modal.

#### Issue #18: Personalize tasks by demographic (omit Islamic tasks for non-Muslims; binary prayer toggle for females)
- **Files**: `js/core/task-rules.js`, `js/app.js`
- **Scope**:
  1. For non-Muslims: Omit Islamic worship categories and seed only neutral habit presets.
  2. For females: Replace the 3-button prayer toggle with a simplified binary control (`صليت / لم أصل`), removing the mosque/congregation distinction.

#### Issue #20: Allow users to edit their profile metadata (gender, religion) and change password
- **Files**: `js/components/auth-manager.js`, `js/components/data-manager.js`, `index.html`
- **Scope**: Add an "إعدادات الحساب والأمان" section in Settings to allow updating profile metadata and updating passwords with verification of current password.

#### Issue #21: Add metric selector to statistics chart (toggle between Hours and Percentage)
- **Files**: `js/components/analytics-view.js`, `index.html`
- **Scope**: Provide toggle buttons above the chart (`ساعات` vs. `نسبة مئوية %`) to dynamically switch between plotting daily achieved hours and daily completion percentage (0–100%).

#### Issue #30: Add circular doughnut chart in statistics showing share of top 4 tasks + "others"
- **Files**: `js/components/analytics-view.js`, `index.html`
- **Scope**: Add a Chart.js doughnut chart summarizing time/effort distribution across the active date range. Displays the top 4 tasks individually and groups all remaining habits into an "أخرى" (Others) segment.

#### Issue #10: Unify statistics page filters to centrally control all dashboard data
- **Files**: `js/components/analytics-view.js`, `js/components/analytics-breakdown.js`
- **Scope**: Centralize filter state (Time range, Status, Category) into a single coordinator that synchronously updates the hero metrics, average hours, chart dataset, and task breakdown cards.

#### Issue #9: Allow excluding specific categories from chart & statistics calculations
- **Files**: `js/components/analytics-view.js`, `index.html`
- **Scope**: Add category exclusion toggles to filter out selected categories (e.g. chores or work) from habit score calculations and chart curves.

#### Issue #1: Add highest and lowest progress cards to the statistics page
- **Files**: `js/components/analytics-view.js`, `index.html`
- **Scope**: Render two highlight cards in the statistics dashboard displaying the habit with the highest completion ratio and the habit with the lowest completion ratio.

#### Issue #16: Remove Guest Mode and enforce authenticated user sessions
- **Files**: `js/components/auth-manager.js`, `js/app.js`, `index.html`
- **Scope**: Remove `#btn-auth-guest` and guest bypass paths, requiring all users to authenticate with a persistent account.

#### Issue #8: Add "أعمال منزلية" (Housework) and "أخرى" (Others) to categories
- **Files**: `js/config/constants.js`
- **Scope**: Append default category configurations for household chores and miscellaneous activities to `APP_CONSTANTS.CATEGORIES`.

---

### 3. Low Priority (P3) — Power Focus Tools & Heavy Consolidation

#### Issue #23: Persist user default timer settings to `public.users` table
- **Files**: `database/schema.sql`, `js/components/pomodoro.js`, `js/components/auth-manager.js`
- **Scope**: Store user-customized Pomodoro work and rest durations on the `users` table so focus timer settings persist across devices.

#### Issue #7: Configure Pomodoro duration using both hours and minutes
- **Files**: `js/components/pomodoro.js`, `index.html`
- **Scope**: Replace single-minutes input with dual inputs for hours and minutes in the Pomodoro configuration modal.

#### Issue #6: Cross-device Pomodoro sync and remove 180-minute ceiling
- **Files**: `js/components/pomodoro.js`, `js/api.js`, `js/config/constants.js`
- **Scope**: Broadcast active timer status across devices via Supabase Realtime channel and remove the `POMO_WORK_MAX = 180` ceiling.

#### Issue #3: Task merge button to consolidate multiple tasks into one
- **Files**: `js/components/task-manager.js`, `js/app.js`, `js/api.js`
- **Scope**: Add a task merge tool allowing users to select a target task and multiple source tasks, combining historical progress entries across all past dates and archiving/purging the source tasks.
