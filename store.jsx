// store.jsx — data store with localStorage + optional GitHub Gist sync
// State shape: academic (deadlines, teaching, timetable, service, readings),
// research (projects, advisees, submissions, proposals, …),
// household (chores, reminders, shopping), health (habits, reminders).
// Gist sync stores the board as a single JSON file in a private GitHub Gist.

const STORAGE_KEY = "whiteboard.v1";
const PROFILE_NAME_KEY = "whiteboard.profileName";
const SYNC_CONFIG_KEY = "whiteboard.gistSync";
const LEGACY_SYNC_URL_KEY = "whiteboard.syncUrl";
const INTRO_SEEN_KEY = "whiteboard.introSeen";
const DEFAULT_GIST_FILENAME = "whiteboard.json";

// Time constants (ms). Shared by components.jsx, academic.jsx and app.jsx.
const MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
};

const EMPTY_STATE = {
  academic: { deadlines: [], teaching: [], timetable: [], service: [], readings: [], goals: [] },
  research: { projects: [], students: [], submissions: [], proposals: [], cfps: [], reviews: [], letters: [], contacts: [], goals: [] },
  household: { chores: [], reminders: [], shopping: [], goals: [] },
  health: { habits: [], reminders: [], goals: [] },
  finance: { grants: [], bills: [], reimbursements: [], loans: [], savings: [], investments: [], goals: [] },
  travel: { trips: [], packing: [], wishlist: [], documents: [], goals: [] },
  meta: { updatedAt: 0 },
};

const SEED_STATE = structuredClone(EMPTY_STATE);

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey() {
  return dateKey(new Date());
}

function daysBetweenKeys(a, b) {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db - da) / MS.DAY);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Return a safe http(s) href for a user-entered URL, or null. Shared by every
// panel that renders an external link so the protocol check lives in one place.
function safeHref(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url).trim());
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch (_) {}
  return null;
}

function parseDue(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
}

