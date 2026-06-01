// app.jsx — Main App component for Whiteboard personal dashboard
// Must be the LAST script loaded. No imports/exports — plain script tag.

const { useState, useEffect, useMemo, useRef, useCallback } = React;
const {
  loadLocal, saveLocal, getProfileName, setProfileName,
  getIntroSeen, setIntroSeen,
  getSyncConfig, setSyncConfig, hasSyncConfig,
  fetchRemote, createRemote, pushRemote, debounce,
  normalizeState,
  MS,
} = window.WhiteboardStore;

// Returns true if `a` and `b` differ only in string-valued leaves (i.e. a pure
// text edit). Structural changes — array length, booleans, numbers — return
// false, so the undo toast only fires on discrete actions, not on typing.
function isTextOnlyChange(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => isTextOnlyChange(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (k === "meta") continue;
      if (!isTextOnlyChange(a[k], b[k])) return false;
    }
    return true;
  }
  // Differing leaves: a text change only if both sides are strings.
  return typeof a === "string" && typeof b === "string";
}

// ─── Categories ───

const CATEGORIES = [
  { id: "academic", label: "Academic", accent: "oklch(0.62 0.115 250)", soft: "oklch(0.62 0.115 250 / 0.13)" },
  { id: "research", label: "Research", accent: "oklch(0.58 0.13 275)", soft: "oklch(0.58 0.13 275 / 0.13)" },
  { id: "household", label: "Household", accent: "oklch(0.62 0.095 158)", soft: "oklch(0.62 0.095 158 / 0.13)" },
  { id: "health", label: "Health", accent: "oklch(0.64 0.13 38)", soft: "oklch(0.64 0.13 38 / 0.13)" },
  { id: "finance", label: "Finance", accent: "oklch(0.62 0.10 195)", soft: "oklch(0.62 0.10 195 / 0.13)" },
  { id: "travel", label: "Travel", accent: "oklch(0.62 0.15 300)", soft: "oklch(0.62 0.15 300 / 0.13)" },
];

// ─── Dated items: one registry, used by both the banners and the stats ───
//
// Every panel that carries a date is described once here so the upcoming-item
// banners and the at-a-glance stats can never drift apart (or silently omit a
// panel, as finance once did). Each source says where to read its list, which
// field is the date, what to skip (done/received), and how to label it.

const DATE_SOURCES = [
  { cat: "academic", kind: "Deadline", list: (s) => s.academic.deadlines, date: (i) => i.due, skip: (i) => i.done, text: (i) => i.title || i.text },
  { cat: "academic", kind: "Service", list: (s) => s.academic.service, date: (i) => i.due, text: (i) => i.title || i.text },
  { cat: "research", kind: "Meeting", list: (s) => s.research.students, date: (i) => i.nextMeeting, text: (i) => `${i.name} meeting` },
  { cat: "research", kind: "Milestone", list: (s) => s.research.students, date: (i) => window.soonestMilestone(i), text: (i) => `${i.name} milestone` },
  { cat: "research", kind: "Submission", list: (s) => s.research.submissions, date: (i) => i.decisionDue, skip: (i) => i.stage === "accepted" || i.stage === "camera ready" || i.stage === "published" || i.stage === "rejected", text: (i) => window.submissionBannerText ? window.submissionBannerText(i) : `${i.title} decision` },
  { cat: "research", kind: "Proposal", list: (s) => s.research.proposals, date: (i) => i.callDeadline, skip: (i) => i.status === "awarded" || i.status === "declined", text: (i) => `${i.title} call` },
  { cat: "research", kind: "CFP", list: (s) => s.research.cfps, date: (i) => window.nextCfpDeadline(i), text: (i) => i.name },
  { cat: "research", kind: "Review", list: (s) => s.research.reviews, date: (i) => i.due, skip: (i) => i.done, text: (i) => `Review ${i.venue}` },
  { cat: "research", kind: "Letter", list: (s) => s.research.letters, date: (i) => i.due, skip: (i) => i.done, text: (i) => `Letter for ${i.student}` },
  { cat: "household", kind: "Reminder", list: (s) => s.household.reminders, date: (i) => i.when, skip: (i) => i.done, text: (i) => i.text },
  { cat: "health", kind: "Reminder", list: (s) => s.health.reminders, date: (i) => i.when, skip: (i) => i.done, text: (i) => i.text },
  { cat: "finance", kind: "Bill", list: (s) => s.finance.bills, date: (i) => i.due, text: (i) => i.name },
  { cat: "finance", kind: "Claim", list: (s) => s.finance.reimbursements, date: (i) => i.due, skip: (i) => i.status === "received", text: (i) => i.title },
  { cat: "finance", kind: "Loan", list: (s) => s.finance.loans, date: (i) => i.due, text: (i) => `${i.name} payment` },
  { cat: "finance", kind: "Grant", list: (s) => s.finance.grants, date: (i) => i.expiry, text: (i) => `${i.title} ends` },
  { cat: "travel", kind: "Trip", list: (s) => s.travel.trips, date: (i) => i.start, text: (i) => i.destination },
  { cat: "travel", kind: "Document", list: (s) => s.travel.documents, date: (i) => i.expiry, text: (i) => `${i.label ? `${i.kind} (${i.label})` : i.kind} expires` },
];

// ─── Searchable items: one registry, like DATE_SOURCES ───
//
// Every searchable list is described once here so search can't silently omit a
// panel (the same drift DATE_SOURCES prevents for banners/stats). `hay` is the
// lowercased-on-match haystack; `text` is the label shown in results; the id is
// read from `item.id`. Nested cases (grant budget heads, per-tab goals) are
// handled separately below because they don't map one row → one result.

