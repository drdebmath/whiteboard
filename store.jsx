// store.jsx — data store with localStorage + optional GitHub Gist sync
// State shape: academic (projects, deadlines, teaching, service, readings),
// household (chores, reminders, shopping), health (habits, reminders).
// Gist sync stores the board as a single JSON file in a private GitHub Gist.

const STORAGE_KEY = "myboard.v1";
const PROFILE_NAME_KEY = "myboard.profileName";
const SYNC_CONFIG_KEY = "myboard.gistSync";
const LEGACY_SYNC_URL_KEY = "myboard.syncUrl";
const INTRO_SEEN_KEY = "myboard.introSeen";
const DEFAULT_GIST_FILENAME = "myboard.json";

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
  academic: { projects: [], deadlines: [], teaching: [], service: [], readings: [], goals: [] },
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

function dateKeyOffset(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return dateKey(d);
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

function freqFromLegacy(freq) {
  if (typeof freq === "string") return freq;
  const n = Number(freq);
  if (Number.isNaN(n)) return "weekly";
  if (n <= 1) return "daily";
  if (n <= 3) return "3days";
  if (n <= 7) return "weekly";
  if (n <= 14) return "biweekly";
  return "monthly";
}

function normalizeChoreHistory(history) {
  return (history || [])
    .map((h) => {
      if (typeof h === "number" && !Number.isNaN(h)) return h;
      if (typeof h === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h)) {
        return new Date(`${h}T12:00:00`).getTime();
      }
      const ts = new Date(h).getTime();
      return Number.isNaN(ts) ? null : ts;
    })
    .filter((h) => h != null);
}

// Habit history is a list of day keys ("YYYY-MM-DD"). Coerce legacy numeric
// timestamps or date strings to local day keys so streak math stays consistent.
function normalizeHabitHistory(history) {
  const out = [];
  for (const h of history || []) {
    if (typeof h === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h)) {
      out.push(h);
      continue;
    }
    let ts = null;
    if (typeof h === "number" && !Number.isNaN(h)) ts = h;
    else {
      const parsed = new Date(h).getTime();
      if (!Number.isNaN(parsed)) ts = parsed;
    }
    if (ts != null) out.push(dateKey(new Date(ts)));
  }
  // De-duplicate while preserving order.
  return [...new Set(out)];
}

function normalizeDeadline(d) {
  return {
    id: d.id || uid(),
    kind: d.kind || "Other",
    title: String(d.title || d.text || "").trim(),
    due: parseDue(d.due ?? d.when),
    done: !!d.done,
    createdAt: d.createdAt || Date.now(),
  };
}

function normalizeServiceItem(s) {
  return {
    id: s.id || uid(),
    type: s.type || "Other",
    title: String(s.title || s.text || "").trim(),
    due: parseDue(s.due ?? s.when),
    createdAt: s.createdAt || Date.now(),
  };
}

function normalizeChore(c) {
  return {
    id: c.id || uid(),
    text: String(c.text || "").trim(),
    frequency: c.frequency || freqFromLegacy(c.freq),
    history: normalizeChoreHistory(c.history),
    created: c.created || c.createdAt || Date.now(),
  };
}

