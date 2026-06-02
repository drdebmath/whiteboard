const { useState, useRef, useLayoutEffect, useEffect, memo } = React;
const { uid, dateKey, todayKey, daysBetweenKeys, MS, safeHref } = window.WhiteboardStore;

/* ─── Chip — a small colored type/category tag, shared across every tab ─── */

function Chip({ label, color }) {
  return <span className="kind-chip" style={{ "--chip": color || "var(--muted)" }}>{label}</span>;
}

/* ─── time helpers ─── */

function relTime(diffMs) {
  const abs = Math.abs(diffMs);
  const sign = diffMs < 0 ? '-' : '';
  if (abs < MS.MINUTE) return `${sign}${Math.floor(abs / MS.SECOND)}s`;
  if (abs < MS.HOUR)   return `${sign}${Math.floor(abs / MS.MINUTE)}m`;
  if (abs < MS.DAY)    return `${sign}${Math.floor(abs / MS.HOUR)}h`;
  return `${sign}${Math.floor(abs / MS.DAY)}d`;
}

function formatWhen(iso) {
  if (!iso) return { label: '', rel: '', overdue: false, soon: false };
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diff = target - now;
  const label = new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const rel = relTime(diff);
  const overdue = diff < 0;
  const soon = !overdue && diff < MS.HOUR * 6;
  return { label, rel, overdue, soon };
}

/* ─── ReminderPanel ─── */

