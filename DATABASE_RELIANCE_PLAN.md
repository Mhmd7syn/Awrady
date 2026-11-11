# Database Reliance & Direct Load/Save Architecture Plan

## 1. Overview & Root Cause
The original Awrady implementation was designed as an offline-only `localStorage` application. Over time, Supabase cloud sync was introduced, but legacy layers remained:
1. **Dual State**: In-memory state maintains both `log.entries` (raw numbers) and `log.taskProgress` (structured objects with target, achieved, status, hours, score).
2. **Redundant Status Arrays**: Task deactivation was tracked simultaneously in `log.disabledTaskIds` and `log.taskProgress[taskId].status = "disabled"`.
3. **Complex Reconstruction**: Every save ([pushDayToCloud](file:///d:/projects/Awrady/js/app.js#L196)) iterates all tasks globally and recalculates targets, schedules, and statuses rather than saving what is already in memory.
4. **Obsolete Fallbacks**: Legacy type checks (`typeof tp === "object" ? ... : Number(tp)`), orphaned function calls (`cleanStoredDayLog`), and multi-field timestamp merge queues.

### Target State
Supabase `public.daily_progress` is the authoritative source of truth.
Each date's record in memory (`appData.logs[date]`) maps 1:1 with the DB record:
```json
{
  "taskProgress": {
    "task_id": {
      "target": 5,
      "achieved": 3,
      "status": "scheduled",
      "hours": 0,
      "score": 0.6
    }
  },
  "prayerExtras": {},
  "totalScore": 0.6,
  "totalHours": 0
}
```

---

## 2. Master Implementation Phases

### Phase 1: Core State & Contract Refactor [Completed & Verified]
- Unified `getTaskVal` and `setTaskVal` in [daily-view.js](file:///d:/projects/Awrady/js/components/daily-view.js) to read and mutate `taskProgress[taskId]` directly without fallbacks.
- Eliminated state duplication in `handleTimeInputChange` to sync directly with `taskProgress`.
- Refactored `toggleDeactivateTaskForDate` and `#btn-reenable-all-today` in [daily-view.js](file:///d:/projects/Awrady/js/components/daily-view.js) to toggle `taskProgress[taskId].status` directly (`scheduled` ↔ `disabled`), ending reliance on `disabledTaskIds`.
- Refactored [ScheduleEngine](file:///d:/projects/Awrady/js/core/schedule-engine.js) to read `taskProgress[taskId]` directly.

### Phase 2: Direct Save & Direct Load Streamlining [Completed]
- Streamlined [pushDayToCloud](file:///d:/projects/Awrady/js/app.js#L196): persists `log.taskProgress`, `log.prayerExtras`, and calculated totals directly via `saveDayProgress`. Removed 50-line global task iteration loop.
- Streamlined `mergeDayLog`: local dirty edits take precedence over remote rows; clean remote rows take precedence over local cache without `entries` or `disabledTaskIds` machinery.
- Removed orphaned `cleanStoredDayLog` call from [switchActiveDate](file:///d:/projects/Awrady/js/app.js#L549).
- Updated [rowToLog](file:///d:/projects/Awrady/js/core/task-rules.js) to map directly into `taskProgress` without redundant `entries` unpacking.

### Phase 3: Consumer Engine Cleanup [Completed]
- Refactored [ScoringEngine](file:///d:/projects/Awrady/js/core/scoring-engine.js): computes scores directly from `taskProgress` achieved/target ratios.
- Refactored [pomodoro.js](file:///d:/projects/Awrady/js/components/pomodoro.js): writes completed minutes directly into `taskProgress[taskId]`.
- Refactored [task-manager.js](file:///d:/projects/Awrady/js/components/task-manager.js): archiving, deleting, and bonus tasks operate directly on `taskProgress`.
- Refactored [weekly-modal.js](file:///d:/projects/Awrady/js/components/weekly-modal.js), [analytics-view.js](file:///d:/projects/Awrady/js/components/analytics-view.js), and [analytics-breakdown.js](file:///d:/projects/Awrady/js/components/analytics-breakdown.js) to calculate progress using `taskProgress`.

### Phase 4: Purge Dead Code & Fallbacks [Completed]
- 100% eliminated `log.entries` across the entire codebase.
- 100% eliminated `log.disabledTaskIds` across the entire codebase.
- 100% eliminated `cleanStoredDayLog` across the entire codebase.

### Phase 5: Verification & Smoke Testing [Completed]
- Executed automated headless browser test suite against live local server on `http://localhost:8080/`.
- Verified 17/17 assertions passing across task mutation, deactivation, re-enabling, pomodoro logging, scoring calculation, DB hydration, and dirty conflict resolution.
- Bumped cache-busting query strings in [index.html](file:///d:/projects/Awrady/index.html) to `20261111_02` and service worker cache version in [sw.js](file:///d:/projects/Awrady/sw.js) to `awrady-pwa-v30`.