function normalizeState(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const ac = parsed.academic || {};
  let projects = Array.isArray(ac.projects) ? ac.projects : null;
  if (!projects && Array.isArray(ac.todos)) {
    projects = ac.todos.map((t) => ({
      id: t.id || uid(),
      name: t.text,
      done: !!t.done,
      overleaf: "",
      github: "",
      expanded: false,
      createdAt: t.createdAt || Date.now(),
    }));
  }
  const cleanStr = (s) => (s ? String(s).replace(/\[\[(.*?)\]\]/g, "$1").replace(/[\[\]]/g, "") : s);
  projects = (Array.isArray(projects) ? projects : []).map((p) => {
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

  let deadlines = ac.deadlines;
  if (!deadlines && Array.isArray(ac.reminders)) {
    deadlines = ac.reminders;
  }

  const hh = parsed.household || {};
  let chores = hh.chores;
  if (!chores && Array.isArray(hh.todos)) {
    chores = hh.todos.map((t) => ({
      id: t.id || uid(),
      text: t.text,
      freq: 7,
      history: t.done ? [dateKeyOffset(0)] : [],
      createdAt: t.createdAt || Date.now(),
    }));
  }

  const h = parsed.health || {};

  // Aspirational goals — distinct from dated deadlines. Shared shape across tabs.
  const normalizeGoals = (list) =>
    (Array.isArray(list) ? list : []).map((g) => ({
      id: g.id || uid(),
      text: String(g.text || "").trim(),
      note: String(g.note || "").trim(),
      achieved: !!g.achieved,
      created: g.created || g.createdAt || Date.now(),
    }));

  const fin = parsed.finance || {};
  const trv = parsed.travel || {};
  const arr = (v) => (Array.isArray(v) ? v : []);

  return {
    academic: {
      ...EMPTY_STATE.academic,
      projects,
      deadlines: (deadlines || []).map(normalizeDeadline),
      teaching: (ac.teaching || []).map((t) => ({
        id: t.id || uid(),
        course: t.course || "Uncategorized",
        title: String(t.title || t.text || "").trim(),
        total: Math.max(1, Number(t.total) || 1),
        done: Math.max(0, Number(t.done) || 0),
        createdAt: t.createdAt || Date.now(),
      })),
      service: (ac.service || []).map(normalizeServiceItem),
      readings: (Array.isArray(ac.readings) ? ac.readings : []).map((r) => ({
        id: r.id || uid(),
        text: String(r.text || r.title || "").trim(),
        url: String(r.url || r.link || "").trim(),
        done: !!r.done,
        created: r.created || r.createdAt || Date.now(),
      })),
      goals: normalizeGoals(ac.goals),
    },
    household: {
      ...EMPTY_STATE.household,
      chores: (chores || []).map(normalizeChore),
      reminders: (hh.reminders || []).map((r) => ({
        id: r.id || uid(),
        text: String(r.text || "").trim(),
        when: r.when || "",
        done: !!r.done,
        created: r.created || r.createdAt || Date.now(),
      })),
      shopping: (hh.shopping || []).map((s) => ({
        id: s.id || uid(),
        text: String(s.text || "").trim(),
        bought: !!s.bought,
        created: s.created || s.createdAt || Date.now(),
      })),
      goals: normalizeGoals(hh.goals),
    },
    health: {
      ...EMPTY_STATE.health,
      habits: (h.habits || []).map((habit) => ({
        id: habit.id || uid(),
        text: String(habit.text || "").trim(),
        history: normalizeHabitHistory(habit.history),
        created: habit.created || habit.createdAt || Date.now(),
      })),
      reminders: (h.reminders || []).map((r) => ({
        id: r.id || uid(),
        text: String(r.text || "").trim(),
        when: r.when || "",
        done: !!r.done,
        created: r.created || r.createdAt || Date.now(),
      })),
      goals: normalizeGoals(h.goals),
    },
    finance: {
      ...EMPTY_STATE.finance,
      grants: arr(fin.grants).map((g) => ({
        id: g.id || uid(),
        title: String(g.title || g.name || g.category || "").trim(),
        total: num(g.total),
        advance: num(g.advance),
        expiry: parseDue(g.expiry ?? g.when),
        heads: arr(g.heads).map((h) => ({
          id: h.id || uid(),
          name: String(h.name || "").trim(),
          amount: num(h.amount),
          spent: num(h.spent),
        })),
        created: g.created || g.createdAt || Date.now(),
      })),
      bills: arr(fin.bills).map((b) => ({
        id: b.id || uid(),
        name: String(b.name || b.text || "").trim(),
        amount: num(b.amount),
        cadence: b.cadence || "monthly",
        due: parseDue(b.due ?? b.when),
        created: b.created || b.createdAt || Date.now(),
      })),
      reimbursements: arr(fin.reimbursements).map((r) => ({
        id: r.id || uid(),
        title: String(r.title || r.text || "").trim(),
        amount: num(r.amount),
        party: String(r.party || "").trim(),
        status: ["pending", "claimed", "received"].includes(r.status) ? r.status : "pending",
        due: parseDue(r.due ?? r.when),
        created: r.created || r.createdAt || Date.now(),
      })),
      loans: arr(fin.loans).map((l) => ({
        id: l.id || uid(),
        name: String(l.name || l.text || "").trim(),
        lender: String(l.lender || "").trim(),
        principal: num(l.principal),
        outstanding: num(l.outstanding),
        rate: num(l.rate),
        emi: num(l.emi),
        due: parseDue(l.due ?? l.when),
        created: l.created || l.createdAt || Date.now(),
      })),
      savings: arr(fin.savings).map((s) => ({
        id: s.id || uid(),
        name: String(s.name || s.text || "").trim(),
        target: num(s.target),
        current: num(s.current),
        created: s.created || s.createdAt || Date.now(),
      })),
      investments: arr(fin.investments).map((i) => ({
        id: i.id || uid(),
        name: String(i.name || i.text || "").trim(),
        type: i.type || "Other",
        invested: num(i.invested),
        value: num(i.value),
        created: i.created || i.createdAt || Date.now(),
      })),
      goals: normalizeGoals(fin.goals),
    },
    travel: {
      ...EMPTY_STATE.travel,
      trips: arr(trv.trips).map((t) => ({
        id: t.id || uid(),
        destination: String(t.destination || t.text || "").trim(),
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
        created: t.created || t.createdAt || Date.now(),
      })),
      packing: arr(trv.packing).map((p) => ({
        id: p.id || uid(),
        text: String(p.text || "").trim(),
        packed: !!p.packed,
        created: p.created || p.createdAt || Date.now(),
      })),
      wishlist: arr(trv.wishlist).map((w) => ({
        id: w.id || uid(),
        text: String(w.text || w.title || "").trim(),
        note: String(w.note || "").trim(),
        visited: !!w.visited,
        created: w.created || w.createdAt || Date.now(),
      })),
      documents: arr(trv.documents).map((d) => ({
        id: d.id || uid(),
        name: String(d.name || d.text || "").trim(),
        kind: d.kind || "Other",
        number: String(d.number || "").trim(),
        expiry: parseDue(d.expiry ?? d.due),
        created: d.created || d.createdAt || Date.now(),
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
    console.warn("MyBoard: failed to load state", e);
    return structuredClone(SEED_STATE);
  }
}

function saveLocal(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn("MyBoard: failed to save state", e);
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
    console.warn("MyBoard: failed to load sync config", e);
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
    console.warn("MyBoard: invalid gist JSON", e);
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
      description: "MyBoard sync data",
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

window.MyBoardStore = {
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
