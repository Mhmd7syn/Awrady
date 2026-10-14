# Awrady (أورادي)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Live Demo](https://img.shields.io/badge/Demo-awrady.vercel.app-blueviolet?logo=vercel)](https://awrady.vercel.app/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](#)
[![PWA Ready](https://img.shields.io/badge/PWA-offline--first-orange.svg)](#)

> **An offline-first, privacy-focused daily habit, wird, and routine tracker with Pomodoro focus timers, prayer tracking, zero dependencies, and cloud sync.**  
> تطبيق ويب تقدمي (PWA) لتتبع الإنجاز اليومي، الأوراد، والصلوات مع مؤقت بومودورو ودعم العمل دون اتصال بالإنترنت.

🌐 **Live Application**: [https://awrady.vercel.app/](https://awrady.vercel.app/)

---

## ⚡ Quick Start (< 10 Seconds)

Awrady is built with **pure modern Vanilla JavaScript** — **no `npm install`**, no bundlers, and zero build steps. You can run it immediately with any local HTTP server:

```bash
# 1. Clone the repository
git clone https://github.com/Mhmd7syn/awrady.git
cd awrady

# 2. Run local server
python -m http.server 8080

# (On Windows, you can also double-click start_dashboard.bat)
```

Now open **`http://localhost:8080`** in your browser.

---

## ✨ Features

- **📊 Daily Grid & Habit Tracking**: Real-time score calculation, habit streaks, custom targets, and flexible units (hours, count, minutes).
- **🕌 Prayer & Wird Tracker**: Dedicated logging for 5 daily prayers (congregation/alone), sunan, and Quran wird.
- **⏱️ Integrated Pomodoro Timer**: Built-in 25/5 focus interval timer that links directly to active tasks and logs study/work time.
- **📱 100% Offline-First PWA**: Installable on Android, iOS, Windows, and macOS via Service Worker caching. Works completely offline with automatic sync upon reconnecting.
- **☁️ Supabase Cloud Sync (Optional)**: Real-time synchronization across devices via PostgREST and Supabase Realtime, with a zero-config guest mode fallback.
- **🔒 Privacy & Security**: Client-side PIN lock and optional local-only encrypted storage.

---

## 📂 Project Architecture

```
awrady/
├── index.html                   # Core dashboard shell
├── sw.js                        # Service Worker (PWA offline caching)
├── manifest.json                # PWA manifest
├── css/                         # Modular CSS stylesheets
│   ├── style.css                # Base & dashboard styling
│   ├── mobile.css               # Responsive mobile layouts
│   ├── security-lock.css        # PIN lock modal styling
│   └── auth.css                 # Authentication modal styling
├── js/
│   ├── app.js                   # Main application coordinator
│   ├── api.js                   # Supabase client & real-time sync engine
│   ├── config/
│   │   └── constants.js         # Centralized constants, limits, and keys
│   ├── core/
│   │   ├── schedule-engine.js   # Schedule logic (Everyday, Weekdays, White Days)
│   │   └── scoring-engine.js    # Day score & completion calculation
│   └── components/
│       ├── task-manager.js      # Task creation, editing, and archiving
│       ├── pomodoro.js          # Pomodoro timer and audio controls
│       ├── analytics-view.js    # Charts, statistics, and 7/30-day views
│       ├── data-manager.js      # Backup, export, and reset handlers
│       ├── auth-manager.js      # User sessions and guest handling
│       └── security-lock.js     # PIN verification & screen lock
└── database/
    └── schema.sql               # PostgreSQL schema & idempotent migrations
```

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Backend / Database**: [Supabase](https://supabase.com/) (PostgreSQL + Realtime).
- **Offline / PWA**: Web Service Workers, Cache Storage API, LocalStorage.
- **Build Tooling**: None! Instant refresh in your browser.

---

## 🤝 Contributing

We welcome contributions from developers of all skill levels! 

Whether you want to fix a bug, improve Arabic/English translations, polish the UI, or add a new feature:

1. Read our **[Contributing Guidelines](CONTRIBUTING.md)** for branch conventions and testing instructions.
2. Check out open issues labeled **[`good first issue`](https://github.com/Mhmd7syn/awrady/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)** for bite-sized, beginner-friendly tasks.
3. Submit a Pull Request — we review and merge quickly!

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