const SEARCH_SOURCES = [
  { cat: "academic", type: "Deadline",  list: (s) => s.academic.deadlines, hay: (i) => i.title || i.text || "", text: (i) => i.title || i.text },
  { cat: "academic", type: "Teaching",  list: (s) => s.academic.teaching,  hay: (i) => i.title || "", text: (i) => i.title || i.text },
  { cat: "academic", type: "Service",   list: (s) => s.academic.service,   hay: (i) => i.title || "", text: (i) => i.title || i.text },
  { cat: "academic", type: "Reading",   list: (s) => s.academic.readings,  hay: (i) => i.text || i.title || "", text: (i) => i.text || i.title },
  { cat: "academic", type: "Timetable", list: (s) => s.academic.timetable, hay: (i) => `${i.title || ""} ${i.location || ""}`, text: (i) => i.title },
  { cat: "research", type: "Project",    list: (s) => s.research.projects,    hay: (i) => i.name || "", text: (i) => i.name },
  { cat: "research", type: "Advisee",    list: (s) => s.research.students,    hay: (i) => `${i.name || ""} ${i.topic || ""} ${i.program || ""}`, text: (i) => i.name },
  { cat: "research", type: "Submission", list: (s) => s.research.submissions, hay: (i) => `${i.title || ""} ${i.venue || ""}`, text: (i) => i.title },
  { cat: "research", type: "Proposal",   list: (s) => s.research.proposals,   hay: (i) => `${i.title || ""} ${i.agency || ""}`, text: (i) => i.title },
  { cat: "research", type: "CFP",        list: (s) => s.research.cfps,        hay: (i) => i.name || "", text: (i) => i.name },
  { cat: "research", type: "Review",     list: (s) => s.research.reviews,     hay: (i) => `${i.venue || ""} ${i.paper || ""}`, text: (i) => i.venue },
  { cat: "research", type: "Letter",     list: (s) => s.research.letters,     hay: (i) => `${i.student || ""} ${i.purpose || ""}`, text: (i) => i.student },
  { cat: "research", type: "Contact",    list: (s) => s.research.contacts,    hay: (i) => `${i.name || ""} ${i.affiliation || ""} ${i.email || ""}`, text: (i) => i.name },
  { cat: "household", type: "Chore",     list: (s) => s.household.chores,    hay: (i) => i.text || "", text: (i) => i.text },
  { cat: "household", type: "Reminder",  list: (s) => s.household.reminders, hay: (i) => i.text || "", text: (i) => i.text },
  { cat: "household", type: "Shopping",  list: (s) => s.household.shopping,  hay: (i) => i.text || "", text: (i) => i.text },
  { cat: "health", type: "Habit",        list: (s) => s.health.habits,    hay: (i) => i.text || "", text: (i) => i.text },
  { cat: "health", type: "Reminder",     list: (s) => s.health.reminders, hay: (i) => i.text || "", text: (i) => i.text },
  { cat: "finance", type: "Grant",       list: (s) => s.finance.grants,         hay: (i) => i.title || "", text: (i) => i.title },
  { cat: "finance", type: "Bill",        list: (s) => s.finance.bills,          hay: (i) => i.name || "", text: (i) => i.name },
  { cat: "finance", type: "Claim",       list: (s) => s.finance.reimbursements, hay: (i) => `${i.title || ""} ${i.party || ""}`, text: (i) => i.title },
  { cat: "finance", type: "Loan",        list: (s) => s.finance.loans,          hay: (i) => `${i.name || ""} ${i.lender || ""}`, text: (i) => i.name },
  { cat: "finance", type: "Savings",     list: (s) => s.finance.savings,        hay: (i) => i.name || "", text: (i) => i.name },
  { cat: "finance", type: "Investment",  list: (s) => s.finance.investments,    hay: (i) => i.name || "", text: (i) => i.name },
  { cat: "travel", type: "Trip",     list: (s) => s.travel.trips,     hay: (i) => i.destination || "", text: (i) => i.destination },
  { cat: "travel", type: "Packing",  list: (s) => s.travel.packing,   hay: (i) => i.text || "", text: (i) => i.text },
  { cat: "travel", type: "Wishlist", list: (s) => s.travel.wishlist,  hay: (i) => `${i.text || ""} ${i.note || ""}`, text: (i) => i.text },
  { cat: "travel", type: "Document", list: (s) => s.travel.documents, hay: (i) => `${i.kind || ""} ${i.label || ""} ${i.number || ""}`, text: (i) => (i.label ? `${i.kind} · ${i.label}` : i.kind) },
];

// Walk every dated item across the board, normalizing its date (epoch ms, ISO
// date string, or datetime-local string) to a timestamp before calling `fn`.
function eachDatedItem(state, fn) {
  for (const src of DATE_SOURCES) {
    for (const item of src.list(state) || []) {
      if (src.skip && src.skip(item)) continue;
      const raw = src.date(item);
      if (raw == null || raw === "") continue;
      const ts = typeof raw === "number" ? raw : new Date(raw).getTime();
      if (Number.isNaN(ts)) continue;
      fn({ ts, cat: src.cat, kind: src.kind, text: src.text(item) });
    }
  }
}

// ─── Collect upcoming items ───

function collectUpcomingPair(state) {
  // Return both the soonest future item (`nextUp`) and the most recent
  // overdue item (`nearestOverdue`). Items follow the shape { text, cat, kind, ts }.
  const candidates = [];
  eachDatedItem(state, (item) => candidates.push(item));

  if (!candidates.length) return { nextUp: null, nearestOverdue: null };
  const now = Date.now();
  const future = candidates.filter((c) => c.ts > now);
  const overdue = candidates.filter((c) => c.ts <= now);

  const nextUp = future.length ? future.reduce((a, b) => (b.ts < a.ts ? b : a)) : null;
  const nearestOverdue = overdue.length ? overdue.reduce((a, b) => (b.ts > a.ts ? b : a)) : null;
  return { nextUp, nearestOverdue };
}

// ─── Format upcoming time ───

function formatNextWhen(ts) {
  if (!ts) return "";
  const diff = ts - Date.now();
  if (diff < 0) return "overdue";
  if (diff < MS.MINUTE) return "now";
  // relTime (from components.jsx) gives "5m" / "3h" / "2d"; prefix with "in ".
  return `in ${window.relTime(diff)}`;
}

// "synced 0 seconds ago" / "synced 5 minutes ago" — full words, takes `now` so
// it re-renders on the clock tick. Returns "" when there's been no sync yet.
function syncedAgoLabel(ts, now) {
  if (!ts) return "";
  const diff = Math.max(0, now - ts);
  const unit = (n, word) => `synced ${n} ${word}${n === 1 ? "" : "s"} ago`;
  if (diff < MS.MINUTE) return unit(Math.floor(diff / MS.SECOND), "second");
  if (diff < MS.HOUR)   return unit(Math.floor(diff / MS.MINUTE), "minute");
  if (diff < MS.DAY)    return unit(Math.floor(diff / MS.HOUR), "hour");
  return unit(Math.floor(diff / MS.DAY), "day");
}

