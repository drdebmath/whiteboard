# DESIGN.md — Whiteboard design language

How Whiteboard looks, and *why* — the rules that keep six very different tabs
feeling like one calm, forward-looking instrument rather than six dashboards
bolted together. This is a description of the system that already exists in
`styles.css` plus the conventions every new panel must follow.

The governing idea is the same one in CLAUDE.md: **Whiteboard shows the current
and the future, never the past.** Design serves that. The interface should make
*what needs attention now* impossible to miss and let everything else recede.
When a screen feels cluttered, it is almost always because too many things are
shouting at the same volume. The job of the design language is to assign volumes.

---

## 1. The three volumes of information

Every element on the board belongs to one of three tiers. Decide the tier first;
the styling follows from it.

- **Display** — the one thing a glance should land on. Set in the **serif**
  (`--font-serif`, Newsreader), large, generous. Reserved for: the greeting, the
  next-up / overdue banners, panel titles, modal headers. Display type is a
  *moment*, never a label. If everything is serif, nothing is.
- **Structure** — the working content: card titles, list rows, inputs, values.
  Set in the **sans** (`--font-sans`, Geist) at 13–14.5px in `--ink`. This is
  where the user reads and edits. It should be quiet and even.
- **Metadata** — the supporting marks: due dates, counts, statuses, "synced X
  ago", section labels. Small (10.5–12px), `--muted`, often uppercase-tracked or
  `tabular-nums`. Metadata never competes with structure; it sits beside or under
  it.

The single most common clutter bug is metadata rendered at structure weight —
five muted-but-equal chips on one row. Push metadata down a tier visually and the
row breathes.

---

## 2. Color

Color carries meaning. We do not decorate with it.

- **Surfaces** are warm paper in light, warm ink in dark — never pure white or
  black. The scale is `--bg` → `--surface` → `--surface-2`, each step a nesting
  level (page → panel → item-within-panel). Don't invent a fourth level; if you
  need one, you have nested too deep.
- **Category accent** — each tab owns one muted jewel tone (`--academic` blue,
  research violet, `--household` green, `--health` orange, `--finance` teal,
  `--travel` purple), all at equal visual weight so no tab dominates the nav. The
  active tab's accent is poured into that tab's surfaces as `--tab-tint` so its
  cards read as a family. **A tab's color is ambient, not loud** — it lives in the
  panel tint, the title tick, and the left border, not in fills.
- **The user accent** (`--accent`, hue-tweakable) is the *interaction* color:
  focus rings, primary buttons, checkboxes, progress fills, the selected day.
  Keep category-accent (identity) and user-accent (interaction) in their lanes.
- **Status is a fixed three-note scale**, used identically everywhere:
  - **overdue → `--danger`** (red): loud. Danger border, danger-soft fill, danger
    text on the time.
  - **soon → `--accent`**: noticed but calm. Accent on the time only.
  - **calm / fresh / future → `--muted`**: silent.
  Money has its own two notes: `--gain` / `--money-pos` and `--loss` /
  `--money-neg`. Never use red for a negative number *and* red for overdue in a
  way that reads as the same thing — context (a money figure vs a date) keeps them
  apart, so don't add a third red.

Color must survive both themes and any hue. Use the tokens; never hardcode an
`rgb()`/`#hex`. The two floating launchers — the help `?` (`.help-fab`) and the
Tweaks `⚙` (`.tw-fab`) — are a matched pair and both read from `--panel-bg` /
`--line` / `--accent`, so they adapt together. (The Tweaks *panel* keeps its own
deliberately dark aesthetic; only its launcher harmonizes.)

---

## 3. The recurring patterns (use these; don't invent neighbours)

These are the vocabulary. A new panel should be assemblable almost entirely from
them.

- **Panel** — translucent glass card: `--panel-bg`, `--panel-radius`,
  `--panel-shadow`, 1px tinted border. Every panel opens with a `.panel-header`:
  serif title + a 3px accent tick (`::before`) + trailing action pushed right.
- **Left-border accent (3px)** — the workhorse motif for "this row/card has a
  category, status, or priority." Used by deadline rows, chores, service cards,
  goals, project priority, trip alerts, timetable slots, the next-up banner. If an
  item needs a categorical or urgency signal, this is the first tool to reach for.
- **Chip** (`.kind-chip`) — a small static type tag, colored by `--chip`. For
  kind/type/category labels (Course, Visa, Mutual Fund, cadence).
- **Status pill button** (`.reimb-status-btn` pattern) — a chip that is *clickable*
  and *cycles* a workflow state (submission stage, reimbursement status, proposal
  status). Visually a chip, behaviorally a button. One pattern, reused.
- **Progress bar** (`.budget-bar` / `.teaching-progress`) — a 5–6px track with an
  accent fill, `--gain` when complete, `--loss` when over. For any part-of-whole.
