const { useState, memo } = React;
const { uid, MS } = window.WhiteboardStore;
const { formatWhen, Chip, EditButton } = window;

// formatWhen() returns { label, rel, overdue, soon }; build a printable string.
function dueText(due) {
  if (!due) return "No date";
  const { label, rel } = formatWhen(due);
  return `${label} · ${rel}`;
}

const DEADLINE_KINDS = ["Course", "Review", "Talk", "Other"];
// Peer-review duties and recommendation letters live on the Research tab
// (ReviewsPanel / LettersPanel); Service tracks institutional service only.
const SERVICE_TYPES = ["Committee", "Editorial", "Other"];

function bucketFor(ts) {
  if (!ts) return "Undated";
  const now = Date.now();
  const diff = ts - now;
  if (diff < 0) return "Overdue";
  if (diff < MS.WEEK) return "This week";
  if (diff < 2 * MS.WEEK) return "Next 2 weeks";
  if (diff < MS.MONTH) return "This month";
  return "Later";
}

const BUCKET_ORDER = ["Overdue", "This week", "Next 2 weeks", "This month", "Later", "Undated"];

function groupByBuckets(items, key = "due") {
  const groups = {};
  BUCKET_ORDER.forEach((b) => (groups[b] = []));
  items.forEach((item) => {
    const bucket = bucketFor(item[key]);
    groups[bucket].push(item);
  });
  return groups;
}

function groupByCourse(items) {
  const groups = {};
  items.forEach((item) => {
    const course = item.course || "Uncategorized";
    if (!groups[course]) groups[course] = [];
    groups[course].push(item);
  });
  return groups;
}

const KIND_COLORS = {
  Course: "oklch(0.64 0.12 248)",
  Review: "oklch(0.7 0.11 70)",
  Talk: "oklch(0.62 0.13 300)",
  Other: "oklch(0.62 0.02 270)",
};

const TYPE_COLORS = {
  Committee: "oklch(0.64 0.1 155)",
  Editorial: "oklch(0.7 0.11 70)",
  Other: "oklch(0.62 0.02 270)",
};

