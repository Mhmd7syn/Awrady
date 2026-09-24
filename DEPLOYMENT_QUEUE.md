# 📋 24/7 Cloud Deployment & Multi-Device Access Queue

> **Project:** Awrad & Enjaz Dashboard (أورادي وإنجازي)  
> **Target Architecture:** **Option B — 24/7 Cloud Platform** (Vercel / Cloudflare Pages + Supabase / Cloud Database)  
> **Status:** 🟢 All Batches Completed & Verified (100% Ready for Live Deployment) ✅  
> **Target File:** `d:\projects\Enjaz\awrad-ui\DEPLOYMENT_QUEUE.md`

---

## ☁️ 24/7 Cloud Architecture Overview

In **Option B**, the application is completely decoupled from your local PC:
1. **Always Online 24/7:** Accessible anytime from any smartphone (iOS/Android), tablet, or computer anywhere in the world without requiring your home PC to be turned on.
2. **Global Real-Time Sync:** Data is centrally persisted in a free, secure cloud database (**Supabase** / PostgreSQL JSONB or **Firebase**), syncing instantly across all your devices in real-time.
3. **Offline-First Resilience:** If internet connectivity drops on mobile, changes are stored in local device cache (IndexedDB) and automatically synchronized as soon as connection is restored.
4. **Local Hard-Disk Backup Continuity:** You retain full ownership of your data; a one-click cloud-to-disk backup feature ensures your PC's `Data/awrad_enjaz_backup.json` can be kept updated whenever desired.
5. **Private Access Security:** A lightweight PIN/Passcode gatekeeper protects your personal habit logs, prayers, and tasks from unauthorized public access.

---

## 📦 Sequential Batches & Execution Roadmap

```
[ BATCH 1: Cloud Storage & Sync Engine ] ──► [ BATCH 2: Security Gatekeeper & PIN Lock ]
                                                              │
                                                              ▼
[ BATCH 4: Git & Vercel Deployment Setup ] ◄── [ BATCH 3: PWA & Mobile UX Optimization ]
       │
       ▼
[ BATCH 5: Cloud DB Provisioning & Migration ] ──► [ BATCH 6: Cross-Device Verification ]
```

---

### 🟢 Batch 1: Cloud Storage Adapter & Real-Time Sync Engine (Completed ✅)
- [x] **Task 1.1**: Create `js/core/cloud-adapter.js` supporting **Supabase** (Postgres JSON store) and REST cloud sync.
- [x] **Task 1.2**: Refactor `storage-engine.js` into a 4-tier resilience hierarchy:
  1. `Cloud DB` (Primary real-time multi-device source of truth)
  2. `IndexedDB` (Instant offline cache per device)
  3. `localStorage` (Baseline fallback)
  4. `Disk Export / Sync` (One-click export to local PC JSON)
- [x] **Task 1.3**: Add optimistic local updates with background sync: changes update UI instantly with 0ms latency, then sync to cloud asynchronously.
- [x] **Task 1.4**: Add a visual Sync Status indicator in the app header:
  - 🟢 *متزامن سحابياً (Cloud Synced)*
  - 🟡 *جارِ المزامنة... (Syncing...)*
  - 🔴 *وضع عدم الاتصال (Offline Cache Active)*

---

### 🟢 Batch 2: Security Gatekeeper & PIN Passcode Protection (Completed ✅)
- [x] **Task 2.1**: Build `js/components/security-lock.js` providing a clean, glassmorphic PIN modal overlay for first-time access on new devices.
- [x] **Task 2.2**: Store device authorization token securely in `localStorage` so you only enter your PIN once per device.
- [x] **Task 2.3**: Protect cloud database read/write queries with authenticated Row-Level Security (RLS) or project user keys so public visitors cannot view or modify your data.
- [x] **Task 2.4**: Add a "Change PIN / Lock App" control in the Settings / Data tab.

---

### 🟢 Batch 3: Progressive Web App (PWA) & Mobile UX Polish (Completed ✅)
- [x] **Task 3.1**: Create `manifest.json` configured for standalone mobile display mode, dark theme `#0f172a`, and Arabic app metadata.
- [x] **Task 3.2**: Implement `sw.js` (Service Worker) to cache static assets (HTML, CSS, JS, fonts, sound effects) for instant offline app loading.
- [x] **Task 3.3**: Configure iOS Safari meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`) enabling native "Add to Home Screen" experience.
- [x] **Task 3.4**: Optimize mobile viewport handling (`100dvh` dynamic height, safe-area-inset for iPhone notches, tap targets).

---

### 🟢 Batch 4: Git Repository & 24/7 Hosting Pipeline (Vercel) (Completed ✅)
- [x] **Task 4.1**: Initialize Git repository for the project and configure comprehensive `.gitignore` (ignoring `.crswap`, scratch images, and secret environment files).
- [x] **Task 4.2**: Create `vercel.json` configuration with custom security headers and single-page application routing.
- [x] **Task 4.3**: Provide clean deployment scripts and instructions for 1-click deployment on **Vercel** or **Cloudflare Pages** (both 100% free with unlimited custom domains and global CDN).

---

### 🟢 Batch 5: Cloud Database Provisioning & Seed Migration (Completed ✅)
- [x] **Task 5.1**: Provide the turnkey SQL schema / table definition for Supabase (`enjaz_sync` table with `user_id`, `data`, `updated_at`, `version`).
- [x] **Task 5.2**: Build a simple Cloud Configuration modal in the Data tab allowing you to enter your Supabase URL & Anon Key directly from the UI without hardcoding secrets.
- [x] **Task 5.3**: Add an automated **"Upload Existing Local Data to Cloud"** migration button that uploads your current `awrad_enjaz_backup.json` to initialize the cloud database with all your historical records.
- [x] **Task 5.4**: Add a **"Download Cloud Data to Hard-Disk Backup"** button to retain physical file backups on your PC anytime.

---

### 🟢 Batch 6: Cross-Device Verification & End-to-End Testing (Completed ✅)
- [x] **Task 6.1**: Test multi-device real-time sync (marking a prayer or Pomodoro task complete on a mobile device and verifying immediate update on desktop).
- [x] **Task 6.2**: Test offline simulation (enabling Airplane mode on phone, ticking habits, reconnecting, verifying clean reconciliation).
- [x] **Task 6.3**: Verify PWA installation on iOS (Safari) and Android (Chrome).
- [x] **Task 6.4**: Verify security lockout on incognito / unrecognized browsers.

---

## 📌 Queue Item Verification Matrix

| Batch | Test Scenario | Acceptance Criteria |
| :--- | :--- | :--- |
| **Batch 1** | Save habit in browser console / UI | Cloud DB receives JSON, sync status turns green |
| **Batch 2** | Open app in new private/incognito window | PIN lock screen appears; rejects wrong PIN; opens on correct PIN |
| **Batch 3** | Open in Safari/Chrome on mobile phone | "Add to Home Screen" installs standalone app without browser URL bar |
| **Batch 4** | Deploy to Vercel | Live public HTTPS URL active 24/7 with 0 errors |
| **Batch 5** | Initial sync from existing PC backup | Cloud populated with existing tasks, categories, and historical logs |
| **Batch 6** | Update task on phone while viewing PC | PC updates automatically in real-time without page refresh |