- **Expandable card** (`.project-card`) — collapsed shows title + a few metadata
  marks + reveal-on-hover actions; expanded reveals a detail body with
  `.project-section` field groups. Projects, grants, advisees, and trips all share
  this exact shell. New "object with details" entities should too.
- **Meta-when** — the trailing "Mon 5 · 2d" date stamp on a row: muted, 11.5px,
  `tabular-nums`, `nowrap`, `flex-shrink:0`; overdue→danger, soon→accent. The eight
  historical class names (`deadline-due`, `grant-due`, `bill-due`, `reimb-due`,
  `doc-expiry`, `service-due`, `reminder-time`, `trip-range`) now share **one base
  definition + two urgency groups** (the "Meta-when" block in `styles.css`). New
  dated panels reuse these hooks rather than coin a ninth.
- **Reveal-on-hover affordance** — destructive/secondary controls (`.btn-delete`,
  `.btn-edit`) sit at `opacity:0` (or 0.5 on dense rows) and surface on row hover.
  The resting row stays quiet; tools appear when you reach for them.

---

## 4. Adding items — ONE doorway per panel (the rule to converge on)

Today there are three conventions; that is the biggest single source of visual
noise. The target rule:

- **Light items** (a line of text, maybe a date) → an **always-visible add row**
  (`.todo-input-row`): input + `+`. One line, low chrome. (Reminders, shopping,
  habits, packing, wishlist, savings, grant heads do this — keep it.)
- **Structured items** (3+ fields) → a **collapsed `+ Add` toggle** that reveals
  the form (`.academic-form`) only when adding, then closes. Deadlines, Teaching,
  Service, Trips, Loans, Grants, Advisees, Timetable already do this — it is the
  correct default for heavy panels.
- **Never leave a multi-field form permanently open** at the top of a panel. A
  panel's resting state should show *data*, not an empty form. (Submissions,
  Proposals, CFP, Reviews, Letters, Bills, Reimbursements, Investments, Contacts
  currently violate this — they greet you with empty inputs before any content.)

Buttons that trigger the doorway are also unified: the pill `+ Add`
(`.academic-add-btn`) for the toggle form; the 24px square `+`
(`.btn-add-inline`) only for the always-on light add. Don't mix per panel.

---

## 5. Layout & rhythm

- **Spacing is a scale, not ad-hoc.** `--gap` (between panels), `--pad` (inside a
  panel), `--radius` / `--radius-sm`. Density tweak scales `--gap`/`--pad`
  together. Reach for the token; don't sprinkle magic px.
- **Each tab earns its layout** but the menu is small and intentional:
  - 2-column flex (`.panels-col` × 2) — household, health, finance, travel. Used
    when content is a set of independent lists.
  - 2-column grid with full-width breakouts — academic, where Projects and Reading
    anchor across the width.
  - Full-width anchor + sub-columns — research, where Projects span and the rest
    splits.
  The bare `.panels` class carries no layout of its own — each tab's `.panels-*`
  modifier sets `display:grid`/`flex` and its own gaps.
- **Right-hand column = aspiration.** `GoalsPanel` sits top-right on finance,
  travel, research, household, health. Goals are the forward-looking "why";
  keeping them in a consistent corner is part of the language.
- **One anchor per tab.** The heaviest, highest-worth panel gets slightly more
  lift (`--panel-shadow-raised`) so the eye has an entry point: Academic →
  Projects, Research → Projects, Household → Chores, Health → Habits, Finance →
  Grants, Travel → Trips. A tab of N equal-weight panels has no entry point — that
  reads as clutter even when nothing is wrong.

---

## 6. Motion & feedback

Quiet and quick. Transitions are 0.12–0.2s ease on color/border/opacity/shadow —
never on layout (no jumping). State that comes and goes (sync status) **reserves
its space and fades** rather than mounting/unmounting and reflowing the view; new
transient UI must do the same. The undo toast and date popover may animate in
(small translate + fade); persistent surfaces may not.

---

## 7. The checklist for any new panel or item

1. What tier is each piece of text — display, structure, or metadata? Style to the
   tier, not to taste.
2. Does urgency map to the three-note status scale? Reuse `.overdue` / `.soon`.
3. Is there an existing pattern (chip, status pill, progress bar, expandable card,
   meta-when, left-accent) before you write new CSS? Almost always yes.
4. Is the add-doorway the right one of the two (light row vs collapsed form)? No
   permanently-open multi-field forms.
5. Does the resting state show *data*, with tools hidden until hover?
6. Tokens only — survives light/dark and any hue.
7. Does it surface the future and let the done fade (`done`/`achieved`/`received`
   states dim and drop in sort order), per the project philosophy?