// ─── Greeting ───
//
// One greeting per hour of the day (index = 0–23), so the header line shifts
// with the clock through the night, morning, afternoon and evening rather than
// sitting on four broad buckets.

const HOURLY_GREETINGS = [
  "Burning the midnight oil",   // 12 AM
  "Still up",                   //  1 AM
  "The quiet hours",            //  2 AM
  "Deep in the night",          //  3 AM
  "Up before the birds",        //  4 AM
  "Dawn is breaking",           //  5 AM
  "Rise and shine",             //  6 AM
  "Good morning",               //  7 AM
  "Morning",                    //  8 AM
  "Hope your morning's going well", //  9 AM
  "Mid-morning momentum",       // 10 AM
  "Almost noon",                // 11 AM
  "Good afternoon",             // 12 PM
  "Hope you've had lunch",      //  1 PM
  "Good afternoon",             //  2 PM
  "Afternoon stretch",          //  3 PM
  "Easing through the afternoon", //  4 PM
  "Good evening",               //  5 PM
  "Evening's here",             //  6 PM
  "Hope you had a good day",    //  7 PM
  "Winding down for the day",   //  8 PM
  "A calm evening to you",      //  9 PM
  "Good night",                 // 10 PM
  "Time to rest soon",          // 11 PM
];

function greetingFor(date) {
  return HOURLY_GREETINGS[date.getHours()] || "Hello";
}

// ─── Clock component ───

function Clock({ now }) {
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, "0");
  const meridiem = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return (
    <div className="clock">
      <span className="clock-time">
        {h12}:{m}<span className="clock-meridiem">{meridiem}</span>
      </span>
    </div>
  );
}

// ─── At-a-glance stats ───

function computeStats(state, now) {
  const t = now.getTime();
  let overdue = 0;
  let week = 0;
  eachDatedItem(state, ({ ts }) => {
    if (ts < t) overdue++;
    else if (ts - t < MS.WEEK) week++;
  });
  return { overdue, week };
}

// ─── SetupModal ───