// Coerce loosely-typed money/number values (strings from inputs, undefined) to
// a finite number; anything unparseable becomes 0.
function num(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// Format a number as currency. Symbol defaults to ₹; grouping uses Indian
// digit grouping, which reads fine for other symbols too.
function formatMoney(amount, symbol = "₹") {
  const n = num(amount);
  const abs = Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}${symbol}${abs}`;
}

// Chore history is a list of completion timestamps (ms).
function normalizeChoreHistory(history) {
  return (history || []).filter((h) => typeof h === "number" && !Number.isNaN(h));
}

// Habit history is a list of day keys ("YYYY-MM-DD"), de-duplicated.
function normalizeHabitHistory(history) {
  return [...new Set((history || []).filter((h) => typeof h === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h)))];
}

function normalizeDeadline(d) {
  return {
    id: d.id || uid(),
    kind: d.kind || "Other",
    title: String(d.title || "").trim(),
    due: parseDue(d.due),
    done: !!d.done,
    createdAt: d.createdAt || Date.now(),
  };
}

function normalizeServiceItem(s) {
  return {
    id: s.id || uid(),
    type: s.type || "Other",
    title: String(s.title || "").trim(),
    due: parseDue(s.due),
    createdAt: s.createdAt || Date.now(),
  };
}

function normalizeChore(c) {
  return {
    id: c.id || uid(),
    text: String(c.text || "").trim(),
    frequency: c.frequency || "weekly",
    history: normalizeChoreHistory(c.history),
    created: c.created || Date.now(),
  };
}

function normalizeState(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const ac = parsed.academic || {};
  const rs = parsed.research || {};
  const hh = parsed.household || {};
  const h = parsed.health || {};
  const fin = parsed.finance || {};
  const trv = parsed.travel || {};
  const arr = (v) => (Array.isArray(v) ? v : []);

  const cleanStr = (s) => (s ? String(s).replace(/\[\[(.*?)\]\]/g, "$1").replace(/[\[\]]/g, "") : s);
  const projects = arr(rs.projects).map((p) => {
    const notes = Array.isArray(p.notes)
      ? p.notes.map(cleanStr).join("\n")
      : cleanStr(p.notes || "");
    return {
      ...p,
      id: p.id || uid(),
      name: cleanStr(p.name),
      collaborators: (p.collaborators || []).map(cleanStr),
      notes,
      myTasks: p.myTasks || [],
      othersTasks: p.othersTasks || [],
    };
  });

  // Aspirational goals — distinct from dated deadlines. Shared shape across tabs.
  const normalizeGoals = (list) =>
    arr(list).map((g) => ({
      id: g.id || uid(),
      text: String(g.text || "").trim(),
      note: String(g.note || "").trim(),
      achieved: !!g.achieved,
      created: g.created || Date.now(),
    }));

  return {
    academic: {
      ...EMPTY_STATE.academic,
      deadlines: arr(ac.deadlines).map(normalizeDeadline),
      teaching: arr(ac.teaching).map((t) => ({
        id: t.id || uid(),
        course: t.course || "Uncategorized",
        title: String(t.title || "").trim(),
        total: Math.max(1, Number(t.total) || 1),
        done: Math.max(0, Number(t.done) || 0),
        createdAt: t.createdAt || Date.now(),
      })),
      timetable: arr(ac.timetable).map((s) => ({
        id: s.id || uid(),
        title: String(s.title || "").trim(),
        day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].includes(s.day) ? s.day : "Mon",
        start: String(s.start || "").trim(),
        end: String(s.end || "").trim(),
        location: String(s.location || "").trim(),
        created: s.created || Date.now(),
      })),
      service: arr(ac.service).map(normalizeServiceItem),
      readings: arr(ac.readings).map((r) => ({
        id: r.id || uid(),
        text: String(r.text || "").trim(),
        url: String(r.url || "").trim(),
        done: !!r.done,
        created: r.created || Date.now(),
      })),
      goals: normalizeGoals(ac.goals),
    },
    research: {
      ...EMPTY_STATE.research,
      projects,
      students: arr(rs.students).map((s) => ({
        id: s.id || uid(),
        name: String(s.name || "").trim(),
        program: String(s.program || "").trim(),
        topic: String(s.topic || "").trim(),
        started: s.started || "",
        nextMeeting: parseDue(s.nextMeeting),
        milestones: arr(s.milestones).map((m) => ({
          id: m.id || uid(),
          text: String(m.text || "").trim(),
          due: parseDue(m.due),
          done: !!m.done,
        })),
        notes: String(s.notes || "").trim(),
        expanded: !!s.expanded,
        created: s.created || Date.now(),
      })),
      submissions: arr(rs.submissions).map((s) => ({
        id: s.id || uid(),
        title: String(s.title || "").trim(),
        venue: String(s.venue || "").trim(),
        stage: ["drafting", "submitted", "under review", "revision", "accepted", "rejected"].includes(s.stage) ? s.stage : "drafting",
        decisionDue: parseDue(s.decisionDue),
        link: String(s.link || "").trim(),
        created: s.created || Date.now(),
      })),
      proposals: arr(rs.proposals).map((p) => ({
        id: p.id || uid(),
        title: String(p.title || "").trim(),
        agency: String(p.agency || "").trim(),
        callDeadline: parseDue(p.callDeadline),
        amount: num(p.amount),
        status: ["drafting", "submitted", "awarded", "declined"].includes(p.status) ? p.status : "drafting",
        created: p.created || Date.now(),
      })),
      cfps: arr(rs.cfps).map((c) => ({
        id: c.id || uid(),
        name: String(c.name || "").trim(),
        abstractDue: parseDue(c.abstractDue),
        paperDue: parseDue(c.paperDue),
        notifyDate: parseDue(c.notifyDate),
        link: String(c.link || "").trim(),
        created: c.created || Date.now(),
      })),
      reviews: arr(rs.reviews).map((r) => ({
        id: r.id || uid(),
        venue: String(r.venue || "").trim(),
        paper: String(r.paper || "").trim(),
        due: parseDue(r.due),
        done: !!r.done,
        created: r.created || Date.now(),
      })),
      letters: arr(rs.letters).map((l) => ({
        id: l.id || uid(),
        student: String(l.student || "").trim(),
        purpose: String(l.purpose || "").trim(),
        due: parseDue(l.due),
        done: !!l.done,
        created: l.created || Date.now(),
      })),
      contacts: arr(rs.contacts).map((c) => ({
        id: c.id || uid(),
        name: String(c.name || "").trim(),
        affiliation: String(c.affiliation || "").trim(),
        email: String(c.email || "").trim(),
        website: String(c.website || "").trim(),
        note: String(c.note || "").trim(),
        created: c.created || Date.now(),
      })),
      goals: normalizeGoals(rs.goals),
    },
    household: {
      ...EMPTY_STATE.household,
      chores: arr(hh.chores).map(normalizeChore),
      reminders: arr(hh.reminders).map((r) => ({
        id: r.id || uid(),
        text: String(r.text || "").trim(),
        when: r.when || "",
        done: !!r.done,
        created: r.created || Date.now(),
      })),
      shopping: arr(hh.shopping).map((s) => ({
        id: s.id || uid(),
        text: String(s.text || "").trim(),
        bought: !!s.bought,
        created: s.created || Date.now(),
      })),
      goals: normalizeGoals(hh.goals),
    },
    health: {
      ...EMPTY_STATE.health,
      habits: arr(h.habits).map((habit) => ({
        id: habit.id || uid(),
        text: String(habit.text || "").trim(),
        history: normalizeHabitHistory(habit.history),
        created: habit.created || Date.now(),
      })),
      reminders: arr(h.reminders).map((r) => ({
        id: r.id || uid(),
        text: String(r.text || "").trim(),
        when: r.when || "",
        done: !!r.done,
        created: r.created || Date.now(),
      })),
      goals: normalizeGoals(h.goals),
    },
    finance: {
      ...EMPTY_STATE.finance,
      grants: arr(fin.grants).map((g) => ({
        id: g.id || uid(),
        title: String(g.title || "").trim(),
        total: num(g.total),
        advance: num(g.advance),
        expiry: parseDue(g.expiry),
        heads: arr(g.heads).map((h) => ({
          id: h.id || uid(),
          name: String(h.name || "").trim(),
          amount: num(h.amount),
          spent: num(h.spent),
        })),
        created: g.created || Date.now(),
      })),
      bills: arr(fin.bills).map((b) => ({
        id: b.id || uid(),
        name: String(b.name || "").trim(),
        amount: num(b.amount),
        cadence: b.cadence || "monthly",
        due: parseDue(b.due),
        created: b.created || Date.now(),
      })),
      reimbursements: arr(fin.reimbursements).map((r) => ({
        id: r.id || uid(),
        title: String(r.title || "").trim(),
        amount: num(r.amount),
        party: String(r.party || "").trim(),
        status: ["pending", "claimed", "received"].includes(r.status) ? r.status : "pending",
        due: parseDue(r.due),
        created: r.created || Date.now(),
      })),
      loans: arr(fin.loans).map((l) => ({
        id: l.id || uid(),
        name: String(l.name || "").trim(),
        lender: String(l.lender || "").trim(),
        principal: num(l.principal),
        outstanding: num(l.outstanding),
        rate: num(l.rate),
        emi: num(l.emi),
        due: parseDue(l.due),
        created: l.created || Date.now(),
      })),
      savings: arr(fin.savings).map((s) => ({
        id: s.id || uid(),
        name: String(s.name || "").trim(),
        target: num(s.target),
        current: num(s.current),
        created: s.created || Date.now(),
      })),
      investments: arr(fin.investments).map((i) => ({
        id: i.id || uid(),
        name: String(i.name || "").trim(),
        type: i.type || "Other",
        invested: num(i.invested),
        value: num(i.value),
        created: i.created || Date.now(),
      })),
      goals: normalizeGoals(fin.goals),
    },
    travel: {
      ...EMPTY_STATE.travel,
      trips: arr(trv.trips).map((t) => ({
        id: t.id || uid(),
        destination: String(t.destination || "").trim(),
        start: t.start || "",
        end: t.end || "",
        purpose: t.purpose || "Personal",
        flightBooked: !!t.flightBooked,
        stayBooked: !!t.stayBooked,
        transportBooked: !!t.transportBooked,
        tasks: arr(t.tasks).map((task) => ({
          id: task.id || uid(),
          text: String(task.text || "").trim(),
          done: !!task.done,
        })),
        notes: String(t.notes || "").trim(),
        link: String(t.link || "").trim(),
        created: t.created || Date.now(),
      })),
      packing: arr(trv.packing).map((p) => ({
        id: p.id || uid(),
        tripId: p.tripId || "",
        text: String(p.text || "").trim(),
        packed: !!p.packed,
        created: p.created || Date.now(),
      })),
      wishlist: arr(trv.wishlist).map((w) => ({
        id: w.id || uid(),
        text: String(w.text || "").trim(),
        note: String(w.note || "").trim(),
        visited: !!w.visited,
        created: w.created || Date.now(),
      })),
      documents: arr(trv.documents).map((d) => ({
        id: d.id || uid(),
        kind: d.kind || "Other",
        // optional qualifier; older boards stored this as `name`
        label: String(d.label || d.name || "").trim(),
        number: String(d.number || "").trim(),
        expiry: parseDue(d.expiry),
        created: d.created || Date.now(),
      })),
      goals: normalizeGoals(trv.goals),
    },
    meta: { updatedAt: Number(parsed.meta?.updatedAt) || 0 },
  };
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(SEED_STATE);
    return normalizeState(JSON.parse(raw)) || structuredClone(SEED_STATE);
  } catch (e) {
    console.warn("Whiteboard: failed to load state", e);
    return structuredClone(SEED_STATE);
  }
}

function saveLocal(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn("Whiteboard: failed to save state", e);
    return false;
  }
}

function getProfileName() {
  return localStorage.getItem(PROFILE_NAME_KEY) || "";
}

function getIntroSeen() {
  return localStorage.getItem(INTRO_SEEN_KEY) === "1";
}

function setIntroSeen(seen) {
  if (seen) localStorage.setItem(INTRO_SEEN_KEY, "1");
  else localStorage.removeItem(INTRO_SEEN_KEY);
}

function setProfileName(name) {
  const next = (name || "").trim();
  if (next) localStorage.setItem(PROFILE_NAME_KEY, next);
  else localStorage.removeItem(PROFILE_NAME_KEY);
}

function getSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return { token: "", gistId: "", filename: DEFAULT_GIST_FILENAME };
    return {
      token: "",
      gistId: "",
      filename: DEFAULT_GIST_FILENAME,
      ...JSON.parse(raw),
    };
  } catch (e) {
    console.warn("Whiteboard: failed to load sync config", e);
    return { token: "", gistId: "", filename: DEFAULT_GIST_FILENAME };
  }
}

function setSyncConfig(config) {
  const next = {
    token: (config?.token || "").trim(),
    gistId: (config?.gistId || "").trim(),
    filename: (config?.filename || DEFAULT_GIST_FILENAME).trim() || DEFAULT_GIST_FILENAME,
  };
  if (next.token) {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(next));
  } else {
    localStorage.removeItem(SYNC_CONFIG_KEY);
  }
  localStorage.removeItem(LEGACY_SYNC_URL_KEY);
}

function hasSyncConfig(config) {
  return !!(config?.token && config?.gistId);
}

function gistHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function readGist(config) {
  const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(config.gistId)}`, {
    method: "GET",
    headers: gistHeaders(config.token),
  });
  if (!res.ok) throw new Error(`Gist read failed: ${res.status}`);
  return await res.json();
}

