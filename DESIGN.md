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
  category, status, or priority." Used by chores, service cards, goals, project
  priority, trip alerts, timetable slots, the next-up banner. If an item needs a
  categorical or urgency signal, this is the first tool to reach for.
- **Chip** (`.kind-chip`) — a small static type tag, colored by `--chip`. For
  kind/type/category labels (Course, Visa, Mutual Fund, cadence).
- **Status pill button** (`.reimb-status-btn` pattern) — a chip that is *clickable*
  and *cycles* a workflow state (submission stage, reimbursement status, proposal
  status). Visually a chip, behaviorally a button. One pattern, reused. Sits in a
  meta-row's leading slot.
- **Tagged dated row** (`.meta-row`, component `MetaRow`) — the *one* row for
  every "leading tag + title + date (+ money) + edit/delete" item: deadlines,
  bills, claims, documents, submissions, proposals, calls, contacts. A flat
  hover-row whose every slot — a `lead` (checkbox or status-pill), a `chip`, the
  `.meta-row-title` (+ a `.meta-row-sub` aside), a `.meta-row-when` stamp, a
  `.meta-row-value` money figure, `extra` icons, edit, delete — is optional, so a
  panel passes only what it has and the result reads identically everywhere. The
  leading tag carries the category colour; urgency rides the stamp plus a faint
  danger wash on overdue rows; `done`/`received` dims and strikes the title. This
  replaced five near-identical namespaces (`.deadline-row`, `.bill-item`,
  `.reimb-item`, `.doc-item`, and a `.reminder-item` reuse) — a new "tagged dated
  item" renders through `MetaRow`; don't coin a sixth.
- **Progress bar** (`.budget-bar` / `.teaching-progress`) — a 5–6px track with an
  accent fill, `--gain` when complete, `--loss` when over. For any part-of-whole.
- **Expandable card** (`.project-card`) — collapsed shows title + a few metadata
  marks + reveal-on-hover actions; expanded reveals a detail body with
  `.project-section` field groups. Projects, grants, advisees, and trips all share
  this exact shell. New "object with details" entities should too.
- **Meta-when** — the trailing "Mon 5 · 2d" date stamp on a row: muted, 11.5px,
  `tabular-nums`, `nowrap`, `flex-shrink:0`; overdue→danger, soon→accent. Five
  class names (`.meta-row-when`, `grant-due`, `service-due`, `reminder-time`,
  `trip-range`) share **one base definition + two urgency groups** (the "Meta-when"
  block in `styles.css`). New dated panels reuse these hooks rather than coin a
  sixth. Because the stamp is `nowrap`, pair it with a wrappable title inside a
  single flex-wrap row (in `.meta-row`: title `flex:1 1 auto; min-width:9ch`,
  stamp `flex-shrink:0`) so the two sit side by side when there's room and the
  stamp drops to its own line when the row is narrow — never let a fixed stamp
  squeeze the title to a one-char sliver.
- **Reveal-on-hover affordance** — destructive/secondary controls (`.btn-delete`,
  `.btn-edit`) sit at `opacity:0` (or 0.5 on dense rows) and surface on row hover.
  The resting row stays quiet; tools appear when you reach for them. **A phone has
  no hover**, so these would be invisible and unreachable on touch — the mobile
  block forces them back to `opacity:1`. Hover-to-reveal is a desktop garnish, never
  the only way to reach an action.

---

## 4. Adding items — ONE doorway per panel

There are exactly two add-doorways, chosen by how heavy the item is. Every panel
already follows this; keep it that way.

- **Light items** (a line of text, maybe a date) → an **always-visible add row**
  (`.todo-input-row`): input + `+`. One line, low chrome. (Reminders, shopping,
  habits, packing, wishlist, savings, grant heads do this — keep it.)
- **Structured items** (3+ fields) → a **collapsed `+` toggle** that reveals
  the form (`.academic-form`) only when adding, then closes again. Deadlines,
  Teaching, Service, Trips, Loans, Grants, Advisees, Timetable, Submissions,
  Proposals, CFP, Reviews, Letters, Bills, Reimbursements, Investments,
  Contacts, Documents all do this. It is the correct default for heavy panels.
- **Never leave a multi-field form permanently open** at the top of a panel. A
  panel's resting state must show *data* (or, when empty, a one-line
  `.panel-empty` hint) — never an empty form. This was once the board's biggest
  source of visual noise; it has been paid down, so any new panel that reopens it
  is a regression, not a style choice.

