// app.jsx — Main App component for MyBoard personal dashboard
// Must be the LAST script loaded. No imports/exports — plain script tag.

const { useState, useEffect, useMemo, useRef, useCallback } = React;
const {
  loadLocal, saveLocal, getProfileName, setProfileName,
  getSyncConfig, setSyncConfig, hasSyncConfig,
  fetchRemote, createRemote, pushRemote, debounce,
  normalizeState,
  MS,
} = window.MyBoardStore;

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
  { id: "household", label: "Household", accent: "oklch(0.62 0.095 158)", soft: "oklch(0.62 0.095 158 / 0.13)" },
  { id: "health", label: "Health", accent: "oklch(0.64 0.13 38)", soft: "oklch(0.64 0.13 38 / 0.13)" },
  { id: "finance", label: "Finance", accent: "oklch(0.62 0.10 195)", soft: "oklch(0.62 0.10 195 / 0.13)" },
  { id: "travel", label: "Travel", accent: "oklch(0.62 0.15 300)", soft: "oklch(0.62 0.15 300 / 0.13)" },
];

// ─── Collect upcoming items ───

function collectUpcomingPair(state) {
  // Return both the soonest future item (`nextUp`) and the most recent
  // overdue item (`nearestOverdue`). Items follow the shape { text, cat, kind, ts }.
  const candidates = [];
  const push = (ts, item) => {
    if (Number.isNaN(ts)) return;
    candidates.push({ ...item, ts });
  };

  for (const d of state.academic.deadlines) {
    if (d.done || !d.due) continue;
    push(new Date(d.due).getTime(), { text: d.title || d.text, cat: "academic", kind: "Deadline" });
  }
  for (const s of state.academic.service) {
    if (!s.due) continue;
    push(new Date(s.due).getTime(), { text: s.title || s.text, cat: "academic", kind: "Service" });
  }
  for (const r of state.household.reminders) {
    if (r.done || !r.when) continue;
    push(new Date(r.when).getTime(), { text: r.text, cat: "household", kind: "Reminder" });
  }
  for (const r of state.health.reminders) {
    if (r.done || !r.when) continue;
    push(new Date(r.when).getTime(), { text: r.text, cat: "health", kind: "Reminder" });
  }
  for (const b of state.finance.bills) {
    if (!b.due) continue;
    push(b.due, { text: b.name, cat: "finance", kind: "Bill" });
  }
  for (const t of state.travel.trips) {
    if (!t.start) continue;
    push(new Date(t.start).getTime(), { text: t.destination, cat: "travel", kind: "Trip" });
  }
  for (const d of state.travel.documents) {
    if (!d.expiry) continue;
    push(d.expiry, { text: `${d.name} expires`, cat: "travel", kind: "Document" });
  }

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

function greetingFor(date) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
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
  const consider = (raw, done) => {
    if (done || raw == null || raw === "") return;
    const ts = typeof raw === "number" ? raw : new Date(raw).getTime();
    if (Number.isNaN(ts)) return;
    if (ts < t) overdue++;
    else if (ts - t < MS.WEEK) week++;
  };
  state.academic.deadlines.forEach((d) => consider(d.due, d.done));
  state.academic.service.forEach((s) => consider(s.due, false));
  state.household.reminders.forEach((r) => consider(r.when, r.done));
  state.health.reminders.forEach((r) => consider(r.when, r.done));
  state.finance.bills.forEach((b) => consider(b.due, false));
  state.travel.trips.forEach((t) => consider(t.start, false));
  state.travel.documents.forEach((d) => consider(d.expiry, false));
  return { overdue, week };
}

// ─── SetupModal ───

function SetupModal({ initialConfig, onClose, onDone, onDisconnect }) {
  const [token, setToken] = useState(initialConfig?.token || "");
  const [gistId, setGistId] = useState(initialConfig?.gistId || "");
  const [filename, setFilename] = useState(initialConfig?.filename || "myboard.json");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!token.trim()) { setError("Token is required"); return; }
    setError("");
    onDone({ token: token.trim(), gistId: gistId.trim(), filename: filename.trim() || "myboard.json" });
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
              placeholder="myboard.json"
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
        <div className="modal-header">Welcome to MyBoard</div>
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

// ─── useTweaks defaults ───

