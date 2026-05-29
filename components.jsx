const { useState, useRef, useLayoutEffect, memo } = React;
const { uid, dateKey, todayKey, daysBetweenKeys, MS } = window.MyBoardStore;

function safeHref(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url).trim());
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch (_) {}
  return null;
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

  const sorted = [...items].sort((a, b) => new Date(a.when) - new Date(b.when));

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
        <input
          type="datetime-local"
          className="todo-input datetime-input"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
        <button className="btn-add" aria-label="Add" onClick={add}>+</button>
      </div>
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
              <span className="reminder-time">{label} ({rel})</span>
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

/* ─── ProjectPanel ─── */

function renderWikiLinks(text) {
  if (!text) return null;
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[\[(.+)\]\]$/);
    if (m) return <span key={i} className="wiki-link">[[{m[1]}]]</span>;
    return part;
  });
}

function ProjectTaskList({ items, onChange }) {
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
          placeholder="Add task…"
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

const ProjectCard = memo(function ProjectCard({ proj, isOpen, onToggle, onUpdate, onRemove }) {
  const displayName = proj.name || 'New Project';
  const collabCount = (proj.collaborators || []).length;

  return (
    <div data-mb-id={proj.id} className={"project-card" + (isOpen ? " open" : "") + (proj.done ? " done" : "")}>
      <div className="project-title-row">
        <button
          type="button"
          className="expand-icon-btn"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Collapse project' : 'Expand project'}
          onClick={onToggle}
        >
          {isOpen ? '▼' : '▶'}
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
        {!isOpen && collabCount > 0 && (
          <span className="project-collab-count" title={`${collabCount} collaborator${collabCount === 1 ? '' : 's'}`}>
            {collabCount}
          </span>
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
            <ProjectTaskList
              items={proj.myTasks || []}
              onChange={(t) => onUpdate({ myTasks: t })}
            />
          </div>
          <div className="project-section">
            <label>Others' Tasks</label>
            <ProjectTaskList
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
            <div className="wiki-preview">{renderWikiLinks(proj.notes)}</div>
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
      wikiLinks: [],
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
        {(Array.isArray(items) ? items : []).map((proj) => (
          <ProjectCard
            key={proj.id}
            proj={proj}
            isOpen={!!expanded[proj.id]}
            onToggle={() => toggleExpand(proj.id)}
            onUpdate={(patch) => update(proj.id, patch)}
            onRemove={() => remove(proj.id)}
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
            <span className="todo-text">{item.text || '(Untitled)'}</span>
            {safeHref(item.url) && (
              <a className="external-badge" href={safeHref(item.url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                ↗
              </a>
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
                <span className="chore-name">{chore.text}</span>
                <ChoreFreqMenu value={chore.frequency} onChange={(f) => updateFreq(chore.id, f)} />
                <span className="chore-status-badge">{status}</span>
                <button className="btn-chore-done" aria-label="Mark done" onClick={() => markDone(chore.id)}>✓</button>
                {chore.history && chore.history.length > 0 && (
                  <button className="btn-chore-undo" aria-label="Undo last done" onClick={() => undoLast(chore.id)}>↩</button>
                )}
                <button className="btn-delete" aria-label="Delete" onClick={() => remove(chore.id)}>×</button>
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

/* ─── exports to window ─── */

Object.assign(window, {
  ReminderPanel,
  ProjectPanel,
  ReadingPanel,
  ShoppingPanel,
  HabitPanel,
  ChoresPanel,
  formatWhen,
  relTime,
});