Both doorways wear the **same 24px square `+` icon** so every panel's add
affordance reads identically — the difference is behaviour, not appearance. The
toggle form's button (`.academic-add-btn`) flips its glyph to `×` while the form
is open (a close affordance); the always-on light add uses `.btn-add-inline`.
Never spell the action out as text (`+ Add`, `Add item`): the `+` is the doorway
everywhere. Don't mix the two doorways within one panel.

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

A `prefers-reduced-motion: reduce` block at the end of `styles.css` collapses all
animation and transition durations to ~0 for users who ask the OS to reduce
motion. Don't fight it with inline-styled or JS-driven animation that bypasses
CSS transitions — route motion through CSS so this switch keeps covering it.

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
8. Will it collapse cleanly to one column on a phone? No fixed multi-column
   layout, no horizontal scroll, no list that traps a nested scroll — see §8.
9. Did you check **every state**, not just the resting one? A row has at least a
   *display*, an *edit*, and an *add* viewpoint (sometimes *empty* and *done* too),
   and each is a different DOM with a different width budget. The edit/add form is
   the usual culprit: a select + input + date picker + buttons that reads fine
   inline on desktop is a guaranteed overflow on a narrow card — stack it (§8).

---

## 8. Small screens

The board is a multi-column desktop instrument, but it ships as a phone app too
(the iOS target is a `WKWebView` rendering these exact files). On a phone none of
the desktop column math survives — two columns at 390px are two cramped strips —
and the forward-looking philosophy gives the answer: on a small screen you attend
to **one panel at a time, top to bottom**. So the small-screen language is
deliberately tiny: *one column, generously sized, scrolled as a single page.*

**There is exactly one breakpoint, and it lives in one place** — the
"Small screens" block near the end of `styles.css`. Do not scatter per-tab
`@media` rules through the file; every tab reflows through this one rule so the
behaviour is identical whether you're on Academic's grid, Finance's flex columns,
or Research's anchored sub-columns. This single block is also what the iOS app
renders, so "the mobile design" is not a second codebase — it is these rules.

**Below 900px the whole desktop layout gives way at once** — both the
multi-column panels *and* the horizontal top chrome (the six-tab bar plus its
right-aligned search). They share the breakpoint on purpose: the width at which
two columns stop fitting is the same width at which the tab bar stops fitting, so
an earlier attempt that split them into two tiers (panels at 980, chrome at 600)
only opened a dead zone in between where the columns had collapsed but the tab
bar still ran off the screen. One number, no dead zone.

The mobile layout keeps two promises, both verified:

