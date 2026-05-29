# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MyBoard is a **local-first, no-build** personal dashboard (academic tasks, household lists, health habits, reminders) with optional private GitHub Gist sync. There is no bundler, package manager, or test suite — React, ReactDOM, and Babel Standalone are loaded from CDN in `index.html`, and `.jsx` files are transpiled in the browser via `<script type="text/babel">`.

## Running

Must be served over HTTP (Gist sync and reliable script loading need it — opening `index.html` via `file://` will not work):

```bash
python3 -m http.server 8080   # then open http://localhost:8080/
```

There is no build, lint, or test command. Changes to `.jsx`/`.css` are picked up on browser reload.

## Git workflow

Commit directly to `main` — do **not** create feature branches. When asked to commit, stage and commit on `main`; when asked to push/merge, push `main` to `origin`.

## Critical constraint: script load order

`index.html` loads the `.jsx` files as plain scripts in a fixed order — **there are no ES module imports/exports**. Files communicate through globals on `window`. Order: `tweaks-panel.jsx` → `store.jsx` → `components.jsx` → `academic.jsx` → `app.jsx` (App must be last). A file can only reference globals defined by files loaded before it. When adding a file, add a `<script>` tag in the correct position.

## Architecture

- **`store.jsx`** — the data layer, exposed as `window.MyBoardStore`. Owns the canonical state shape (`EMPTY_STATE`: `academic{projects,deadlines,teaching,service,readings}`, `household{chores,reminders,shopping}`, `health{habits,reminders}`, `meta{updatedAt}`), localStorage persistence (keys prefixed `myboard.`), state normalization, `uid`/date/`MS` time helpers, and all GitHub Gist sync (`fetchRemote`/`createRemote`/`pushRemote`, plus `debounce`). The token is stored only in localStorage and sent directly to GitHub's API.
- **`app.jsx`** — the root `App` component (last script). Destructures `window.MyBoardStore`, owns top-level state, conflict resolution between local and remote (last-modified wins), the `SetupModal` (Gist config) and `NameModal`, the upcoming-item logic (`collectUpcomingPair`), and `CATEGORIES` (academic/household/health, each with oklch accent colors).
- **`components.jsx`** — shared/household-ish panels (`ProjectPanel`, `ReadingPanel`, `ShoppingPanel`, `HabitPanel`, `ChoresPanel`, `ReminderPanel`) plus primitives like `AutoTextarea`, `EditButton`. Most panels are `memo`'d and follow an `{ items, onChange }` prop contract.
- **`academic.jsx`** — academic panels (`DeadlinesPanel`, `TeachingPanel`, `ServicePanel`) with their own kind/type color maps and deadline bucketing (`BUCKET_ORDER`).
- **`tweaks-panel.jsx`** — a dev/design tweak UI (sliders, toggles, selects) toggled by keyboard; persists tweak values to localStorage. Injects its own CSS via `__TWEAKS_STYLE`.
- **`styles.css`** — all styling (large, hand-written, oklch color space).

Cross-file calls happen via `window` (e.g. `window.formatWhen`, `window.relTime`, `window.replaceServiceItems`, `window.__toggleTweaksPanel`). When you need a function across files, attach it to `window` in the defining file.

## Data & privacy

- `_seed-data.json` and `.thumbnail` are personal data, gitignored, and must never be committed. The repo ships with an empty board.
- No user data, display name, or GitHub token is hard-coded — all live in browser localStorage at runtime.