const DeadlinesPanel = memo(function DeadlinesPanel({ items = [], onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [formKind, setFormKind] = useState(DEADLINE_KINDS[0]);
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editKind, setEditKind] = useState(DEADLINE_KINDS[0]);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");

  const grouped = groupByBuckets(items, "due");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    const due = formDate ? new Date(formDate).getTime() : null;
    onChange?.([...items, { id: uid(), kind: formKind, title: formTitle.trim(), due, done: false, createdAt: Date.now() }]);
    setFormTitle("");
    setFormDate("");
    setShowForm(false);
  };

  const toggleDone = (id) => {
    onChange?.(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  };

  const remove = (id) => {
    onChange?.(items.filter((i) => i.id !== id));
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditKind(item.kind);
    setEditTitle(item.title || '');
    setEditDate(item.due ? new Date(item.due).toISOString().slice(0,10) : '');
  };

  const saveEdit = (id) => {
    const due = editDate ? new Date(editDate).getTime() : null;
    onChange?.(items.map((i) => (i.id === id ? { ...i, kind: editKind, title: editTitle.trim(), due } : i)));
    setEditingId(null);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Deadlines</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>
          {showForm ? "×" : "+"}
        </button>
      </div>

      {showForm && (
        <form className="academic-form" onSubmit={handleSubmit}>
          <select className="academic-select" value={formKind} onChange={(e) => setFormKind(e.target.value)}>
            {DEADLINE_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <input
            className="academic-input"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Title"
          />
          <DatePicker className="academic-input" value={formDate} onChange={setFormDate} placeholder="Due date" />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}

      {!items.length && <div className="panel-empty">No deadlines yet</div>}

      <div className="deadline-buckets">
        {BUCKET_ORDER.map((bucket) => {
          const bucketItems = grouped[bucket];
          if (!bucketItems.length) return null;
          return (
            <div key={bucket} className="deadline-bucket">
              <div className="deadline-bucket-title">{bucket}</div>
              {bucketItems.map((item) => (
                <div key={item.id} data-mb-id={item.id} className={"deadline-row" + (item.done ? " done" : "") + (editingId === item.id ? " editing" : "")} style={{ "--row-accent": KIND_COLORS[item.kind] || "var(--line-2)" }}>
                  {editingId === item.id ? (
                    <div className="row-edit">
                      <select className="academic-select" value={editKind} onChange={(e) => setEditKind(e.target.value)}>
                        {DEADLINE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <input className="academic-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" />
                      <DatePicker className="academic-input" value={editDate} onChange={setEditDate} placeholder="Due date" />
                      <div className="row-edit-actions">
                        <button className="panel-text-btn" onClick={() => saveEdit(item.id)}>Save</button>
                        <button className="panel-text-btn" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <input type="checkbox" checked={!!item.done} onChange={() => toggleDone(item.id)} aria-label="Mark done" />
                      <Chip label={item.kind} color={KIND_COLORS[item.kind]} />
                      <div className="deadline-body">
                        <span className="deadline-title">{item.title}</span>
                        <span className="deadline-due">{dueText(item.due)}</span>
                      </div>
                      {onChange && (
                        <>
                          <EditButton onClick={() => startEdit(item)} />
                          <button className="btn-delete" aria-label="Delete" onClick={() => remove(item.id)}>×</button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const SubtaskList = memo(function SubtaskList({ tasks = [], onUpdateTask, onRemoveTask, onAddTask }) {
  const [text, setText] = useState('');

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onAddTask(t);
    setText('');
  };

  return (
    <div className="teaching-task-list">
      <ul className="todo-list">
        {tasks.map((task) => (
          <li key={task.id} className={'teaching-task' + (task.done ? ' done' : '')}>
            <input type="checkbox" checked={!!task.done} onChange={() => onUpdateTask(task.id, { done: !task.done })} aria-label="Mark done" />
            <input
              className="teaching-task-input"
              value={task.title || ''}
              onChange={(e) => onUpdateTask(task.id, { title: e.target.value })}
              placeholder="Untitled task"
            />
            <button className="btn-delete" aria-label="Delete" onClick={() => onRemoveTask(task.id)}>×</button>
          </li>
        ))}
      </ul>
      <div className="teaching-add-row">
        <input
          className="teaching-add-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add task…"
        />
        <button className="teaching-add-btn-icon" aria-label="Add task" onClick={add}>+</button>
      </div>
    </div>
  );
});

const TeachingPanel = memo(function TeachingPanel({ items = [], onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [formCourse, setFormCourse] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formTotal, setFormTotal] = useState(1);
  const [formDone, setFormDone] = useState(0);
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingCourseName, setEditingCourseName] = useState('');

  const grouped = groupByCourse(items);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    onChange?.([
      ...items,
      {
        id: uid(),
        course: formCourse.trim() || "Uncategorized",
        title: formTitle.trim(),
        total: Number(formTotal) || 1,
        done: Number(formDone) || 0,
        createdAt: Date.now(),
      },
    ]);
    setFormCourse("");
    setFormTitle("");
    setFormTotal(1);
    setFormDone(0);
    setShowForm(false);
  };

  const updateItem = (id, patch) => {
    onChange?.(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const remove = (id) => {
    onChange?.(items.filter((i) => i.id !== id));
  };

  const bumpDone = (id, delta) => {
    onChange?.(items.map((i) => {
      if (i.id !== id) return i;
      const total = Math.max(1, Number(i.total) || 1);
      const done = Math.min(total, Math.max(0, (Number(i.done) || 0) + delta));
      return { ...i, done };
    }));
  };

  const renameCourse = (oldCourse, newCourse) => {
    const name = (newCourse || '').trim() || 'Uncategorized';
    if (oldCourse === name) { setEditingCourse(null); setEditingCourseName(''); return; }
    onChange?.(items.map((i) => (i.course === oldCourse ? { ...i, course: name } : i)));
    setEditingCourse(null);
    setEditingCourseName('');
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Teaching</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>
          {showForm ? "×" : "+"}
        </button>
      </div>

      {showForm && (
        <form className="academic-form" onSubmit={handleSubmit}>
          <input
            className="academic-input sm"
            value={formCourse}
            onChange={(e) => setFormCourse(e.target.value)}
            placeholder="Course"
          />
          <input
            className="academic-input"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Task title"
          />
          <input
            type="number"
            min={0}
            className="academic-input sm"
            value={formTotal}
            onChange={(e) => setFormTotal(e.target.value)}
            placeholder="Total"
          />
          <input
            type="number"
            min={0}
            className="academic-input sm"
            value={formDone}
            onChange={(e) => setFormDone(e.target.value)}
            placeholder="Done"
          />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}

      {!items.length && <div className="panel-empty">No teaching tasks yet</div>}

      {Object.keys(grouped).map((course) => {
        const courseItems = grouped[course];
        const totalUnits = courseItems.reduce((s, i) => s + (i.total || 1), 0);
        const doneUnits = courseItems.reduce((s, i) => s + (i.done || 0), 0);
        const pct = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0;

        return (
          <div key={course} className="teaching-course">
            <div className="teaching-course-head">
              {editingCourse === course ? (
                  <div className="teaching-course-rename">
                    <input className="academic-input sm" value={editingCourseName} onChange={(e) => setEditingCourseName(e.target.value)} />
                    <button className="panel-text-btn" onClick={() => renameCourse(course, editingCourseName)}>Save</button>
                    <button className="panel-text-btn" onClick={() => { setEditingCourse(null); setEditingCourseName(''); }}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="course-pill" onDoubleClick={() => { setEditingCourse(course); setEditingCourseName(course); }}>{course}</span>
                    <EditButton onClick={() => { setEditingCourse(course); setEditingCourseName(course); }} title="Rename course" />
                    <span className="teaching-count">
                      <span className="teaching-count-frac">{doneUnits}/{totalUnits}</span>
                      <span className="teaching-count-pct">{pct}%</span>
                    </span>
                  </>
                )}
            </div>
            {editingCourse !== course && (
              <div className="teaching-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="teaching-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            )}
                <div className="teaching-subtasks">
                  <SubtaskList
                    tasks={courseItems}
                    onUpdateTask={(id, patch) => updateItem(id, patch)}
                    onRemoveTask={(id) => remove(id)}
                    onAddTask={(title) => {
                      const newItem = { id: uid(), course, title: title.trim(), total: 1, done: 0, createdAt: Date.now() };
                      onChange?.([...items, newItem]);
                    }}
                  />
                </div>
          </div>
        );
      })}
    </div>
  );
});

const ServicePanel = memo(function ServicePanel({ items = [], onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState(SERVICE_TYPES[0]);
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editType, setEditType] = useState(SERVICE_TYPES[0]);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    const due = formDate ? new Date(formDate).getTime() : null;
    onChange([...items, { id: uid(), type: formType, title: formTitle.trim(), due, createdAt: Date.now() }]);
    setFormTitle("");
    setFormDate("");
    setShowForm(false);
  };

  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditType(item.type);
    setEditTitle(item.title || '');
    setEditDate(item.due ? new Date(item.due).toISOString().slice(0,10) : '');
  };

  const saveEdit = (id) => {
    const due = editDate ? new Date(editDate).getTime() : null;
    onChange(items.map((i) => (i.id === id ? { ...i, type: editType, title: editTitle.trim(), due } : i)));
    setEditingId(null);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Service</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>
          {showForm ? "×" : "+"}
        </button>
      </div>

      {showForm && (
        <form className="academic-form" onSubmit={handleSubmit}>
          <select className="academic-select" value={formType} onChange={(e) => setFormType(e.target.value)}>
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            className="academic-input"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Description"
          />
          <DatePicker className="academic-input" value={formDate} onChange={setFormDate} placeholder="Due date" />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}

      {!items.length && <div className="panel-empty">No service items yet</div>}

      {items.length > 0 && (
        <div className="service-list">
          {items.map((item) => (
            <div
              key={item.id}
              data-mb-id={item.id}
              className="service-card"
              style={{ "--row-accent": TYPE_COLORS[item.type] || "var(--line-2)" }}
            >
              {editingId === item.id ? (
                <div className="service-card-edit">
                  <select className="academic-select" value={editType} onChange={(e) => setEditType(e.target.value)}>
                    {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="academic-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  <DatePicker className="academic-input" value={editDate} onChange={setEditDate} placeholder="Due date" />
                  <div className="service-card-edit-actions">
                    <button className="panel-text-btn" onClick={() => saveEdit(item.id)}>Save</button>
                    <button className="panel-text-btn" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="service-card-top">
                    <Chip label={item.type} color={TYPE_COLORS[item.type]} />
                    <div className="service-card-actions">
                      <EditButton onClick={() => startEdit(item)} />
                      <button className="btn-delete" aria-label="Delete" onClick={() => remove(item.id)}>×</button>
                    </div>
                  </div>
                  <div className="service-title">{item.title}</div>
                  {item.due && <div className="service-due">{dueText(item.due)}</div>}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

Object.assign(window, { DeadlinesPanel, TeachingPanel, ServicePanel });