function SetupModal({ initialConfig, onClose, onDone, onDisconnect }) {
  const [token, setToken] = useState(initialConfig?.token || "");
  const [gistId, setGistId] = useState(initialConfig?.gistId || "");
  const [filename, setFilename] = useState(initialConfig?.filename || "whiteboard.json");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!token.trim()) { setError("Token is required"); return; }
    setError("");
    onDone({ token: token.trim(), gistId: gistId.trim(), filename: filename.trim() || "whiteboard.json" });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">Setup GitHub Gist Sync</div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label>
              GitHub Personal Access Token
              <span className="help-hint" tabIndex={0} role="button" aria-label="How to obtain a GitHub token">
                ?
                <span className="help-tooltip">
                  <strong>How to get a token:</strong>
                  <ol>
                    <li>Go to GitHub → Settings → Developer settings.</li>
                    <li>Open “Personal access tokens” → “Fine-grained tokens” (or “Tokens (classic)”).</li>
                    <li>Click “Generate new token” and give it a name + expiry.</li>
                    <li>Grant <strong>Gist</strong> access: classic tokens need the <code>gist</code> scope; fine-grained tokens need Account permissions → Gists → Read and write.</li>
                    <li>Generate, then copy the token and paste it here.</li>
                  </ol>
                  The token is stored only in your browser.
                </span>
              </span>
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="GitHub token"
              className="modal-input"
            />
          </div>
          <div className="modal-field">
            <label>
              Gist ID
              <span className="help-hint" tabIndex={0} role="button" aria-label="How to sync across devices">
                ?
                <span className="help-tooltip">
                  <strong>Sync across devices:</strong> leave this blank on the
                  first device to create a new private gist. On every other
                  device, paste the <strong>same Gist ID</strong> here so they
                  share one gist. The ID is the long code in the gist URL
                  (<code>gist.github.com/&lt;user&gt;/<strong>&lt;id&gt;</strong></code>).
                  Leaving it blank again creates a separate, duplicate gist.
                </span>
              </span>
            </label>
            <input
              value={gistId}
              onChange={(e) => setGistId(e.target.value)}
              placeholder="Leave blank to create a private Gist"
              className="modal-input"
            />
            {initialConfig?.gistId && (
              <a
                className="modal-gist-link"
                href={`https://gist.github.com/${initialConfig.gistId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open this gist ↗ — copy its ID to use on other devices
              </a>
            )}
          </div>
          <div className="modal-field">
            <label>Filename</label>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="whiteboard.json"
              className="modal-input"
            />
          </div>
          <div className="modal-security-note">
            Your token is stored in localStorage and sent directly to GitHub's API. It never touches any third-party server.
          </div>
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            {initialConfig?.token && (
              <button type="button" className="modal-btn modal-btn-cancel" onClick={onDisconnect}>Disconnect</button>
            )}
            <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="modal-btn modal-btn-primary">Save & sync</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── NameModal ───

function NameModal({ onClose, onDone }) {
  const [name, setName] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) onDone(name.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">Welcome to Whiteboard</div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label>What should we call you?</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="modal-input"
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>Skip</button>
            <button type="submit" className="modal-btn modal-btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── WelcomeModal ───
//
// The first-run introduction. Also reachable any time from the floating help
// (?) button next to the settings gear, so it doubles as the "what is this"
// reference. `firstRun` switches the copy/button between an introduction and a
// plain help sheet.

function WelcomeModal({ firstRun, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-welcome" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          {firstRun ? "Welcome to Whiteboard" : "About Whiteboard"}
        </div>

        <p className="welcome-lede">
          Whiteboard is your private, local-first dashboard for the things you’re
          keeping track of — work, home, health, money and travel — all in one
          place. Everything lives in this browser; nothing is sent anywhere
          unless you turn on sync.
        </p>

        <div className="welcome-section-label">Your six tabs</div>
        <ul className="welcome-tabs">
          {CATEGORIES.map((c, i) => (
            <li key={c.id} className="welcome-tab" style={{ "--cat": c.accent }}>
              <span className="welcome-tab-key">{i + 1}</span>
              <span className="welcome-tab-name">{c.label}</span>
              <span className="welcome-tab-desc">{CATEGORY_BLURBS[c.id]}</span>
            </li>
          ))}
        </ul>

        <div className="welcome-section-label">Good to know</div>
        <ul className="welcome-points">
          <li>
            The banners up top always surface what’s <strong>overdue</strong> and
            what’s <strong>next up</strong> across every tab.
          </li>
          <li>
            Press <kbd>1</kbd>–<kbd>6</kbd> to switch tabs, <kbd>⌘F</kbd> to
            search, <kbd>⌘Z</kbd> to undo, and <kbd>⌘⇧T</kbd> for appearance
            tweaks (or use the <span className="welcome-gear">⚙</span> button).
          </li>
          <li>
            Whiteboard is built around <strong>what’s in front of you now</strong> —
            it surfaces the next thing due rather than burying you in everything at
            once. Use the <strong>Calendar</strong> button to export upcoming dates
            as an <code>.ics</code> file for your calendar app.
          </li>
          <li>
            Use <strong>Gist</strong> in the bottom bar to optionally sync across
            devices through a private GitHub gist — your data and token stay in
            your browser.
          </li>
          <li>
            Reopen this guide any time from the <strong>?</strong> button in the
            corner.
          </li>
        </ul>

        <div className="welcome-credits">
          Concept by <a href="https://drdebmath.github.io" target="_blank" rel="noopener noreferrer">Dr. Debasish Pattanayak</a> · Designed by Claude
        </div>

        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn-primary" onClick={onClose}>
            {firstRun ? "Get started" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Short, friendly per-tab descriptions used in the welcome guide.
const CATEGORY_BLURBS = {
  academic: "Deadlines, teaching, timetable, service, readings.",
  research: "Projects, advisees, submissions, proposals, calls, reviews.",
  household: "Chores, shopping lists and reminders.",
  health: "Habits to keep and health reminders.",
  finance: "Grants, bills, loans, savings and investments.",
  travel: "Trips, packing, documents and a wishlist.",
};

// ─── useTweaks defaults ───

const TWEAK_DEFAULTS = {
  __key: "whiteboard",
  density: "default",
  themeMode: "time", // "time" | "system" | "light" | "dark"
  darkMode: false,   // legacy — read only as a migration fallback
  autoTheme: true,   // legacy — read only as a migration fallback
  font: "system",
  hue: 268,
  fontSize: 13,
  panelRadius: 14,
  panelOpacity: 82,
  sidebarWidth: 260,
  currency: "₹",
};

// ─── Main App ───

function App() {
  const [state, setState] = useState(() => loadLocal());
  const [tab, setTab] = useState("academic");
  const [now, setNow] = useState(new Date());
  const [profileName, setProfileNameState] = useState(() => getProfileName() || "");
  const [syncConfig, setSyncConfigState] = useState(() => getSyncConfig());
  const [syncStatus, setSyncStatus] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUndo, setShowUndo] = useState(false);

  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [showSetup, setShowSetup] = useState(false);
  // First-run intro shows before anything else; the name prompt waits until the
  // intro is dismissed so the two modals never stack. `showHelp` reopens the
  // same guide later from the help (?) button.
  const [showIntro, setShowIntro] = useState(() => !getIntroSeen());
  const [showHelp, setShowHelp] = useState(false);
  const [showName, setShowName] = useState(() => getIntroSeen() && !profileName);

  const fileInputRef = useRef(null);
  const searchRef = useRef(null);
  const undoStackRef = useRef([]);
  const undoTimerRef = useRef(null);
  const hasLoadedRemoteRef = useRef(false);
  const stateRef = useRef(state);
  const [storageError, setStorageError] = useState("");
  // Tracks the OS dark-mode preference, kept live so the "System" theme mode
  // follows the user's setting without a reload.
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  // ─── Clock effect ───

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { stateRef.current = state; }, [state]);

  // ─── System theme preference ───
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Keep every in-app form as a React-only interaction. A native submit falls
  // back to navigating to the current page, which looks exactly like a reload.
  useEffect(() => {
    const preventNativeSubmit = (e) => e.preventDefault();
    document.addEventListener("submit", preventNativeSubmit, true);
    return () => document.removeEventListener("submit", preventNativeSubmit, true);
  }, []);

  // ─── Density class ───

  useEffect(() => {
    document.documentElement.dataset.density = tweaks.density || "default";
  }, [tweaks.density]);

  // ─── Font class ───

  useEffect(() => {
    document.documentElement.dataset.font = tweaks.font || "system";
  }, [tweaks.font]);

  // ─── Dark mode ───
  // Theme has four modes: "time" follows the clock (light through the day, dark
  // evening/early morning), "system" follows the OS preference, and "light" /
  // "dark" are fixed. Older boards stored autoTheme/darkMode booleans; fall back
  // to those so the setting migrates without a reset.
  const themeMode = tweaks.themeMode
    || (tweaks.autoTheme ? "time" : (tweaks.darkMode ? "dark" : "light"));

  // Resolve the effective theme once. Everything that reacts to dark/light reads this.
  const isDark =
    themeMode === "time" ? (now.getHours() < 7 || now.getHours() >= 19)
    : themeMode === "system" ? systemDark
    : themeMode === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // ─── Hue tweaks ───

  useEffect(() => {
    document.documentElement.style.setProperty("--hue", tweaks.hue);
    document.documentElement.style.setProperty("--accent", `hsl(${tweaks.hue}, 48%, 56%)`);
    document.documentElement.style.setProperty("--accent-soft", `hsla(${tweaks.hue}, 48%, 56%, 0.14)`);
  }, [tweaks.hue]);

  // ─── Panel surface tweaks ───

  useEffect(() => {
    const s = document.documentElement.style;
    const alpha = (tweaks.panelOpacity || 82) / 100;
    const panelBg = isDark
      ? `rgba(22, 22, 30, ${alpha})`
      : `rgba(255, 255, 255, ${alpha})`;
    s.setProperty("--panel-bg", panelBg);
    s.setProperty("--panel-radius", `${tweaks.panelRadius || 14}px`);
    s.setProperty("--sidebar-width", `${tweaks.sidebarWidth || 260}px`);
    s.setProperty("--font-size-base", `${tweaks.fontSize || 13}px`);
  }, [isDark, tweaks.panelOpacity, tweaks.panelRadius, tweaks.sidebarWidth, tweaks.fontSize]);

  // ─── Initial remote sync ───

  useEffect(() => {
    if (!hasSyncConfig(syncConfig)) {
      hasLoadedRemoteRef.current = false;
      return;
    }
    let cancelled = false;
    setSyncStatus("Syncing…");
    fetchRemote(syncConfig)
      .then(async (remoteState) => {
        if (cancelled) return;
        const localNow = stateRef.current;
        if (remoteState && remoteState.academic) {
          // Resolve by last-modified time rather than "did local change since
          // load", so a stale local copy can't clobber newer remote data.
          const remoteAt = remoteState.meta?.updatedAt || 0;
          const localAt = localNow.meta?.updatedAt || 0;
          if (remoteAt > localAt) {
            setState(remoteState);
          } else if (localAt > remoteAt) {
            await pushRemote(syncConfig, localNow);
          }
          // Equal timestamps: already in sync, nothing to do.
        } else {
          await pushRemote(syncConfig, localNow);
        }
        if (!cancelled) {
          setLastSyncedAt(Date.now());
          setSyncStatus("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Initial sync failed:", err);
          setSyncStatus("Sync failed");
          setTimeout(() => setSyncStatus(""), 3000);
        }
      })
      .finally(() => {
        if (!cancelled) hasLoadedRemoteRef.current = true;
      });
    return () => { cancelled = true; };
  }, [syncConfig]);

  // ─── Sync on state change ───

  useEffect(() => {
    const ok = saveLocal(state);
    if (!ok) {
      setStorageError("Could not save — browser storage may be full.");
      const t = setTimeout(() => setStorageError(""), 5000);
      return () => clearTimeout(t);
    }
    setStorageError("");
  }, [state]);

  const debouncedSync = useMemo(
    () => debounce(async (cfg, s) => {
      if (!hasSyncConfig(cfg)) return;
      try {
        setSyncStatus("Syncing…");
        await pushRemote(cfg, s);
        setLastSyncedAt(Date.now());
        setSyncStatus("");
      } catch (err) {
        console.error("Sync failed:", err);
        setSyncStatus("Sync failed");
        setTimeout(() => setSyncStatus(""), 3000);
      }
    }, 2000),
    []
  );

  useEffect(() => {
    if (hasSyncConfig(syncConfig) && hasLoadedRemoteRef.current) debouncedSync(syncConfig, state);
  }, [state, syncConfig, debouncedSync]);

  // ─── safeUpdate (push undo before state change) ───

  const safeUpdate = useCallback((updater) => {
    const prevState = stateRef.current;
    undoStackRef.current.push(structuredClone(prevState));
    if (undoStackRef.current.length > 10) undoStackRef.current.shift();
    const computed = typeof updater === "function" ? updater(prevState) : updater;
    // Stamp the modification time so sync can resolve which side is newer.
    setState({ ...computed, meta: { ...(computed.meta || {}), updatedAt: Date.now() } });
    // Surface the undo toast only for discrete actions (add/remove/toggle/date),
    // not character-by-character text edits.
    if (!isTextOnlyChange(prevState, computed)) {
      setShowUndo(true);
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setShowUndo(false), 4000);
    }
  }, []);

  // ─── updateSlice ───
  // Returns a setter that replaces one list (e.g. academic.deadlines) and routes
  // it through safeUpdate — so every panel's onChange is one call, not a repeated
  // nested-spread that's easy to get subtly wrong.
  const updateSlice = useCallback(
    (catKey, listKey) => (value) =>
      safeUpdate((prev) => ({ ...prev, [catKey]: { ...prev[catKey], [listKey]: value } })),
    [safeUpdate]
  );

  // ─── Undo ───

  const handleUndo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (prev) {
      setState(prev);
      setShowUndo(false);
    }
  }, []);

  // ─── Keyboard shortcuts ───

  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable;
      const key = e.key.toLowerCase();

      if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (!isInput) {
        if (e.key === "1") setTab("academic");
        if (e.key === "2") setTab("research");
        if (e.key === "3") setTab("household");
        if (e.key === "4") setTab("health");
        if (e.key === "5") setTab("finance");
        if (e.key === "6") setTab("travel");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo]);

  // ─── Search filtering ───

  const filteredResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;
    const results = [];

    // The bulk of search: one pass over the registry, one row → one result.
    for (const src of SEARCH_SOURCES) {
      for (const item of src.list(state) || []) {
        if (src.hay(item).toLowerCase().includes(q)) {
          results.push({ cat: src.cat, type: src.type, text: src.text(item), id: item.id });
        }
      }
    }

    // Nested / fan-out cases the row→result registry can't express:
    // a grant's budget heads each surface separately…
    for (const g of state.finance.grants) {
      for (const h of g.heads || []) {
        if ((h.name || "").toLowerCase().includes(q)) results.push({ cat: "finance", type: "Budget head", text: `${h.name} · ${g.title}`, id: g.id });
      }
    }
    // …and goals live on every tab under the same key.
    for (const cat of ["academic", "research", "household", "health", "finance", "travel"]) {
      for (const g of state[cat].goals || []) {
        const label = `${g.text || ""} ${g.note || ""}`;
        if (label.toLowerCase().includes(q)) results.push({ cat, type: "Goal", text: g.text, id: g.id });
      }
    }

    return results;
  }, [searchQuery, state]);

  const goToSearchResult = useCallback((r) => {
    setTab(r.cat);
    setSearchQuery("");
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-mb-id="${r.id}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("search-highlight");
      setTimeout(() => el.classList.remove("search-highlight"), 2000);
    });
  }, []);

  // ─── Sync actions ───

  const handleSync = useCallback(async () => {
    if (!hasSyncConfig(syncConfig)) return;
    setSyncStatus("Pushing…");
    try {
      await pushRemote(syncConfig, state);
      setLastSyncedAt(Date.now());
      setSyncStatus("");
    } catch (err) {
      console.error("Push failed:", err);
      setSyncStatus("Push failed");
      setTimeout(() => setSyncStatus(""), 3000);
    }
  }, [state, syncConfig]);

  // ─── Export ───

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  // ─── Calendar (.ics) export ───
  //
  // Every dated item across the board becomes an all-day VEVENT, so the same
  // dates the banners surface can be pulled into any calendar app.

  const handleIcsExport = useCallback(() => {
    const pad = (n) => String(n).padStart(2, "0");
    const dt = (ts) => {
      const d = new Date(ts);
      return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
    };
    const esc = (s) => String(s || "").replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Whiteboard//EN", "CALSCALE:GREGORIAN"];
    let i = 0;
    eachDatedItem(state, ({ ts, kind, text }) => {
      const day = dt(ts);
      const next = dt(ts + MS.DAY);
      lines.push(
        "BEGIN:VEVENT",
        `UID:whiteboard-${i++}-${ts}@whiteboard`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day}`,
        `DTEND;VALUE=DATE:${next}`,
        `SUMMARY:${esc(`[${kind}] ${text}`)}`,
        "END:VEVENT"
      );
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  // ─── Import ───

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const normalized = normalizeState(data);
        if (normalized) {
          safeUpdate(normalized);
        } else {
          alert("Invalid Whiteboard data format");
        }
      } catch {
        alert("Failed to parse file");
      }
    };
    reader.onerror = () => {
      alert("Failed to read file");
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [safeUpdate]);

  const triggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // ─── Setup done ───

  const handleSetupDone = useCallback(async (config) => {
    setShowSetup(false);
    setSyncStatus("Syncing…");
    try {
      const mergedConfig = { ...syncConfig, ...config };
      const connectingExisting = !!mergedConfig.gistId;
      const nextConfig = connectingExisting ? mergedConfig : await createRemote(state, mergedConfig);
      setSyncConfigState(nextConfig);
      setSyncConfig(nextConfig);
      hasLoadedRemoteRef.current = true;
      // If the filename changed on an existing gist, drop the old file too.
      const oldFilename = syncConfig.gistId === nextConfig.gistId ? syncConfig.filename : null;

      if (connectingExisting) {
        // Connecting to an existing gist: pull first and resolve by last-modified
        // time so a stale/empty local copy can't clobber newer remote data.
        const remoteState = await fetchRemote(nextConfig);
        const localNow = stateRef.current;
        if (remoteState && remoteState.academic) {
          const remoteAt = remoteState.meta?.updatedAt || 0;
          const localAt = localNow.meta?.updatedAt || 0;
          if (remoteAt > localAt) {
            setState(remoteState);
            // Rewrite under the new filename / drop the old file if it was renamed.
            if (oldFilename && oldFilename !== nextConfig.filename) {
              await pushRemote(nextConfig, remoteState, oldFilename);
            }
          } else {
            // Local is newer (or equal): keep local, push it up.
            await pushRemote(nextConfig, localNow, oldFilename);
          }
        } else {
          // Remote is empty or unreadable under this filename: safe to seed it.
          await pushRemote(nextConfig, localNow, oldFilename);
        }
      } else {
        // createRemote already wrote local state into the new gist.
      }
      setLastSyncedAt(Date.now());
      setSyncStatus("");
    } catch (err) {
      console.error("Setup sync failed:", err);
      setSyncStatus("Sync failed");
      setShowSetup(true);
    }
  }, [state, syncConfig]);

  const handleDisconnectSync = useCallback(() => {
    const emptyConfig = { token: "", gistId: "", filename: "whiteboard.json" };
    setSyncConfigState(emptyConfig);
    setSyncConfig(emptyConfig);
    hasLoadedRemoteRef.current = false;
    setSyncStatus("");
    setShowSetup(false);
  }, []);

  // ─── Name done ───

  const handleNameDone = useCallback((name) => {
    setProfileNameState(name);
    setProfileName(name);
    setShowName(false);
  }, []);

  // ─── Intro dismissed ───
  // Remember the intro was seen, then prompt for a name if we don't have one.

  const handleIntroClose = useCallback(() => {
    setShowIntro(false);
    setIntroSeen(true);
    setShowName((prev) => prev || !getProfileName());
  }, []);

  // ─── Render tab panels ───

  const renderPanels = (catId) => {
    const s = state[catId];

    switch (catId) {
      case "academic":
        return (
          <div className="panels panels-academic">
            <DeadlinesPanel items={s.deadlines} onChange={updateSlice("academic", "deadlines")} />
            <GoalsPanel
              items={s.goals || []}
              placeholder="e.g. publish a textbook…"
              onChange={updateSlice("academic", "goals")}
            />
            <TeachingPanel items={s.teaching} onChange={updateSlice("academic", "teaching")} />
            <TimetablePanel items={s.timetable || []} onChange={updateSlice("academic", "timetable")} />
            <ServicePanel items={s.service} onChange={updateSlice("academic", "service")} />
            <ReadingPanel items={s.readings || []} onChange={updateSlice("academic", "readings")} />
          </div>
        );

      case "research": {
        const cur = tweaks.currency || "₹";
        return (
          <div className="panels panels-research">
            <ProjectPanel items={s.projects || []} onChange={updateSlice("research", "projects")} />
            <div className="research-columns">
              <div className="panels-col">
                <AdviseesPanel items={s.students} onChange={updateSlice("research", "students")} />
                <SubmissionsPanel items={s.submissions} onChange={updateSlice("research", "submissions")} />
                <ProposalsPanel items={s.proposals} currency={cur} onChange={updateSlice("research", "proposals")} />
                <CFPPanel items={s.cfps} onChange={updateSlice("research", "cfps")} />
              </div>
              <div className="panels-col">
                <GoalsPanel
                  items={s.goals || []}
                  placeholder="e.g. land a major grant, graduate 3 PhDs…"
                  onChange={updateSlice("research", "goals")}
                />
                <ReviewsPanel items={s.reviews} onChange={updateSlice("research", "reviews")} />
                <LettersPanel items={s.letters} onChange={updateSlice("research", "letters")} />
                <ContactsPanel items={s.contacts} onChange={updateSlice("research", "contacts")} />
              </div>
            </div>
          </div>
        );
      }

      case "household":
        return (
          <div className="panels panels-household">
            <div className="panels-col">
              <ChoresPanel items={s.chores} onChange={updateSlice("household", "chores")} />
              <ShoppingPanel items={s.shopping} onChange={updateSlice("household", "shopping")} />
            </div>
            <div className="panels-col">
              <GoalsPanel
                items={s.goals || []}
                placeholder="e.g. declutter the garage…"
                onChange={updateSlice("household", "goals")}
              />
              <ReminderPanel items={s.reminders} onChange={updateSlice("household", "reminders")} />
            </div>
          </div>
        );

      case "health":
        return (
          <div className="panels panels-health">
            <div className="panels-col">
              <HabitPanel items={s.habits} onChange={updateSlice("health", "habits")} />
            </div>
            <div className="panels-col">
              <GoalsPanel
                items={s.goals || []}
                placeholder="e.g. fix back pain, run a marathon…"
                onChange={updateSlice("health", "goals")}
              />
              <ReminderPanel items={s.reminders} onChange={updateSlice("health", "reminders")} />
            </div>
          </div>
        );

      case "finance": {
        const cur = tweaks.currency || "₹";
        return (
          <div className="panels panels-finance">
            <div className="panels-col">
              <GrantPanel items={s.grants} currency={cur} onChange={updateSlice("finance", "grants")} />
              <BillsPanel items={s.bills} currency={cur} onChange={updateSlice("finance", "bills")} />
              <ReimbursementPanel items={s.reimbursements} currency={cur} onChange={updateSlice("finance", "reimbursements")} />
              <LoanPanel items={s.loans} currency={cur} onChange={updateSlice("finance", "loans")} />
            </div>
            <div className="panels-col">
              <GoalsPanel
                items={s.goals || []}
                placeholder="e.g. be debt-free, retire by 55…"
                onChange={updateSlice("finance", "goals")}
              />
              <InvestmentPanel items={s.investments} currency={cur} onChange={updateSlice("finance", "investments")} />
              <SavingsPanel items={s.savings} currency={cur} onChange={updateSlice("finance", "savings")} />
            </div>
          </div>
        );
      }

      case "travel":
        return (
          <div className="panels-travel-wrap">
            <TripAlerts items={s.trips} onChange={updateSlice("travel", "trips")} />
            <div className="panels panels-travel">
              <div className="panels-col">
                <TripsPanel items={s.trips} onChange={updateSlice("travel", "trips")} />
                <DocumentsPanel items={s.documents} onChange={updateSlice("travel", "documents")} />
              </div>
              <div className="panels-col">
                <GoalsPanel
                  items={s.goals || []}
                  placeholder="e.g. visit all 7 continents…"
                  onChange={updateSlice("travel", "goals")}
                />
                <PackingPanel items={s.packing} trips={s.trips} onChange={updateSlice("travel", "packing")} />
                <WishlistPanel items={s.wishlist} onChange={updateSlice("travel", "wishlist")} />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Search results ───

  const renderSearchResults = () => {
    if (!filteredResults || !filteredResults.length) {
      return <div className="search-empty">No results found</div>;
    }
    return (
      <div className="search-results">
        {filteredResults.map((r) => {
          const cat = CATEGORIES.find((c) => c.id === r.cat);
          return (
            <div
              key={`${r.cat}-${r.id}`}
              className="search-result-item"
              role="button"
              tabIndex={0}
              onClick={() => goToSearchResult(r)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToSearchResult(r); } }}
              style={{ borderLeftColor: cat?.accent || "var(--line-2)", cursor: "pointer" }}
            >
              <span className="search-result-cat" style={{ color: cat?.accent }}>{r.cat}</span>
              <span className="search-result-type">{r.type}</span>
              <span className="search-result-text">{r.text}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Render ───

  const greeting = greetingFor(now);
  const displayName = profileName || "";
  // Recompute only when the data or the clock tick changes, not on every keystroke.
  const { nextUp, nearestOverdue } = useMemo(() => collectUpcomingPair(state), [state, now]);
  const cat = CATEGORIES.find((c) => c.id === tab);
  const stats = useMemo(() => computeStats(state, now), [state, now]);
  // Transient status (Syncing…/failed) takes priority; otherwise the relative
  // "synced X ago" label, recomputed each clock tick via `now`.
  const syncText = syncStatus || syncedAgoLabel(lastSyncedAt, now.getTime());

  // Let the banner's visual weight track urgency: overdue is loud, within a
  // day is accented, anything further out stays calm.
  const nextUpDiff = nextUp ? nextUp.ts - now.getTime() : 0;
  const nextUpUrgency = !nextUp
    ? ""
    : nextUpDiff < 0
      ? "overdue"
      : nextUpDiff < MS.DAY
        ? "soon"
        : "calm";

  return (
    <div className={`app ${isDark ? "dark" : "light"}`}>
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="greeting">
            {greeting}{displayName ? <>{", "}<span className="greeting-name">{displayName}</span></> : ""}
          </h1>
        </div>
        <div className="header-right">
          <Clock now={now} />
          <div className="header-sub header-sub-right">
            <span className="header-date">
              {now.toLocaleDateString(undefined, { weekday: "long" })}, {now.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
            </span>
            {(stats.overdue > 0 || stats.week > 0) && (
              <span className="header-stats">
                {stats.overdue > 0 && (
                  <span className="stat-pill stat-overdue">{stats.overdue} overdue</span>
                )}
                {stats.week > 0 && (
                  <span className="stat-pill stat-week">{stats.week} due this week</span>
                )}
              </span>
            )}
          </div>
          {storageError && <span className="sync-status sync-status-error">{storageError}</span>}
          {/* Always rendered so it reserves its slot — fades in/out instead of
              mounting/unmounting, which kept reflowing the view on every sync. */}
          <span
            className={"sync-status sync-status-quiet" + (syncText ? " is-visible" : "")}
            aria-live="polite"
          >
            {syncText || " "}
          </span>
        </div>
      </header>

      {/* Overdue and Next-up banners */}
      {nearestOverdue && (
        <div
          className={`next-up next-up-overdue`}
          style={{ "--next-up-cat": CATEGORIES.find((c) => c.id === nearestOverdue.cat)?.accent }}
        >
          <span className="next-up-label">Overdue</span>
          <span className="next-up-kind">{nearestOverdue.kind}</span>
          <span className="next-up-text">{nearestOverdue.text}</span>
          <span className="next-up-time">{formatNextWhen(nearestOverdue.ts)}</span>
        </div>
      )}

      {nextUp && (
        <div
          className={`next-up next-up-${nextUpUrgency}`}
          style={{ "--next-up-cat": CATEGORIES.find((c) => c.id === nextUp.cat)?.accent }}
        >
          <span className="next-up-label">Next up</span>
          <span className="next-up-kind">{nextUp.kind}</span>
          <span className="next-up-text">{nextUp.text}</span>
          <span className="next-up-time">{formatNextWhen(nextUp.ts)}</span>
        </div>
      )}

      {/* Tab navigation */}
      <nav className="tab-nav" role="tablist" aria-label="Boards">
        {CATEGORIES.map((c, i) => {
          const selected = tab === c.id;
          return (
            <button
              key={c.id}
              id={`tab-${c.id}`}
              role="tab"
              aria-selected={selected}
              aria-controls="tab-panel"
              tabIndex={selected ? 0 : -1}
              className={`tab-btn ${selected ? "active" : ""}`}
              onClick={() => setTab(c.id)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const dir = e.key === "ArrowRight" ? 1 : -1;
                const next = CATEGORIES[(i + dir + CATEGORIES.length) % CATEGORIES.length];
                setTab(next.id);
                requestAnimationFrame(() => document.getElementById(`tab-${next.id}`)?.focus());
              }}
              style={selected ? { borderBottomColor: c.accent, color: c.accent } : {}}
            >
              <span className="tab-number">{i + 1}</span>
              {c.label}
              <span
                className="tab-dot"
                style={{ background: selected ? c.accent : "transparent" }}
              />
            </button>
          );
        })}

        {/* Search */}
        <div className="tab-search">
          <input
            ref={searchRef}
            type="text"
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search… (⌘F)"
          />
        </div>
      </nav>

      {/* Panels or search results */}
      <main
        className="app-main"
        id="tab-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        style={{ "--tab-tint": cat?.accent }}
      >
        {searchQuery.trim() ? renderSearchResults() : renderPanels(tab)}
      </main>

      {/* Sync bar */}
      <footer className="sync-bar">
        <button className="sync-btn" onClick={handleExport} title="Export JSON">
          Export
        </button>
        <button className="sync-btn" onClick={triggerImport} title="Import JSON">
          Import
        </button>
        <button className="sync-btn" onClick={handleIcsExport} title="Export upcoming dates as .ics">
          Calendar
        </button>
        <button className="sync-btn" onClick={handleUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button className="sync-btn" onClick={() => setShowSetup(true)} title="Setup Gist sync">
          Gist
        </button>
        <button className="sync-btn" onClick={() => setShowName(true)} title="Set your name">
          Name
        </button>
        {hasSyncConfig(syncConfig) && (
          <button className="sync-btn sync-btn-primary" onClick={handleSync} title="Push to Gist">
            Sync Now
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={handleImport}
        />
      </footer>

      {/* Keyboard hints */}
      <div className="keyboard-hints">
        <span>1–6 — switch tabs</span>
        <span>⌘F — search</span>
        <span>⌘Z — undo</span>
        <span>⌘⇧T — tweaks</span>
      </div>

      {/* Credits */}
      <div className="app-credits">
        Concept by{" "}
        <a href="https://drdebmath.github.io" target="_blank" rel="noopener noreferrer">
          Dr. Debasish Pattanayak
        </a>
        <span className="app-credits-sep">·</span>
        Designed by Claude
      </div>

      {/* Undo toast */}
      {showUndo && (
        <div className="undo-toast" onClick={handleUndo}>
          <span>Undo available</span>
          <button className="undo-toast-btn" onClick={handleUndo}>Undo</button>
        </div>
      )}

      {/* Modals */}
      {showSetup && (
        <SetupModal
          initialConfig={syncConfig}
          onClose={() => setShowSetup(false)}
          onDone={handleSetupDone}
          onDisconnect={handleDisconnectSync}
        />
      )}
      {showName && <NameModal onClose={() => setShowName(false)} onDone={handleNameDone} />}
      {showIntro && <WelcomeModal firstRun onClose={handleIntroClose} />}
      {showHelp && <WelcomeModal onClose={() => setShowHelp(false)} />}

      {/* Help button — sits beside the settings gear, reopens the guide */}
      <button
        className="help-fab"
        onClick={() => setShowHelp(true)}
        title="What is Whiteboard? (help)"
        aria-label="Open the Whiteboard guide"
      >
        ?
      </button>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance">
          <TweakRadio
            label="Theme"
            value={themeMode}
            options={[
              { value: "time", label: "Time" },
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            onChange={(v) => setTweak("themeMode", v)}
          />
          <TweakRadio
            label="Density"
            value={tweaks.density}
            options={[
              { value: "compact", label: "Compact" },
              { value: "default", label: "Default" },
              { value: "comfortable", label: "Comfortable" },
            ]}
            onChange={(v) => setTweak("density", v)}
          />
          <TweakRadio
            label="Font"
            value={tweaks.font}
            options={[
              { value: "system", label: "System" },
              { value: "serif", label: "Serif" },
              { value: "mono", label: "Mono" },
            ]}
            onChange={(v) => setTweak("font", v)}
          />
        </TweakSection>
        <TweakSection label="Color">
          <TweakSlider
            label="Hue"
            value={tweaks.hue}
            min={0}
            max={360}
            step={1}
            unit="°"
            onChange={(v) => setTweak("hue", v)}
          />
        </TweakSection>
        <TweakSection label="Regional">
          <TweakRadio
            label="Currency"
            value={tweaks.currency}
            options={[
              { value: "₹", label: "₹" },
              { value: "$", label: "$" },
              { value: "€", label: "€" },
              { value: "£", label: "£" },
            ]}
            onChange={(v) => setTweak("currency", v)}
          />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakSlider
            label="Font size"
            value={tweaks.fontSize}
            min={11}
            max={17}
            step={1}
            unit="px"
            onChange={(v) => setTweak("fontSize", v)}
          />
          <TweakSlider
            label="Panel radius"
            value={tweaks.panelRadius}
            min={0}
            max={24}
            step={1}
            unit="px"
            onChange={(v) => setTweak("panelRadius", v)}
          />
          <TweakSlider
            label="Panel opacity"
            value={tweaks.panelOpacity}
            min={40}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => setTweak("panelOpacity", v)}
          />
          <TweakSlider
            label="Sidebar width"
            value={tweaks.sidebarWidth}
            min={200}
            max={360}
            step={10}
            unit="px"
            onChange={(v) => setTweak("sidebarWidth", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// ─── Mount ───

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
