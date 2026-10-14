# Contributing to Awrady (أورادي)

Thank you for your interest in contributing to **Awrady**! 🎉  
Awrady is an open-source, offline-first habit and Islamic wird tracker built with modern Vanilla JavaScript. We welcome contributions from developers of all experience levels.

---

## 🚀 10-Second Quick Start (Zero Build Step)

Awrady does **not** use Node build tools, bundlers, or `npm install`. To get started:

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/Awrady.git
   cd Awrady
   ```

2. **Start a local HTTP server:**
   ```bash
   # Using Python 3 (cross-platform):
   python -m http.server 8080

   # Or on Windows, double-click:
   start_dashboard.bat
   ```

3. **Open in your browser:**  
   Navigate to [`http://localhost:8080`](http://localhost:8080).

> [!TIP]
> You do **not** need a Supabase backend to develop or test features. The app defaults to **Guest Mode** with full local offline storage out of the box.

---

## 🎯 Finding an Issue

- Look for issues labeled **[`good first issue`](https://github.com/Mhmd7syn/Awrady/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)** — these are bite-sized, self-contained tasks designed for first-time contributors.
- If you have an idea or found a bug not yet listed, please [open an issue](https://github.com/Mhmd7syn/Awrady/issues/new/choose) first so we can discuss the approach before you write code.
- Drop a quick comment on the issue you'd like to tackle (e.g. *"I'd like to work on this!"*) so we can assign it to you.

---

## 🛠️ Contribution Workflow

1. **Create a branch:**
   ```bash
   git checkout -b feat/your-feature-name
   # or for bug fixes:
   git checkout -b fix/issue-description
   ```

2. **Make your changes:**
   - Keep pull requests focused on a single feature or bug fix.
   - Follow existing code patterns (plain Vanilla JS, semantic HTML, modular CSS).

3. **Verify the Smoke Checklist (before opening your PR):**
   - [ ] Log in as guest (default).
   - [ ] Tap a prayer status (Fard / Sunnah) and verify the score updates.
   - [ ] Click `+` / `-` on a counter task.
   - [ ] Log time (hours / minutes) on a time task.
   - [ ] Start, pause, and reset a Pomodoro session.
   - [ ] Reload the page and ensure all logged progress persists.
   - [ ] Check DevTools Console to confirm no JavaScript errors are thrown.

4. **Service Worker Notice (Important):**
   If your PR adds, deletes, or renames any file, increment the version in:
   - `CACHE_NAME` inside [`sw.js`](sw.js)
   - Any script/CSS query strings `?v=...` inside [`index.html`](index.html)

5. **Commit with clear messages:**
   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add sound chime when pomodoro timer finishes`
   - `fix: resolve counter button overflow on mobile screens`
   - `docs: update setup instructions in README`

6. **Submit your Pull Request:**
   - Push your branch to your fork: `git push origin feat/your-feature-name`
   - Open a PR against the `main` branch.
   - Fill in the provided PR template.

---

## 🎨 Code & Design Guidelines

- **Zero-Dependency Philosophy:** Please do not introduce npm packages, build tools, or frameworks unless discussed in an issue beforehand.
- **RTL & Arabic First:** The primary interface is Arabic RTL (`dir="rtl"`). Ensure UI elements, fonts (Cairo / Outfit), and spacings remain responsive and visually balanced across desktop and mobile screens.
- **Simplicity:** Write clean, readable code with comments only where logic is non-obvious.

---

## 💬 Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project, you agree to abide by its terms to maintain a respectful and welcoming environment for everyone.