const TWEAK_DEFAULTS = {
  __key: "myboard",
  density: "default",
  darkMode: false,
  autoTheme: true,
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
  const [showName, setShowName] = useState(!profileName);

  const fileInputRef = useRef(null);
  const searchRef = useRef(null);
  const undoStackRef = useRef([]);
  const undoTimerRef = useRef(null);
  const hasLoadedRemoteRef = useRef(false);
  const stateRef = useRef(state);
  const [storageError, setStorageError] = useState("");

  // ─── Clock effect ───

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { stateRef.current = state; }, [state]);

  // ─── Density class ───

  useEffect(() => {
    document.documentElement.dataset.density = tweaks.density || "default";
  }, [tweaks.density]);

  // ─── Font class ───

  useEffect(() => {
    document.documentElement.dataset.font = tweaks.font || "system";
  }, [tweaks.font]);

  // ─── Dark mode ───
  // When autoTheme is on, the theme follows the clock: light through the day,
  // dark in the evening/early morning. The manual toggle is the override.

  // Resolve the effective theme once: auto-theme follows the clock, otherwise
  // the manual toggle wins. Everything that reacts to dark/light reads this.
  const isDark = tweaks.autoTheme
    ? now.getHours() < 7 || now.getHours() >= 19
    : !!tweaks.darkMode;

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
        if (e.key === "2") setTab("household");
        if (e.key === "3") setTab("health");
        if (e.key === "4") setTab("finance");
        if (e.key === "5") setTab("travel");
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

    for (const d of state.academic.deadlines) {
      const label = d.title || d.text || "";
      if (label.toLowerCase().includes(q)) results.push({ cat: "academic", type: "Deadline", text: label, id: d.id });
    }
    for (const t of state.academic.teaching) {
      if ((t.title || "").toLowerCase().includes(q)) results.push({ cat: "academic", type: "Teaching", text: t.title || t.text, id: t.id });
    }
    for (const s of state.academic.service) {
      if ((s.title || "").toLowerCase().includes(q)) results.push({ cat: "academic", type: "Service", text: s.title || s.text, id: s.id });
    }
    for (const p of state.academic.projects) {
      if ((p.name || "").toLowerCase().includes(q)) results.push({ cat: "academic", type: "Project", text: p.name, id: p.id });
    }
    for (const r of state.academic.readings) {
      const label = r.text || r.title || "";
      if (label.toLowerCase().includes(q)) results.push({ cat: "academic", type: "Reading", text: label, id: r.id });
    }
    for (const c of state.household.chores) {
      if ((c.text || "").toLowerCase().includes(q)) results.push({ cat: "household", type: "Chore", text: c.text, id: c.id });
    }
    for (const r of state.household.reminders) {
      if ((r.text || "").toLowerCase().includes(q)) results.push({ cat: "household", type: "Reminder", text: r.text, id: r.id });
    }
    for (const s of state.household.shopping) {
      if ((s.text || "").toLowerCase().includes(q)) results.push({ cat: "household", type: "Shopping", text: s.text, id: s.id });
    }
    for (const h of state.health.habits) {
      if ((h.text || "").toLowerCase().includes(q)) results.push({ cat: "health", type: "Habit", text: h.text, id: h.id });
    }
    for (const r of state.health.reminders) {
      if ((r.text || "").toLowerCase().includes(q)) results.push({ cat: "health", type: "Reminder", text: r.text, id: r.id });
    }
    for (const g of state.finance.grants) {
      if ((g.title || "").toLowerCase().includes(q)) results.push({ cat: "finance", type: "Grant", text: g.title, id: g.id });
      for (const h of g.heads || []) {
        if ((h.name || "").toLowerCase().includes(q)) results.push({ cat: "finance", type: "Budget head", text: `${h.name} · ${g.title}`, id: g.id });
      }
    }
    for (const b of state.finance.bills) {
      if ((b.name || "").toLowerCase().includes(q)) results.push({ cat: "finance", type: "Bill", text: b.name, id: b.id });
    }
    for (const r of state.finance.reimbursements) {
      const label = `${r.title || ""} ${r.party || ""}`;
      if (label.toLowerCase().includes(q)) results.push({ cat: "finance", type: "Claim", text: r.title, id: r.id });
    }
    for (const l of state.finance.loans) {
      if ((l.name || "").toLowerCase().includes(q) || (l.lender || "").toLowerCase().includes(q)) results.push({ cat: "finance", type: "Loan", text: l.name, id: l.id });
    }
    for (const sv of state.finance.savings) {
      if ((sv.name || "").toLowerCase().includes(q)) results.push({ cat: "finance", type: "Savings", text: sv.name, id: sv.id });
    }
    for (const iv of state.finance.investments) {
      if ((iv.name || "").toLowerCase().includes(q)) results.push({ cat: "finance", type: "Investment", text: iv.name, id: iv.id });
    }
    for (const t of state.travel.trips) {
      if ((t.destination || "").toLowerCase().includes(q)) results.push({ cat: "travel", type: "Trip", text: t.destination, id: t.id });
    }
    for (const p of state.travel.packing) {
      if ((p.text || "").toLowerCase().includes(q)) results.push({ cat: "travel", type: "Packing", text: p.text, id: p.id });
    }
    for (const w of state.travel.wishlist) {
      const label = `${w.text || ""} ${w.note || ""}`;
      if (label.toLowerCase().includes(q)) results.push({ cat: "travel", type: "Wishlist", text: w.text, id: w.id });
    }
    for (const d of state.travel.documents) {
      if ((d.name || "").toLowerCase().includes(q)) results.push({ cat: "travel", type: "Document", text: d.name, id: d.id });
    }
    for (const cat of ["academic", "household", "health", "finance", "travel"]) {
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
    a.download = `myboard-${new Date().toISOString().slice(0, 10)}.json`;
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
          alert("Invalid MyBoard data format");
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
    const emptyConfig = { token: "", gistId: "", filename: "myboard.json" };
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

  // ─── Render tab panels ───

  const renderPanels = (catId) => {
    const s = state[catId];

    switch (catId) {
      case "academic":
        return (
          <div className="panels panels-academic">
            <DeadlinesPanel
              items={s.deadlines}
              onChange={(deadlines) => safeUpdate((prev) => ({ ...prev, academic: { ...prev.academic, deadlines } }))}
            />
            <GoalsPanel
              items={s.goals || []}
              placeholder="e.g. publish a textbook…"
              onChange={(goals) => safeUpdate((prev) => ({ ...prev, academic: { ...prev.academic, goals } }))}
            />
            <TeachingPanel
              items={s.teaching}
              onChange={(teaching) => safeUpdate((prev) => ({ ...prev, academic: { ...prev.academic, teaching } }))}
            />
            <ServicePanel
              items={s.service}
              onAdd={(sv) => safeUpdate((prev) => ({ ...prev, academic: { ...prev.academic, service: [...prev.academic.service, sv] } }))}
              onRemove={(id) => safeUpdate((prev) => ({ ...prev, academic: { ...prev.academic, service: prev.academic.service.filter((sv) => sv.id !== id) } }))}
            />
            <ProjectPanel
              items={s.projects || []}
              onChange={(projects) => safeUpdate((prev) => ({ ...prev, academic: { ...prev.academic, projects } }))}
            />
            <ReadingPanel
              items={s.readings || []}
              onChange={(readings) => safeUpdate((prev) => ({ ...prev, academic: { ...prev.academic, readings } }))}
            />
          </div>
        );

      case "household":
        return (
          <div className="panels panels-household">
            <div className="panels-col">
              <ChoresPanel
                items={s.chores}
                onChange={(chores) => safeUpdate((prev) => ({ ...prev, household: { ...prev.household, chores } }))}
              />
              <ShoppingPanel
                items={s.shopping}
                onChange={(shopping) => safeUpdate((prev) => ({ ...prev, household: { ...prev.household, shopping } }))}
              />
            </div>
            <div className="panels-col">
              <GoalsPanel
                items={s.goals || []}
                placeholder="e.g. declutter the garage…"
                onChange={(goals) => safeUpdate((prev) => ({ ...prev, household: { ...prev.household, goals } }))}
              />
              <ReminderPanel
                items={s.reminders}
                onChange={(reminders) => safeUpdate((prev) => ({ ...prev, household: { ...prev.household, reminders } }))}
              />
            </div>
          </div>
        );

      case "health":
        return (
          <div className="panels panels-health">
            <div className="panels-col">
              <HabitPanel
                items={s.habits}
                onChange={(habits) => safeUpdate((prev) => ({ ...prev, health: { ...prev.health, habits } }))}
              />
            </div>
            <div className="panels-col">
              <GoalsPanel
                items={s.goals || []}
                placeholder="e.g. fix back pain, stop snoring…"
                onChange={(goals) => safeUpdate((prev) => ({ ...prev, health: { ...prev.health, goals } }))}
              />
              <ReminderPanel
                items={s.reminders}
                onChange={(reminders) => safeUpdate((prev) => ({ ...prev, health: { ...prev.health, reminders } }))}
              />
            </div>
          </div>
        );

      case "finance": {
        const cur = tweaks.currency || "₹";
        return (
          <div className="panels panels-finance">
            <div className="panels-col">
              <GrantPanel
                items={s.grants}
                currency={cur}
                onChange={(grants) => safeUpdate((prev) => ({ ...prev, finance: { ...prev.finance, grants } }))}
              />
              <BillsPanel
                items={s.bills}
                currency={cur}
                onChange={(bills) => safeUpdate((prev) => ({ ...prev, finance: { ...prev.finance, bills } }))}
              />
              <ReimbursementPanel
                items={s.reimbursements}
                currency={cur}
                onChange={(reimbursements) => safeUpdate((prev) => ({ ...prev, finance: { ...prev.finance, reimbursements } }))}
              />
              <LoanPanel
                items={s.loans}
                currency={cur}
                onChange={(loans) => safeUpdate((prev) => ({ ...prev, finance: { ...prev.finance, loans } }))}
              />
            </div>
            <div className="panels-col">
              <GoalsPanel
                items={s.goals || []}
                placeholder="e.g. be debt-free, retire by 55…"
                onChange={(goals) => safeUpdate((prev) => ({ ...prev, finance: { ...prev.finance, goals } }))}
              />
              <InvestmentPanel
                items={s.investments}
                currency={cur}
                onChange={(investments) => safeUpdate((prev) => ({ ...prev, finance: { ...prev.finance, investments } }))}
              />
              <SavingsPanel
                items={s.savings}
                currency={cur}
                onChange={(savings) => safeUpdate((prev) => ({ ...prev, finance: { ...prev.finance, savings } }))}
              />
            </div>
          </div>
        );
      }

      case "travel":
        return (
          <div className="panels-travel-wrap">
            <TripAlerts
              items={s.trips}
              onChange={(trips) => safeUpdate((prev) => ({ ...prev, travel: { ...prev.travel, trips } }))}
            />
            <div className="panels panels-travel">
              <div className="panels-col">
                <TripsPanel
                  items={s.trips}
                  onChange={(trips) => safeUpdate((prev) => ({ ...prev, travel: { ...prev.travel, trips } }))}
                />
                <DocumentsPanel
                  items={s.documents}
                  onChange={(documents) => safeUpdate((prev) => ({ ...prev, travel: { ...prev.travel, documents } }))}
                />
              </div>
              <div className="panels-col">
                <GoalsPanel
                  items={s.goals || []}
                  placeholder="e.g. visit all 7 continents…"
                  onChange={(goals) => safeUpdate((prev) => ({ ...prev, travel: { ...prev.travel, goals } }))}
                />
                <PackingPanel
                  items={s.packing}
                  onChange={(packing) => safeUpdate((prev) => ({ ...prev, travel: { ...prev.travel, packing } }))}
                />
                <WishlistPanel
                  items={s.wishlist}
                  onChange={(wishlist) => safeUpdate((prev) => ({ ...prev, travel: { ...prev.travel, wishlist } }))}
                />
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
              style={{ borderLeftColor: cat?.accent || "#555", cursor: "pointer" }}
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
  const { nextUp, nearestOverdue } = collectUpcomingPair(state);
  const cat = CATEGORIES.find((c) => c.id === tab);
  const stats = computeStats(state, now);
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
              {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
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
      <nav className="tab-nav">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.id}
            className={`tab-btn ${tab === c.id ? "active" : ""}`}
            onClick={() => setTab(c.id)}
            style={tab === c.id ? { borderBottomColor: c.accent, color: c.accent } : {}}
          >
            <span className="tab-number">{i + 1}</span>
            {c.label}
            <span
              className="tab-dot"
              style={{ background: tab === c.id ? c.accent : "transparent" }}
            />
          </button>
        ))}

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
      <main className="app-main">
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
        <span>1–5 — switch tabs</span>
        <span>⌘F — search</span>
        <span>⌘Z — undo</span>
        <span>⌘⇧T — tweaks</span>
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

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance">
          <TweakToggle label="Auto theme (by time)" value={tweaks.autoTheme} onChange={(v) => setTweak("autoTheme", v)} />
          <TweakToggle label="Dark mode" value={tweaks.darkMode} onChange={(v) => setTweak("darkMode", v)} />
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