const ReminderPanel = memo(function ReminderPanel({ items, onChange }) {
  const [text, setText] = useState('');
  const [when, setWhen] = useState('');

  const add = () => {
    const t = text.trim();
    if (!t || !when) return;
    onChange([...items, { id: uid(), text: t, when, done: false, created: Date.now() }]);
    setText('');
    setWhen('');
  };

  const toggle = (id) => {
    onChange(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
  };

  const remove = (id) => {
    onChange(items.filter(i => i.id !== id));
  };

  // Done reminders dim and drop to the bottom (forward-looking philosophy,
  // DESIGN.md §7); live ones stay in soonest-first order.
  const sorted = [...items].sort(
    (a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || new Date(a.when) - new Date(b.when)
  );

  return (
    <div className="panel">
      <div className="panel-header">Reminders</div>
      <div className="todo-input-row">
        <input
          className="todo-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reminder…"
        />
        <DatePicker
          className="datetime-input"
          withTime
          value={when}
          onChange={setWhen}
          placeholder="When"
        />
        <button className="btn-add" aria-label="Add" onClick={add}>+</button>
      </div>
      {!sorted.length && <div className="panel-empty">No reminders yet</div>}
      <ul className="todo-list">
        {sorted.map((item) => {
          const { label, rel, overdue, soon } = formatWhen(item.when);
          let cls = 'reminder-item';
          if (overdue && !item.done) cls += ' overdue';
          else if (soon && !item.done) cls += ' soon';
          if (item.done) cls += ' done';
          return (
            <li key={item.id} data-mb-id={item.id} className={cls}>
              <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)} />
              <span className="todo-text">{item.text}</span>
              <span className="reminder-time">{label} · {rel}</span>
              <button className="btn-delete" aria-label="Delete" onClick={() => remove(item.id)}>×</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/* ─── AutoTextarea ─── */

function AutoTextarea({ value, onChange, placeholder }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="auto-textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
    />
  );
}

/* ─── TaskList — a simple {id,text,done} checklist, shared by projects & trips ─── */

function TaskList({ items = [], onChange, placeholder = 'Add task…' }) {
  const [text, setText] = useState('');

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...items, { id: uid(), text: t, done: false }]);
    setText('');
  };

  const toggle = (id) => {
    onChange(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
  };

  const remove = (id) => {
    onChange(items.filter(i => i.id !== id));
  };

  return (
    <div className="project-task-list">
      <div className="todo-input-row">
        <input
          className="todo-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={placeholder}
        />
        <button className="btn-add" aria-label="Add" onClick={add}>+</button>
      </div>
      <ul className="todo-list">
        {items.map((item) => (
          <li key={item.id} className={'todo-item' + (item.done ? ' done' : '')}>
            <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)} />
            <span className="todo-text">{item.text}</span>
            <button className="btn-delete" aria-label="Delete" onClick={() => remove(item.id)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── ProjectPanel ─── */

/* ─── Edit button (pen icon) ─── */

function EditButton({ onClick, title = 'Edit' }) {
  return (
    <button className="btn-edit" title={title} onClick={onClick} aria-label={title}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor" />
        <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor" />
      </svg>
    </button>
  );
}

/* ─── MetaRow — the one shared "tagged dated row" ───
   A single superset for every dense row that is a leading tag + a title + a
   date stamp (+ optional money) + edit/delete: deadlines, bills, claims,
   documents, submissions, proposals, calls, contacts. Every slot is optional,
   so each panel passes only what it has and the row renders the same way
   everywhere. See DESIGN.md §3 "meta-row".

   Slots, in render order:
     lead    — checkbox or status-pill (whatever leads the row)
     chip    — a kind/type Chip
     title   — the structure-tier primary text  (+ sub: an inline muted aside)
     when    — the meta-when date stamp
     value   — a trailing money figure
     extra   — extra trailing controls (e.g. link icons)
     onEdit / onDelete — the reveal-on-hover actions
   `state` ('overdue' | 'soon' | 'done' | 'received') drives the urgency tint
   and the done/received dim+strike. `editing` replaces the whole body with an
   inline editor (the .row-edit stacked column). */
function MetaRow({
  id, className = "", state = "",
  lead = null, chip = null, title, sub = null,
  when = null, value = null, extra = null,
  onEdit = null, onDelete = null, editing = null,
}) {
  const cls = ["meta-row", state, className].filter(Boolean).join(" ");
  return (
    <div data-mb-id={id} className={cls}>
      {editing ? editing : (
        <>
          {lead}
          {chip}
          <span className="meta-row-title">{title}{sub}</span>
          {when != null && <span className="meta-row-when">{when}</span>}
          {value != null && <span className="meta-row-value money">{value}</span>}
          {extra}
          {onEdit && <EditButton onClick={onEdit} />}
          {onDelete && <button className="btn-delete" aria-label="Delete" onClick={onDelete}>×</button>}
        </>
      )}
    </div>
  );
}

// Keeps the raw text in local state so typing commas/spaces isn't fought by
// the parse round-trip; the parsed array is propagated up on each change.
function CollaboratorsInput({ value = [], onChange }) {
  const [text, setText] = useState(value.join(', '));
  // Track what our own text currently parses to, so we ignore the echo of our
  // own edits (new array reference, same content) and only re-sync when the
  // value changes for real elsewhere (e.g. switching projects, remote sync).
  const parsedRef = useRef(value.join('\n'));

  const incoming = value.join('\n');
  if (incoming !== parsedRef.current) {
    parsedRef.current = incoming;
    setText(value.join(', '));
  }

  return (
    <input
      className="project-collab-input"
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const arr = next.split(',').map(s => s.trim()).filter(Boolean);
        parsedRef.current = arr.join('\n');
        onChange(arr);
      }}
      placeholder="Name, Name, …"
    />
  );
}

const PRIORITY_LEVELS = ['none', 'low', 'med', 'high'];
const PRIORITY_LABELS = { none: 'No priority', low: 'Low priority', med: 'Medium priority', high: 'High priority' };

const ProjectCard = memo(function ProjectCard({ proj, isOpen, onToggle, onUpdate, onRemove, isDragging, isDragOver, onDragStart, onDragEnter, onDragEnd, onDrop }) {
  const displayName = proj.name || 'New Project';
  const collabCount = (proj.collaborators || []).length;
  const priority = PRIORITY_LEVELS.includes(proj.priority) ? proj.priority : 'none';

  const cyclePriority = (e) => {
    e.stopPropagation();
    const next = PRIORITY_LEVELS[(PRIORITY_LEVELS.indexOf(priority) + 1) % PRIORITY_LEVELS.length];
    onUpdate({ priority: next });
  };

  return (
    <div
      data-mb-id={proj.id}
      className={"project-card" + (isOpen ? " open" : "") + (proj.done ? " done" : "") + (priority !== 'none' ? " prio-" + priority : "") + (isDragging ? " dragging" : "") + (isDragOver ? " drag-over" : "")}
      draggable={!isOpen}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      <div className="project-title-row">
        <span className="project-drag-handle" aria-hidden title="Drag to reorder">⋮⋮</span>
        <button
          type="button"
          className="expand-icon-btn"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Collapse project' : 'Expand project'}
          onClick={onToggle}
        >
          {isOpen ? '▼' : '▶'}
        </button>
        <button
          type="button"
          className={"project-flare prio-" + priority}
          onClick={cyclePriority}
          title={PRIORITY_LABELS[priority] + ' (click to change)'}
          aria-label={PRIORITY_LABELS[priority]}
        >
          ✦
        </button>
        <span
          className="project-name-label"
          onClick={!isOpen ? onToggle : undefined}
          onKeyDown={!isOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}
          role={!isOpen ? 'button' : undefined}
          tabIndex={!isOpen ? 0 : undefined}
        >
          {displayName}
        </span>
        {!isOpen && safeHref(proj.overleaf) && (
          <a
            className="project-overleaf-icon"
            href={safeHref(proj.overleaf)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open Overleaf project"
            aria-label="Open Overleaf project"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
        <button
          type="button"
          className={"project-done-toggle" + (proj.done ? " done" : "")}
          onClick={(e) => { e.stopPropagation(); onUpdate({ done: !proj.done }); }}
          aria-pressed={proj.done}
          title={proj.done ? "Mark as not done" : "Mark as done"}
        >
          ✓
        </button>
        <button className="btn-delete" aria-label="Delete" onClick={onRemove}>×</button>
      </div>
      {isOpen && (
        <div className="project-details">
          <div className="project-section">
            <label htmlFor={`project-name-${proj.id}`}>Project name</label>
            <input
              id={`project-name-${proj.id}`}
              className="project-collab-input project-name-edit"
              value={proj.name || ''}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Project name"
            />
          </div>
          <div className="project-section">
            <label>My Tasks</label>
            <TaskList
              items={proj.myTasks || []}
              onChange={(t) => onUpdate({ myTasks: t })}
            />
          </div>
          <div className="project-section">
            <label>Others' Tasks</label>
            <TaskList
              items={proj.othersTasks || []}
              onChange={(t) => onUpdate({ othersTasks: t })}
            />
          </div>
          <div className="project-section">
            <label>Collaborators</label>
            <CollaboratorsInput
              value={proj.collaborators || []}
              onChange={(c) => onUpdate({ collaborators: c })}
            />
          </div>
          <div className="project-section">
            <label>Notes</label>
            <AutoTextarea
              value={proj.notes || ''}
              onChange={(t) => onUpdate({ notes: t })}
              placeholder="Project notes…"
            />
          </div>
          <div className="project-section project-links">
            <input
              className="project-link-input"
              value={proj.overleaf || ''}
              onChange={(e) => onUpdate({ overleaf: e.target.value })}
              placeholder="Overleaf link…"
            />
            <input
              className="project-link-input"
              value={proj.github || ''}
              onChange={(e) => onUpdate({ github: e.target.value })}
              placeholder="GitHub link…"
            />
          </div>
          {(safeHref(proj.overleaf) || safeHref(proj.github)) && (
            <div className="project-section project-external-links">
              {safeHref(proj.overleaf) && <a className="external-link overleaf-link" href={safeHref(proj.overleaf)} target="_blank" rel="noopener noreferrer">Overleaf</a>}
              {safeHref(proj.github) && <a className="external-link github-link" href={safeHref(proj.github)} target="_blank" rel="noopener noreferrer">GitHub</a>}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const ProjectPanel = memo(function ProjectPanel({ items = [], onChange }) {
  const [expanded, setExpanded] = useState({});
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const reorder = (fromId, toId) => {
    if (fromId === toId) return;
    const list = Array.isArray(items) ? items.slice() : [];
    const from = list.findIndex(i => i.id === fromId);
    const to = list.findIndex(i => i.id === toId);
    if (from === -1 || to === -1) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    onChange(list);
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addProject = () => {
    onChange([...items, {
      id: uid(),
      name: 'New Project',
      myTasks: [],
      othersTasks: [],
      collaborators: [],
      notes: '',
      overleaf: '',
      github: '',
      priority: 'none',
      created: Date.now(),
    }]);
  };

  const update = (id, patch) => {
    onChange(items.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  const remove = (id) => {
    onChange(items.filter(i => i.id !== id));
    setExpanded((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const anyOpen = Object.values(expanded).some(Boolean);
  const collapseAll = () => setExpanded({});

  // Ticked (done) projects sink to the bottom. A stable sort keeps the manual
  // drag order within the active and the done groups, so un-ticking restores a
  // project to its prior place among the active ones. Drag-reorder still works:
  // it splices the underlying items array by id, independent of display order.
  const ordered = (Array.isArray(items) ? items : []).slice()
    .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));

  return (
    <div className="panel">
      <div className="panel-header">
        Projects
        <div className="panel-header-actions">
          {anyOpen && (
            <button className="panel-text-btn" onClick={collapseAll}>Collapse all</button>
          )}
          <button className="btn-add-inline" aria-label="Add" onClick={addProject}>+</button>
        </div>
      </div>
      <div className="projects-list">
        {ordered.map((proj) => (
          <ProjectCard
            key={proj.id}
            proj={proj}
            isOpen={!!expanded[proj.id]}
            onToggle={() => toggleExpand(proj.id)}
            onUpdate={(patch) => update(proj.id, patch)}
            onRemove={() => remove(proj.id)}
            isDragging={dragId === proj.id}
            isDragOver={overId === proj.id && dragId !== proj.id}
            onDragStart={(e) => { setDragId(proj.id); e.dataTransfer.effectAllowed = 'move'; }}
            onDragEnter={() => dragId && setOverId(proj.id)}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            onDrop={(e) => { e.preventDefault(); if (dragId) reorder(dragId, proj.id); setDragId(null); setOverId(null); }}
          />
        ))}
      </div>
    </div>
  );
});

/* ─── ReadingPanel ─── */

const ReadingPanel = memo(function ReadingPanel({ items = [], onChange }) {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const list = Array.isArray(items) ? items : [];

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...list, { id: uid(), text: t, url: url.trim(), done: false, created: Date.now() }]);
    setText('');
    setUrl('');
  };

  const toggle = (id) => {
    onChange(list.map(i => i.id === id ? { ...i, done: !i.done } : i));
  };

  const remove = (id) => {
    onChange(list.filter(i => i.id !== id));
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditText(item.text || '');
    setEditUrl(item.url || '');
  };

  const saveEdit = (id) => {
    const t = editText.trim();
    if (t) onChange(list.map(i => i.id === id ? { ...i, text: t, url: editUrl.trim() } : i));
    setEditingId(null);
  };

  return (
    <div className="panel panel-reading">
      <div className="panel-header">Reading List</div>
      <div className="todo-input-row">
        <input
          className="todo-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Title…"
        />
        <input
          className="todo-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL (optional)…"
        />
        <button className="btn-add" aria-label="Add" onClick={add}>+</button>
      </div>
      {!list.length && <div className="panel-empty">No reading items yet</div>}
      <ul className="todo-list">
        {list.map((item) => (
          <li key={item.id} data-mb-id={item.id} className={'todo-item reading-item' + (item.done ? ' done' : '')}>
            <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)} />
            {editingId === item.id ? (
              <div className="row-edit">
                <input
                  className="todo-input"
                  value={editText}
                  autoFocus
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(item.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  placeholder="Title…"
                />
                <input
                  className="todo-input"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(item.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  placeholder="URL (optional)…"
                />
                <div className="row-edit-actions">
                  <button className="btn-chore-done" aria-label="Save" onClick={() => saveEdit(item.id)}>✓</button>
                </div>
              </div>
            ) : (
              <>
                <span className="todo-text">{item.text || '(Untitled)'}</span>
                {safeHref(item.url) && (
                  <a className="external-badge" href={safeHref(item.url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Open link" aria-label="Open link">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                )}
                <EditButton onClick={() => startEdit(item)} />
              </>
            )}
            <button className="btn-delete" aria-label="Delete" onClick={() => remove(item.id)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
});

/* ─── ShoppingPanel ─── */

const ShoppingPanel = memo(function ShoppingPanel({ items, onChange }) {
  const [text, setText] = useState('');

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...items, { id: uid(), text: t, bought: false, created: Date.now() }]);
    setText('');
  };

  const toggle = (id) => {
    onChange(items.map(i => i.id === id ? { ...i, bought: !i.bought } : i));
  };

  const remove = (id) => {
    onChange(items.filter(i => i.id !== id));
  };

  const clearBought = () => {
    onChange(items.filter(i => !i.bought));
  };

  return (
    <div className="panel">
      <div className="panel-header">
        Shopping
        {items.some(i => i.bought) && (
          <button className="btn-clear-bought" onClick={clearBought}>Clear bought</button>
        )}
      </div>
      <div className="todo-input-row">
        <input
          className="todo-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add item…"
        />
        <button className="btn-add" aria-label="Add" onClick={add}>+</button>
      </div>
      {!items.length && <div className="panel-empty">Nothing on the list</div>}
      <ul className="todo-list">
        {items.map((item) => (
          <li key={item.id} data-mb-id={item.id} className={'todo-item' + (item.bought ? ' done' : '')}>
            <input type="checkbox" checked={item.bought} onChange={() => toggle(item.id)} />
            <span className="todo-text">{item.text}</span>
            <button className="btn-delete" aria-label="Delete" onClick={() => remove(item.id)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
});

/* ─── HabitPanel ─── */

const HabitPanel = memo(function HabitPanel({ items, onChange }) {
  const [text, setText] = useState('');

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...items, { id: uid(), text: t, history: [], created: Date.now() }]);
    setText('');
  };

  const remove = (id) => {
    onChange(items.filter(i => i.id !== id));
  };

  const toggleDay = (id, dayKey) => {
    onChange(items.map(i => {
      if (i.id !== id) return i;
      const hist = i.history || [];
      const has = hist.includes(dayKey);
      return { ...i, history: has ? hist.filter(d => d !== dayKey) : [...hist, dayKey] };
    }));
  };

  const computeStreak = (history) => {
    if (!history || !history.length) return { current: 0, best: 0 };
    const sorted = [...history].sort().reverse();
    const today = todayKey();
    let current = 0;
    let d = today;
    while (sorted.includes(d)) {
      current++;
      // Parse as local midnight (not UTC) so day stepping doesn't drift a day
      // for users in negative-offset timezones.
      const dt = new Date(`${d}T00:00:00`);
      dt.setDate(dt.getDate() - 1);
      d = dateKey(dt);
    }
    let best = 0;
    let run = 0;
    const all = [...history].sort();
    let prev = null;
    for (const dk of all) {
      if (prev) {
        const diff = daysBetweenKeys(prev, dk);
        if (diff === 1) { run++; } else { best = Math.max(best, run); run = 1; }
      } else {
        run = 1;
      }
      prev = dk;
    }
    best = Math.max(best, run);
    return { current, best };
  };

  const today = todayKey();
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    last7.push({
      key,
      dow: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      day: String(d.getDate()),
      isToday: key === today,
    });
  }

  return (
    <div className="panel">
      <div className="panel-header">
        Habits
        <button className="btn-add-inline" aria-label="Add" onClick={add}>+</button>
      </div>
      <div className="todo-input-row">
        <input
          className="todo-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New habit…"
        />
      </div>
      {!items.length && <div className="panel-empty">No habits yet — start one</div>}
      <div className="habits-list">
        {items.map((habit) => {
          const { current, best } = computeStreak(habit.history || []);
          return (
            <div key={habit.id} data-mb-id={habit.id} className="habit-card">
              <div className="habit-title-row">
                <span className="habit-name">{habit.text}</span>
                <span className={'habit-streak' + (current > 0 ? ' active' : '')}>
                  {current > 0 ? `${current} day${current === 1 ? '' : 's'}` : 'no streak'}
                  <span className="habit-streak-best">best {best}</span>
                </span>
                <button className="btn-delete" aria-label="Delete" onClick={() => remove(habit.id)}>×</button>
              </div>
              <div className="habit-days">
                {last7.map(({ key, dow, day, isToday }) => (
                  <button
                    key={key}
                    className={'habit-day-btn' + ((habit.history || []).includes(key) ? ' active' : '') + (isToday ? ' today' : '')}
                    onClick={() => toggleDay(habit.id, key)}
                    title={key}
                  >
                    <span className="habit-day-dow">{dow}</span>
                    <span className="habit-day-num">{day}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ─── Chores: frequency menu ─── */

const CHORE_FREQUENCIES = [
  { label: 'Daily', value: 'daily', ms: MS.DAY },
  { label: 'Every 3 days', value: '3days', ms: MS.DAY * 3 },
  { label: 'Weekly', value: 'weekly', ms: MS.WEEK },
  { label: 'Biweekly', value: 'biweekly', ms: MS.WEEK * 2 },
  { label: 'Monthly', value: 'monthly', ms: MS.DAY * 30 },
];

function ChoreFreqMenu({ value, onChange }) {
  return (
    <select className="chore-freq-menu" value={value} onChange={(e) => onChange(e.target.value)}>
      {CHORE_FREQUENCIES.map((f) => (
        <option key={f.value} value={f.value}>{f.label}</option>
      ))}
    </select>
  );
}

/* ─── ChoresPanel ─── */

const ChoresPanel = memo(function ChoresPanel({ items, onChange }) {
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const getFreqMs = (freq) => {
    const f = CHORE_FREQUENCIES.find((c) => c.value === freq);
    return f ? f.ms : MS.DAY;
  };

  const choreStatus = (chore) => {
    const now = Date.now();
    const lastDone = chore.history && chore.history.length
      ? Math.max(...chore.history)
      : 0;
    const interval = getFreqMs(chore.frequency);
    if (lastDone === 0) return 'due';
    const elapsed = now - lastDone;
    if (elapsed >= interval) return 'overdue';
    const remaining = interval - elapsed;
    if (remaining < MS.HOUR * 6) return 'soon';
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const lastDate = new Date(lastDone);
    lastDate.setHours(0, 0, 0, 0);
    if (lastDate.getTime() === todayStart.getTime()) return 'done-today';
    return 'fresh';
  };

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...items, {
      id: uid(),
      text: t,
      frequency: 'weekly',
      history: [],
      created: Date.now(),
    }]);
    setText('');
  };

  const updateFreq = (id, frequency) => {
    onChange(items.map(i => i.id === id ? { ...i, frequency } : i));
  };

  const markDone = (id) => {
    onChange(items.map(i => i.id === id ? { ...i, history: [...(i.history || []), Date.now()] } : i));
  };

  const undoLast = (id) => {
    onChange(items.map(i => {
      if (i.id !== id) return i;
      const h = [...(i.history || [])];
      h.pop();
      return { ...i, history: h };
    }));
  };

  const remove = (id) => {
    onChange(items.filter(i => i.id !== id));
  };

  const startEdit = (chore) => {
    setEditingId(chore.id);
    setEditText(chore.text);
  };

  const saveEdit = (id) => {
    const t = editText.trim();
    if (t) onChange(items.map(i => i.id === id ? { ...i, text: t } : i));
    setEditingId(null);
  };

  const sorted = [...items].sort((a, b) => {
    const order = { overdue: 0, due: 1, soon: 2, fresh: 3, 'done-today': 4 };
    const sa = choreStatus(a);
    const sb = choreStatus(b);
    return (order[sa] ?? 5) - (order[sb] ?? 5);
  });

  return (
    <div className="panel">
      <div className="panel-header">
        Chores
        <button className="btn-add-inline" aria-label="Add" onClick={add}>+</button>
      </div>
      <div className="todo-input-row">
        <input
          className="todo-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New chore…"
        />
      </div>
      {!sorted.length && <div className="panel-empty">No chores yet</div>}
      <ul className="chore-list">
        {sorted.map((chore) => {
          const status = choreStatus(chore);
          const cls = 'chore-item chore-' + status;
          const lastDone = chore.history && chore.history.length
            ? new Date(Math.max(...chore.history)).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Never';
          return (
            <li key={chore.id} data-mb-id={chore.id} className={cls}>
              <div className="chore-main-row">
                {editingId === chore.id ? (
                  <input
                    className="todo-input"
                    value={editText}
                    autoFocus
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(chore.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => saveEdit(chore.id)}
                  />
                ) : (
                  <span className="chore-name">{chore.text}</span>
                )}
                <ChoreFreqMenu value={chore.frequency} onChange={(f) => updateFreq(chore.id, f)} />
                <span className="chore-status-badge">{status}</span>
                <div className="chore-actions">
                  <button className="btn-chore-done" aria-label="Mark done" onClick={() => markDone(chore.id)}>✓</button>
                  {chore.history && chore.history.length > 0 && (
                    <button className="btn-chore-undo" aria-label="Undo last done" onClick={() => undoLast(chore.id)}>↩</button>
                  )}
                  <EditButton onClick={() => startEdit(chore)} />
                  <button className="btn-delete" aria-label="Delete" onClick={() => remove(chore.id)}>×</button>
                </div>
              </div>
              <div className="chore-meta">
                Last done: {lastDone}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/* ─── GoalsPanel ─── */
// Aspirational goals — open-ended intentions ("fix back pain", "publish a book"),
// not dated tasks. Each goal has a title, an optional note, and an achieved flag.

const GoalsPanel = memo(function GoalsPanel({ items = [], onChange, placeholder = 'An aspiration…' }) {
  const [text, setText] = useState('');

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...items, { id: uid(), text: t, note: '', achieved: false, created: Date.now() }]);
    setText('');
  };

  const update = (id, patch) => onChange(items.map(g => g.id === id ? { ...g, ...patch } : g));
  const remove = (id) => onChange(items.filter(g => g.id !== id));

  const active = items.filter(g => !g.achieved);
  const achieved = items.filter(g => g.achieved);

  return (
    <div className="panel">
      <div className="panel-header">Goals</div>
      <div className="todo-input-row">
        <input
          className="todo-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder={placeholder}
        />
        <button className="btn-add" aria-label="Add goal" onClick={add}>+</button>
      </div>
      {!items.length && <div className="panel-empty">No goals yet — dream big</div>}
      <ul className="goal-list">
        {[...active, ...achieved].map((g) => (
          <li key={g.id} data-mb-id={g.id} className={'goal-item' + (g.achieved ? ' achieved' : '')}>
            <div className="goal-row">
              <button
                type="button"
                className={'goal-star' + (g.achieved ? ' achieved' : '')}
                onClick={() => update(g.id, { achieved: !g.achieved })}
                aria-pressed={g.achieved}
                title={g.achieved ? 'Achieved — mark as ongoing' : 'Mark as achieved'}
              >
                {g.achieved ? '★' : '☆'}
              </button>
              <input
                className="goal-text-input"
                value={g.text}
                onChange={(e) => update(g.id, { text: e.target.value })}
                placeholder="Goal…"
              />
              <button className="btn-delete" aria-label="Delete goal" onClick={() => remove(g.id)}>×</button>
            </div>
            <AutoTextarea
              value={g.note}
              onChange={(t) => update(g.id, { note: t })}
              placeholder="Why it matters, or how to get there…"
            />
          </li>
        ))}
      </ul>
    </div>
  );
});

/* ─── DatePicker ─────────────────────────────────────────────────────────── */
//
// Replaces native <input type="date"> with a styled floating calendar card.
// `value` is a "YYYY-MM-DD" string; `onChange` receives the same format.

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function parseDateStr(s) {
  if (!s) return null;
  const [datePart, timePart] = String(s).split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  let hour = 0, minute = 0;
  if (timePart) {
    const [hh, mm] = timePart.split(":").map(Number);
    hour = hh || 0;
    minute = mm || 0;
  }
  return { year: y, month: m - 1, day: d, hour, minute, hasTime: !!timePart };
}

// One picker for every date/date-time field in the app. Pass `withTime` to also
// pick an hour/minute; the value/onChange string then carries a "T HH:mm" suffix
// (matching the old native datetime-local format), otherwise it's "YYYY-MM-DD".
function DatePicker({ value, onChange, className = "", title, placeholder, withTime = false, small }) {
  placeholder = placeholder ?? (withTime ? "Pick date & time" : "Pick date");
  const parsed = parseDateStr(value);
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const [viewYear, setViewYear]   = useState(parsed?.year  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const [hour, setHour]     = useState(parsed?.hour   ?? 9);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);
  const wrapRef = useRef(null);
  const popRef = useRef(null);

  // Keep view in sync when value changes externally
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      if (withTime) { setHour(parsed.hour); setMinute(parsed.minute); }
    }
  }, [value]);

  // The popover is portaled to <body> (so it escapes every panel's stacking
  // context and overflow), then positioned with fixed coords from the trigger.
  // Flip above the trigger if it would overflow the bottom of the viewport.
  const POP_W = 240, POP_H = withTime ? 340 : 290;
  function place() {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = r.left;
    if (left + POP_W > window.innerWidth - 8) left = window.innerWidth - POP_W - 8;
    if (left < 8) left = 8;
    const below = r.bottom + 6;
    const flip = below + POP_H > window.innerHeight - 8 && r.top - POP_H - 6 > 8;
    const top = flip ? r.top - POP_H - 6 : below;
    setCoords({ top, left });
  }

  // Position when opening, and keep it pinned to the trigger on scroll/resize.
  useEffect(() => {
    if (!open) return;
    place();
    function onMove() { place(); }
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  // Close on outside click or Escape (popover lives in a portal, so check it too)
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (wrapRef.current && wrapRef.current.contains(e.target)) return;
      if (popRef.current && popRef.current.contains(e.target)) return;
      setOpen(false);
    }
    function esc(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("pointerdown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }
  function emit(year, month, day, h, m) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    if (withTime) {
      const hh = String(h).padStart(2, "0");
      const mi = String(m).padStart(2, "0");
      onChange(`${year}-${mm}-${dd}T${hh}:${mi}`);
    } else {
      onChange(`${year}-${mm}-${dd}`);
    }
  }
  function selectDay(day) {
    emit(viewYear, viewMonth, day, hour, minute);
    // With a time field, keep the popover open so the time can still be tweaked.
    if (!withTime) setOpen(false);
  }
  function changeTime(h, m) {
    setHour(h);
    setMinute(m);
    // Re-emit against the chosen day (or today, if none picked yet).
    const base = parsed || { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() };
    emit(base.year, base.month, base.day, h, m);
  }
  function clearDate(e) {
    e.stopPropagation();
    onChange("");
    setOpen(false);
  }

  // Build the day grid for current view month
  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayKey_ = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const displayText = parsed
    ? withTime
      ? `${MONTH_NAMES[parsed.month].slice(0,3)} ${parsed.day}, ${parsed.year} · ${String(parsed.hour).padStart(2,"0")}:${String(parsed.minute).padStart(2,"0")}`
      : `${MONTH_NAMES[parsed.month].slice(0,3)} ${parsed.day}, ${parsed.year}`
    : "";

  const selectedKey = parsed
    ? `${parsed.year}-${String(parsed.month+1).padStart(2,"0")}-${String(parsed.day).padStart(2,"0")}`
    : "";
  const viewKey = (d) => `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  return (
    <div ref={wrapRef} className={`dp-wrap ${small ? "dp-small" : ""} ${className}`} title={title}>
      <button
        type="button"
        className={`dp-trigger ${open ? "dp-trigger--open" : ""} ${!value ? "dp-trigger--empty" : ""}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="dp-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M1 5h10" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </span>
        <span className="dp-value">{displayText || placeholder}</span>
        {value && (
          <span className="dp-clear" onPointerDown={clearDate} title="Clear date">×</span>
        )}
      </button>

      {open && coords && ReactDOM.createPortal(
        <div
          ref={popRef}
          className="dp-popover"
          style={{ top: coords.top, left: coords.left }}
        >
          <div className="dp-header">
            <button type="button" className="dp-nav" onClick={prevMonth}>‹</button>
            <span className="dp-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button type="button" className="dp-nav" onClick={nextMonth}>›</button>
          </div>
          <div className="dp-grid">
            {DAY_NAMES.map(n => <div key={n} className="dp-dayname">{n}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const key = viewKey(d);
              const isToday = key === todayKey_;
              const isSel   = key === selectedKey;
              return (
                <button
                  key={key}
                  type="button"
                  className={`dp-day ${isToday ? "dp-day--today" : ""} ${isSel ? "dp-day--selected" : ""}`}
                  onClick={() => selectDay(d)}
                >
                  {d}
                </button>
              );
            })}
          </div>
          {withTime && (
            <div className="dp-time-row">
              <span className="dp-time-icon" aria-hidden>
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M6 3.2V6l1.8 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <select className="dp-time-select" value={hour} onChange={(e) => changeTime(Number(e.target.value), minute)}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                ))}
              </select>
              <span className="dp-time-colon">:</span>
              <select className="dp-time-select" value={minute} onChange={(e) => changeTime(hour, Number(e.target.value))}>
                {Array.from({ length: 60 }, (_, m) => (
                  <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                ))}
              </select>
              <button type="button" className="dp-done" onClick={() => setOpen(false)}>Done</button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ─── exports to window ─── */

Object.assign(window, {
  ReminderPanel,
  ProjectPanel,
  ReadingPanel,
  ShoppingPanel,
  HabitPanel,
  ChoresPanel,
  GoalsPanel,
  AutoTextarea,
  Chip,
  TaskList,
  EditButton,
  MetaRow,
  formatWhen,
  relTime,
  DatePicker,
});