- **One column.** Every layout collapses to a single column — Academic's 2-col
  grid becomes `1fr`, the flex tabs (Household, Health, Finance, Travel) go
  `flex-direction: column` *with `align-items: stretch`* so the stacked columns
  fill the width (without `stretch` the inherited `flex-start` shrinks each panel
  to its content), and Research's sub-columns stack. One panel per row, in source
  order. The two-column *balance caps* (lists that scroll inside their panel so
  one tall column doesn't tower over its neighbour) are **released** — with no
  neighbour to balance, a capped list would only trap a nested scroll, so the
  list grows and the whole page scrolls as one.

- **90% of the viewport.** The app gets `5vw` side gutters, so every panel spans
  exactly `90vw` with an even margin either side. The chrome goes compact to
  match: the header stacks and left-aligns both halves (the right half stretches
  to full width so the serif greeting *wraps* instead of overflowing, and its
  date/stats — normally right-aligned — left-align so they don't float oddly once
  stacked); the greeting and the clock/date step down so the time stops rivalling
  the greeting.

**The tab bar is iconographic everywhere; on a phone it moves to the bottom.**
Each tab leads with a minimal `currentColor` line icon (inline SVG — never emoji
or an icon font, so the board stays monochrome-with-accent and fully offline)
that accent-tints when active, matching the status/identity color rules. On
desktop the bar is sticky at the *top* under the greeting, icon **+ label**, with
search on its right. On a phone the bar becomes a **fixed bottom bar** — six
evenly-spread, icon-only buttons (active = the tinted icon, no border), always on
screen so navigation never scrolls away (an earlier sticky-top attempt let the
icons scroll off while only the search stayed pinned — the bottom bar removes the
whole class of bug). The page reserves bottom padding (plus
`env(safe-area-inset-bottom)`) so nothing hides behind it.

Two non-obvious rules keep that bottom bar honest, both learned the hard way:
the mobile bar uses an **opaque** background (`--surface`), *not* the frosted
`backdrop-filter` the desktop sticky bar uses — `backdrop-filter` on a
`position: fixed` element is an iOS WebKit bug that detaches it so it scrolls with
the page. And `overscroll-behavior-y: none` on `html, body` stops a rubber-band
bounce from dragging the fixed bar with it. Relatedly, the Projects panel's
two-column card grid (`.projects-list`) is forced to **one column** on mobile:
two `260px`-min tracks can't fit a single ~90vw panel, so on a phone the cards
would otherwise squeeze and spill. Any panel with an internal multi-column grid
must do the same.

**The single-column promise has a second, sneakier failure mode: a panel that is
itself wider than the column.** Academic is the one tab whose panels live in a CSS
*grid* (the others are flex), and a grid item defaults to `min-width: auto` — it
*refuses to shrink below its content's intrinsic width*. So a long deadline or
course title sized the `1fr` track to the title's width (~640px) and every panel
on the tab inherited that track, blowing the whole page past `90vw`. The fix is
`min-width: 0` on the grid child (`.panels-academic > .panel`), which lets the
track collapse back to the viewport. Inside a panel the same rule applies to flex
rows: a row that pairs a flexible label with a fixed-size trailing control (e.g.
Teaching's course pill + done/percent count) must let the label **shrink or wrap**
— give it `min-width: 0` / `overflow-wrap: anywhere`, or `flex-wrap: wrap` the row
— or the un-shrinkable label shoves the trailing control off the right edge. Long
free text from the user is the normal case here, not an edge case; design every
label that can hold a sentence to wrap.

**Everything else collapses into one right-hand drawer.** On a phone there is no
inline search, no FABs, no footer toolbar; a single hamburger pins to the header's
top-right and opens a drawer that **slides in from the right** over a dimmed,
scroll-locked board. The drawer holds search, the data actions (Export, Import,
Calendar, Undo, Gist, Name, Sync Now) and Help / Tweaks. Those actions are
declared once in `app.jsx` and rendered in both the desktop footer and the drawer,
so the two never drift. The drawer, overlay and hamburger exist at every size but
only surface on mobile (the hamburger is `display:none` on desktop, so the drawer
simply rests off-screen) — and because a media query adds no specificity, their
base rules sit *before* the Small-screens block so its `display:` overrides win on
source order. Desktop keeps its familiar chrome: top search, the matched help `?`
/ Tweaks `⚙` launcher pair (bottom-right), and the footer pill bar. The
attribution credits are in normal flow at the foot of the page at every size
(they used to be `position:fixed` and collided with the bottom-right launchers).

**Expanded cards reflow row-by-row, not just panel-by-panel.** Collapsing the
*panels* to one column is only half the job — the detail rows *inside* an
expanded card (a grant's budget heads, a savings/loan figure row, a trip's
start→end date pickers) pair a flexible text label with one or more *fixed-width*
controls (money inputs, date pickers). On a desktop half-panel they read as a
tidy single line; at 90vw the controls refuse to shrink and crush the label to a
**one-character-per-line vertical sliver** ("Travel" stacked `T·r·a·v·e·l`). The
rule: any such row **stacks on mobile** — the label takes its own line and the
controls drop to the next, *flexing* (`flex:1; width:auto; min-width:0`) to share
the width rather than holding a fixed px. Paired pickers stack outright (the `→`
turns to point down). And when a row of small buttons can wrap, group them
(`.chore-actions`) and pin the group right so a lone button never orphans onto a
line by itself. The same principle as the title/stamp reflow in §3 — *use more
vertical lines; never let a fixed-width sibling win a width fight against text.*

**Inline editors are the sharpest case, and they always stack.** Tapping edit on a
row swaps it for a form — a select + text input + date picker + Save/Cancel. Laid
out as a flex row those overflow even a desktop half-panel, let alone 90vw, so the
editor is **never** a row: it's a full-width stacked column (`.row-edit` /
`.service-card-edit` — `flex-direction: column`, fields `width:100%`, actions
right-aligned beneath), at *every* viewport, not behind a media query. A sibling
checkbox can stay to its left (the editor fills the rest via `flex:1`); everything
else — chip, the row's own edit/delete — belongs to the *display* branch and
should not render while editing. New panels with inline edit reuse `.row-edit`.

When you add a panel or a tab, you get all of this for free **as long as** you
build on the standard layout containers (`.panels-*`, `.panels-col`) and the
shared patterns — nothing in a panel should set its own width, a fixed column
count, or its own breakpoint. If a new element overflows `90vw` on a phone (a
wide table, a long unbroken token, a fixed-width control, a nowrap flex row of
buttons), that is the bug to fix; the single-column 90% promise is not negotiable
real estate. The quick test: at 390px viewport, `document.documentElement`'s
`scrollWidth` must equal its `clientWidth` (no horizontal scroll) on every tab —
**with every expandable card opened**, since the worst overflow hides inside the
detail rows, not the collapsed summary.