function parseGistState(gist, filename) {
  const file = gist.files?.[filename];
  if (!file) return null;
  const content = file.content || "";
  if (!content.trim()) return null;
  try {
    const parsed = JSON.parse(content);
    const raw = parsed.state || parsed;
    return normalizeState(raw);
  } catch (e) {
    console.warn("Whiteboard: invalid gist JSON", e);
    return null;
  }
}

async function fetchRemote(config) {
  if (!hasSyncConfig(config)) return null;
  const gist = await readGist(config);
  return parseGistState(gist, config.filename);
}

async function createRemote(state, config) {
  if (!config?.token) throw new Error("GitHub token is required");
  const filename = config.filename || DEFAULT_GIST_FILENAME;
  const res = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: gistHeaders(config.token),
    body: JSON.stringify({
      description: "Whiteboard sync data",
      public: false,
      files: {
        [filename]: { content: JSON.stringify(state, null, 2) },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gist create failed: ${res.status}`);
  const gist = await res.json();
  return { ...config, gistId: gist.id, filename };
}

async function pushRemote(config, state, removeFilename) {
  if (!hasSyncConfig(config)) return null;
  const files = {
    [config.filename]: { content: JSON.stringify(state, null, 2) },
  };
  // When the sync filename changed, null out the old file so it doesn't linger.
  if (removeFilename && removeFilename !== config.filename) {
    files[removeFilename] = null;
  }
  const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(config.gistId)}`, {
    method: "PATCH",
    headers: gistHeaders(config.token),
    body: JSON.stringify({ files }),
  });
  if (!res.ok) throw new Error(`Gist write failed: ${res.status}`);
  return await res.json();
}

// Debounce helper for sync writes
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

window.WhiteboardStore = {
  loadLocal,
  saveLocal,
  normalizeState,
  getProfileName,
  setProfileName,
  getIntroSeen,
  setIntroSeen,
  getSyncConfig,
  setSyncConfig,
  hasSyncConfig,
  fetchRemote,
  createRemote,
  pushRemote,
  debounce,
  uid,
  safeHref,
  num,
  formatMoney,
  MS,
  dateKey,
  todayKey,
  daysBetweenKeys,
  EMPTY_STATE,
  SEED_STATE,
};
