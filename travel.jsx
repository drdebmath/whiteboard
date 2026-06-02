// travel.jsx — Travel tab panels for Whiteboard.
// Loaded after finance.jsx, before app.jsx. No imports/exports — globals on window.
// Panels follow the { items, onChange } contract; TripAlerts is rendered above the grid.

const { useState, memo } = React;
const { uid, MS, safeHref } = window.WhiteboardStore;
const { formatWhen, relTime, AutoTextarea, Chip, TaskList, MetaRow } = window;

/* ─── shared bits ─── */

const PURPOSES = ["Conference", "Personal", "Family", "Work", "Other"];
const PURPOSE_COLOR = {
  Conference: "oklch(0.64 0.12 248)",
  Personal: "oklch(0.64 0.1 155)",
  Family: "oklch(0.62 0.13 300)",
  Work: "oklch(0.7 0.13 60)",
  Other: "oklch(0.62 0.02 270)",
};

const BOOKINGS = [
  { key: "flightBooked", label: "Flight" },
  { key: "stayBooked", label: "Stay" },
  { key: "transportBooked", label: "Transport" },
];

function fmtShort(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dateRangeText(start, end) {
  const s = fmtShort(start);
  const e = fmtShort(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

function tripCountdown(startTs, now) {
  const days = Math.ceil((startTs - now) / MS.DAY);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/* ─── TripAlerts — "what's still to do before this trip" ─── */

const TripAlerts = memo(function TripAlerts({ items = [], onChange }) {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const upcoming = items
    .filter((t) => t.start)
    .map((t) => ({ t, ts: new Date(t.start).getTime() }))
    .filter(({ ts }) => !Number.isNaN(ts) && ts >= todayStart.getTime() && ts <= now + 30 * MS.DAY)
    .sort((a, b) => a.ts - b.ts)
    .slice(0, 3);

  if (!upcoming.length) return null;

  const bookNow = (id, key) => onChange(items.map((t) => (t.id === id ? { ...t, [key]: true } : t)));

  return (
    <div className="trip-alerts">
      {upcoming.map(({ t, ts }) => {
        const missing = BOOKINGS.filter((b) => !t[b.key]);
        const todos = (t.tasks || []).filter((task) => !task.done).length;
        const allSet = !missing.length && todos === 0;
        return (
          <div key={t.id} className="trip-alert" style={{ "--trip-tone": PURPOSE_COLOR[t.purpose] || "var(--accent)" }}>
            <div className="trip-alert-head">
              <span className="trip-alert-dest">{t.destination || "Trip"}</span>
              <span className="trip-alert-countdown">{tripCountdown(ts, now)}</span>
            </div>
            <div className="trip-alert-actions">
              {allSet ? (
                <span className="trip-alert-allset">All set ✓</span>
              ) : (
                <>
                  {missing.map((b) => (
                    <button
                      key={b.key}
                      className="trip-action-chip"
                      onClick={() => bookNow(t.id, b.key)}
                      title={`Mark ${b.label} booked`}
                    >
                      Book {b.label}
                    </button>
                  ))}
                  {todos > 0 && (
                    <span className="trip-action-chip todo">{todos} to-do{todos === 1 ? "" : "s"}</span>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

/* ─── TripCard / TripsPanel ─── */

const TripCard = memo(function TripCard({ trip, isOpen, onToggle, onUpdate, onRemove }) {
  const bookedCount = BOOKINGS.filter((b) => trip[b.key]).length;
  const range = dateRangeText(trip.start, trip.end);

  return (
    <div data-mb-id={trip.id} className={"trip-card project-card" + (isOpen ? " open" : "")}>
      <div className="project-title-row">
        <button
          type="button"
          className="expand-icon-btn"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse trip" : "Expand trip"}
          onClick={onToggle}
        >
          {isOpen ? "▼" : "▶"}
        </button>
        <span
          className="project-name-label trip-dest"
          onClick={!isOpen ? onToggle : undefined}
          role={!isOpen ? "button" : undefined}
          tabIndex={!isOpen ? 0 : undefined}
          onKeyDown={!isOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } } : undefined}
        >
          {trip.destination || "New Trip"}
        </span>
        <Chip label={trip.purpose} color={PURPOSE_COLOR[trip.purpose]} />
        {range && <span className="trip-range">{range}</span>}
        <span className="trip-booked-count" title="Bookings done">{bookedCount}/3</span>
        <button className="btn-delete" aria-label="Delete" onClick={onRemove}>×</button>
      </div>
      {isOpen && (
        <div className="project-details trip-details">
          <div className="project-section">
            <label>Destination</label>
            <input
              className="project-collab-input"
              value={trip.destination || ""}
              onChange={(e) => onUpdate({ destination: e.target.value })}
              placeholder="Where to?"
            />
          </div>
          <div className="project-section">
            <label>Dates</label>
            <div className="trip-date-row">
              <DatePicker className="academic-input" value={trip.start || ""} onChange={(v) => onUpdate({ start: v })} placeholder="Start date" />
              <span className="trip-date-sep">→</span>
              <DatePicker className="academic-input" value={trip.end || ""} onChange={(v) => onUpdate({ end: v })} placeholder="End date" />
            </div>
          </div>
          <div className="project-section">
            <label>Purpose</label>
            <select className="academic-select" value={trip.purpose} onChange={(e) => onUpdate({ purpose: e.target.value })}>
              {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="project-section">
            <label>Bookings</label>
            <div className="trip-bookings">
              {BOOKINGS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  className={"trip-booking-toggle" + (trip[b.key] ? " booked" : "")}
                  onClick={() => onUpdate({ [b.key]: !trip[b.key] })}
                  aria-pressed={!!trip[b.key]}
                >
                  {trip[b.key] ? "✓ " : ""}{b.label}
                </button>
              ))}
            </div>
          </div>
          <div className="project-section">
            <label>To-do</label>
            <TaskList items={trip.tasks || []} onChange={(tasks) => onUpdate({ tasks })} placeholder="Add to-do…" />
          </div>
          <div className="project-section">
            <label>Notes</label>
            <AutoTextarea value={trip.notes || ""} onChange={(t) => onUpdate({ notes: t })} placeholder="Itinerary, ideas…" />
          </div>
          <div className="project-section project-links">
            <input
              className="project-link-input"
              value={trip.link || ""}
              onChange={(e) => onUpdate({ link: e.target.value })}
              placeholder="Booking / itinerary link…"
            />
          </div>
          {safeHref(trip.link) && (
            <div className="project-section project-external-links">
              <a className="external-link" href={safeHref(trip.link)} target="_blank" rel="noopener noreferrer">Open link</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const TripsPanel = memo(function TripsPanel({ items = [], onChange }) {
  const [expanded, setExpanded] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [dest, setDest] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [purpose, setPurpose] = useState("Personal");

  const addTrip = (e) => {
    e.preventDefault();
    const d = dest.trim();
    if (!d) return;
    onChange([
      ...items,
      { id: uid(), destination: d, start, end, purpose, flightBooked: false, stayBooked: false, transportBooked: false, tasks: [], notes: "", link: "", created: Date.now() },
    ]);
    setDest("");
    setStart("");
    setEnd("");
    setPurpose("Personal");
    setShowForm(false);
  };
  const toggleExpand = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const update = (id, patch) => onChange(items.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const remove = (id) => {
    onChange(items.filter((t) => t.id !== id));
    setExpanded((p) => { const n = { ...p }; delete n[id]; return n; });
  };

  const sorted = [...items].sort(
    (a, b) => (a.start ? new Date(a.start).getTime() : Infinity) - (b.start ? new Date(b.start).getTime() : Infinity)
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Trips</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>{showForm ? "×" : "+"}</button>
      </div>
      {showForm && (
        <form className="academic-form" onSubmit={addTrip}>
          <input className="academic-input" value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Destination" />
          <DatePicker className="academic-input sm" small value={start} onChange={setStart} placeholder="Start date" />
          <DatePicker className="academic-input sm" small value={end} onChange={setEnd} placeholder="End date" />
          <select className="academic-select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}
      {!items.length && <div className="panel-empty">No trips yet</div>}
      <div className="trips-list">
        {sorted.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            isOpen={!!expanded[trip.id]}
            onToggle={() => toggleExpand(trip.id)}
            onUpdate={(patch) => update(trip.id, patch)}
            onRemove={() => remove(trip.id)}
          />
        ))}
      </div>
    </div>
  );
});

/* ─── PackingPanel — a checklist scoped to an upcoming trip ─── */

const PackingPanel = memo(function PackingPanel({ items = [], trips = [], onChange }) {
  const [tripId, setTripId] = useState("");
  const [text, setText] = useState("");

  // Only current/future trips qualify — the board never dwells on the past.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const activeTrips = trips
    .filter((t) => {
      const ref = t.end || t.start;
      if (!ref) return true;
      const ts = new Date(ref).getTime();
      return Number.isNaN(ts) || ts >= todayStart.getTime();
    })
    .sort((a, b) => (a.start ? new Date(a.start).getTime() : Infinity) - (b.start ? new Date(b.start).getTime() : Infinity));

  const selectedId = activeTrips.some((t) => t.id === tripId) ? tripId : (activeTrips[0]?.id || "");
  const tripItems = items.filter((i) => i.tripId === selectedId);

  const add = () => {
    const t = text.trim();
    if (!t || !selectedId) return;
    onChange([...items, { id: uid(), tripId: selectedId, text: t, packed: false, created: Date.now() }]);
    setText("");
  };
  const toggle = (id) => onChange(items.map((i) => (i.id === id ? { ...i, packed: !i.packed } : i)));
  const remove = (id) => onChange(items.filter((i) => i.id !== id));
  const clearPacked = () => onChange(items.filter((i) => !(i.tripId === selectedId && i.packed)));

  return (
    <div className="panel">
      <div className="panel-header">
        Packing List
        {tripItems.some((i) => i.packed) && <button className="btn-clear-bought" onClick={clearPacked}>Clear packed</button>}
      </div>
      {!activeTrips.length ? (
        <div className="panel-empty">Add an upcoming trip to start a packing list</div>
      ) : (
        <>
          <select
            className="academic-select packing-trip-select"
            value={selectedId}
            onChange={(e) => setTripId(e.target.value)}
            aria-label="Trip to pack for"
          >
            {activeTrips.map((t) => {
              const range = dateRangeText(t.start, t.end);
              return (
                <option key={t.id} value={t.id}>
                  {(t.destination || "Untitled trip") + (range ? ` · ${range}` : "")}
                </option>
              );
            })}
          </select>
          <div className="todo-input-row">
            <input
              className="todo-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Add item…"
            />
            <button className="btn-add" aria-label="Add" onClick={add}>+</button>
          </div>
          {!tripItems.length && <div className="panel-empty">Nothing to pack yet</div>}
          <ul className="todo-list">
            {tripItems.map((item) => (
              <li key={item.id} data-mb-id={item.id} className={"todo-item" + (item.packed ? " done" : "")}>
                <input type="checkbox" checked={item.packed} onChange={() => toggle(item.id)} />
                <span className="todo-text">{item.text}</span>
                <button className="btn-delete" aria-label="Delete" onClick={() => remove(item.id)}>×</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
});

/* ─── WishlistPanel (mirrors ReadingPanel) ─── */

const WishlistPanel = memo(function WishlistPanel({ items = [], onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...items, { id: uid(), text: t, note: note.trim(), visited: false, created: Date.now() }]);
    setText("");
    setNote("");
    setShowForm(false);
  };
  const toggle = (id) => onChange(items.map((i) => (i.id === id ? { ...i, visited: !i.visited } : i)));
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Travel Wishlist</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>{showForm ? "×" : "+"}</button>
      </div>
      {showForm && (
        <div className="todo-input-row">
          <input
            className="todo-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Place…"
          />
          <input
            className="todo-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Note (optional)…"
          />
          <button className="btn-add" aria-label="Add" onClick={add}>+</button>
        </div>
      )}
      {!items.length && <div className="panel-empty">No places yet — dream big</div>}
      <ul className="todo-list">
        {items.map((item) => (
          <li key={item.id} data-mb-id={item.id} className={"todo-item wishlist-item" + (item.visited ? " done" : "")}>
            <input type="checkbox" checked={item.visited} onChange={() => toggle(item.id)} title="Mark visited" />
            <span className="todo-text">
              {item.text}
              {item.note ? <span className="wishlist-note"> — {item.note}</span> : null}
            </span>
            <button className="btn-delete" aria-label="Delete" onClick={() => remove(item.id)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
});

/* ─── DocumentsPanel ─── */

const DOC_KINDS = ["Passport", "Visa", "ID", "Insurance", "Other"];
const DOC_KIND_COLOR = {
  Passport: "oklch(0.64 0.14 30)",
  Visa: "oklch(0.64 0.12 248)",
  ID: "oklch(0.64 0.1 155)",
  Insurance: "oklch(0.7 0.11 70)",
  Other: "oklch(0.62 0.02 270)",
};

function expiryInfo(expiry, now) {
  if (!expiry) return { text: "No expiry", overdue: false, soon: false };
  const diff = expiry - now;
  const overdue = diff < 0;
  const soon = !overdue && diff < 30 * MS.DAY;
  const rel = relTime(Math.abs(diff));
  return { text: overdue ? `expired ${rel} ago` : `expires in ${rel}`, overdue, soon };
}

const DocumentsPanel = memo(function DocumentsPanel({ items = [], onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState(DOC_KINDS[0]);
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState("");

  const add = (e) => {
    e.preventDefault();
    const num = number.trim();
    if (!num) return;
    onChange([
      ...items,
      { id: uid(), kind, label: label.trim(), number: num, expiry: expiry ? new Date(expiry).getTime() : null, created: Date.now() },
    ]);
    setKind(DOC_KINDS[0]);
    setNumber("");
    setLabel("");
    setExpiry("");
    setShowForm(false);
  };
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  const now = Date.now();
  const sorted = [...items].sort((a, b) => (a.expiry || Infinity) - (b.expiry || Infinity));

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Documents</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>{showForm ? "×" : "+"}</button>
      </div>
      {showForm && (
        <form className="academic-form" onSubmit={add}>
          <select className="academic-select" value={kind} onChange={(e) => setKind(e.target.value)}>
            {DOC_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input className="academic-input" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Number" />
          <input className="academic-input sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional, e.g. Schengen)" />
          <DatePicker className="academic-input sm" small value={expiry} onChange={setExpiry} placeholder="Expiry date" />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}
      {!items.length && <div className="panel-empty">No documents yet</div>}
      <div className="meta-list">
        {sorted.map((d) => {
          const exp = expiryInfo(d.expiry, now);
          return (
            <MetaRow
              key={d.id}
              id={d.id}
              state={exp.overdue ? "overdue" : exp.soon ? "soon" : ""}
              chip={<Chip label={d.kind} color={DOC_KIND_COLOR[d.kind]} />}
              title={<>{d.label ? d.label + " " : ""}<span className="meta-row-mono">{d.number}</span></>}
              when={exp.text}
              onDelete={() => remove(d.id)}
            />
          );
        })}
      </div>
    </div>
  );
});

/* ─── exports to window ─── */

Object.assign(window, { TripAlerts, TripsPanel, PackingPanel, WishlistPanel, DocumentsPanel });
