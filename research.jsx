// research.jsx — Research tab panels for Whiteboard.
// Loaded after academic.jsx, before finance.jsx. No imports/exports — globals on window.
// Panels follow the { items, onChange } contract; expandable cards reuse project-card styling.

const { useState, memo } = React;
const { uid, num, safeHref } = window.WhiteboardStore;
const { formatWhen, Chip, MetaRow } = window;

/* ─── shared bits ─── */

// timestamp → ISO date string for DatePicker, and back.
const dateVal = (ts) => (ts ? new Date(ts).toISOString().slice(0, 10) : "");
const toTs = (v) => (v ? new Date(v).getTime() : null);

// due timestamp → printable "Mon D · rel" with overdue/soon flags.
function dueInfo(due, verb = "") {
  if (!due) return { text: "No date", overdue: false, soon: false };
  const { label, rel, overdue, soon } = formatWhen(due);
  return { text: `${verb ? verb + " " : ""}${label} · ${rel}`, overdue, soon };
}

// soonest undone milestone due for an advisee — feeds banners.
function soonestMilestone(student) {
  const dues = (student.milestones || []).filter((m) => !m.done && m.due).map((m) => m.due);
  return dues.length ? Math.min(...dues) : null;
}

// nearest live deadline for a CFP (abstract → paper) — feeds banners.
function nextCfpDeadline(cfp) {
  const now = Date.now();
  const dues = [cfp.abstractDue, cfp.paperDue].filter((d) => d && d >= now);
  return dues.length ? Math.min(...dues) : (cfp.paperDue || cfp.abstractDue || null);
}

window.soonestMilestone = soonestMilestone;
window.nextCfpDeadline = nextCfpDeadline;

/* ─── AdviseesPanel ─── */

const AdviseeCard = memo(function AdviseeCard({ student, isOpen, onToggle, onUpdate, onRemove }) {
  const [mText, setMText] = useState("");
  const [mDue, setMDue] = useState("");

  const milestones = student.milestones || [];
  const next = soonestMilestone(student);
  const meet = dueInfo(student.nextMeeting, "meets");

  const addMilestone = () => {
    const t = mText.trim();
    if (!t) return;
    onUpdate({ milestones: [...milestones, { id: uid(), text: t, due: toTs(mDue), done: false }] });
    setMText("");
    setMDue("");
  };
  const updateMilestone = (id, patch) =>
    onUpdate({ milestones: milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const removeMilestone = (id) => onUpdate({ milestones: milestones.filter((m) => m.id !== id) });

  const nextInfo = dueInfo(next);
  let cls = "grant-card project-card";
  if (isOpen) cls += " open";
  if (student.nextMeeting) {
    if (meet.overdue) cls += " overdue";
    else if (meet.soon) cls += " soon";
  }

  return (
    <div data-mb-id={student.id} className={cls}>
      <div className="project-title-row">
        <button type="button" className="expand-icon-btn" aria-expanded={isOpen} aria-label={isOpen ? "Collapse" : "Expand"} onClick={onToggle}>
          {isOpen ? "▼" : "▶"}
        </button>
        <span
          className="project-name-label grant-title"
          onClick={!isOpen ? onToggle : undefined}
          role={!isOpen ? "button" : undefined}
          tabIndex={!isOpen ? 0 : undefined}
          onKeyDown={!isOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } } : undefined}
        >
          {student.name || "Unnamed advisee"}
          {student.program ? <span className="meta-row-sub"> · {student.program}</span> : null}
        </span>
        {next && <span className="grant-due">{nextInfo.text}</span>}
        <button className="btn-delete" aria-label="Delete" onClick={onRemove}>×</button>
      </div>
      {isOpen && (
        <div className="project-details grant-details">
          <div className="grant-fields">
            <label>Name
              <input className="academic-input" value={student.name || ""} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="Advisee name" />
            </label>
            <label>Program
              <input className="academic-input" value={student.program || ""} onChange={(e) => onUpdate({ program: e.target.value })} placeholder="e.g. PhD, MS, Postdoc" />
            </label>
            <label>Topic
              <input className="academic-input" value={student.topic || ""} onChange={(e) => onUpdate({ topic: e.target.value })} placeholder="Research topic" />
            </label>
            <label>Next meeting
              <DatePicker className="academic-input sm" small value={dateVal(student.nextMeeting)} onChange={(v) => onUpdate({ nextMeeting: toTs(v) })} placeholder="Meeting date" />
            </label>
          </div>
          <div className="grant-heads">
            <div className="grant-heads-label">Milestones</div>
            <div className="todo-input-row">
              <input className="todo-input" value={mText} onChange={(e) => setMText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMilestone()} placeholder="e.g. Comprehensive exam…" />
              <DatePicker className="academic-input sm" small value={mDue} onChange={setMDue} placeholder="Milestone due" />
              <button className="btn-add" aria-label="Add milestone" onClick={addMilestone}>+</button>
            </div>
            {!milestones.length && <div className="panel-empty">No milestones yet</div>}
            <ul className="todo-list">
              {milestones.map((m) => {
                const info = dueInfo(m.due);
                let mcls = "reminder-item";
                if (!m.done && info.overdue) mcls += " overdue";
                else if (!m.done && info.soon) mcls += " soon";
                return (
                  <li key={m.id} className={mcls}>
                    <input type="checkbox" checked={!!m.done} onChange={() => updateMilestone(m.id, { done: !m.done })} />
                    <span className={"todo-text" + (m.done ? " done" : "")}>{m.text}</span>
                    {m.due && <span className="meta-row-when">{info.text}</span>}
                    <button className="btn-delete" aria-label="Delete" onClick={() => removeMilestone(m.id)}>×</button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
});

const AdviseesPanel = memo(function AdviseesPanel({ items = [], onChange }) {
  const [expanded, setExpanded] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [program, setProgram] = useState("");
  const [topic, setTopic] = useState("");

  const add = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const id = uid();
    onChange([...items, { id, name: n, program: program.trim(), topic: topic.trim(), started: "", nextMeeting: null, milestones: [], notes: "", expanded: false, created: Date.now() }]);
    setName(""); setProgram(""); setTopic(""); setShowForm(false);
    setExpanded((p) => ({ ...p, [id]: true }));
  };
  const toggleExpand = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const update = (id, patch) => onChange(items.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id) => {
    onChange(items.filter((s) => s.id !== id));
    setExpanded((p) => { const n = { ...p }; delete n[id]; return n; });
  };

  const sorted = [...items].sort((a, b) => (soonestMilestone(a) || Infinity) - (soonestMilestone(b) || Infinity));

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Advisees</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>{showForm ? "×" : "+"}</button>
      </div>
      {showForm && (
        <form className="academic-form" onSubmit={add}>
          <input className="academic-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Advisee name" />
          <input className="academic-input sm" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="Program" />
          <input className="academic-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}
      {!items.length && <div className="panel-empty">No advisees yet</div>}
      <div className="grant-list">
        {sorted.map((s) => (
          <AdviseeCard key={s.id} student={s} isOpen={!!expanded[s.id]} onToggle={() => toggleExpand(s.id)} onUpdate={(patch) => update(s.id, patch)} onRemove={() => remove(s.id)} />
        ))}
      </div>
    </div>
  );
});

/* ─── SubmissionsPanel ─── */

const SUB_STAGES = ["drafting", "submitted", "under review", "revision", "accepted", "camera ready", "published", "rejected"];
const SUB_STAGE_LABEL = { drafting: "Drafting", submitted: "Submitted", "under review": "Under review", revision: "Revision", accepted: "Accepted", "camera ready": "Camera ready", published: "Published", rejected: "Rejected" };
const SUB_STAGE_COLOR = {
  drafting: "oklch(0.62 0.02 270)",
  submitted: "oklch(0.64 0.12 248)",
  "under review": "oklch(0.7 0.13 60)",
  revision: "oklch(0.62 0.13 300)",
  accepted: "oklch(0.64 0.1 155)",
  "camera ready": "oklch(0.66 0.12 175)",
  published: "oklch(0.6 0.13 145)",
  rejected: "oklch(0.64 0.14 30)",
};

// What the `decisionDue` date means depends on the stage, so the banner and the
// panel can label it honestly instead of always calling it a "decision": while
// drafting it's the submission deadline; once submitted/under review you're
// awaiting a decision; in revision it's the revision due date.
const SUB_DUE_NOUN = { drafting: "submission", submitted: "decision", "under review": "decision", revision: "revision" };
const submissionDueNoun = (stage) => SUB_DUE_NOUN[stage] || "decision";
window.submissionDueNoun = submissionDueNoun;

// The preposition that ties the noun to its venue, so the banner reads naturally:
// "submission to ICML", "decision from NeurIPS", "revision for TPAMI".
const SUB_DUE_PREP = { submission: "to", decision: "from", revision: "for" };
function submissionBannerText(s) {
  const noun = submissionDueNoun(s.stage);
  const venue = (s.venue || "").trim();
  const prep = SUB_DUE_PREP[noun];
  return `${s.title} ${noun}${venue && prep ? ` ${prep} ${venue}` : ""}`;
}
window.submissionBannerText = submissionBannerText;

const SubmissionsPanel = memo(function SubmissionsPanel({ items = [], onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [decisionDue, setDecisionDue] = useState("");
  const [stage, setStage] = useState("drafting");
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => { setTitle(""); setVenue(""); setSubmitted(""); setDecisionDue(""); setStage("drafting"); setEditingId(null); setShowForm(false); };

  const add = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const fields = { title: t, venue: venue.trim(), stage, submitted: toTs(submitted), decisionDue: toTs(decisionDue) };
    if (editingId) {
      onChange(items.map((i) => (i.id === editingId ? { ...i, ...fields } : i)));
    } else {
      onChange([...items, { id: uid(), ...fields, link: "", created: Date.now() }]);
    }
    resetForm();
  };
  const startEdit = (s) => { setEditingId(s.id); setShowForm(true); setTitle(s.title || ""); setVenue(s.venue || ""); setStage(s.stage || "drafting"); setSubmitted(dateVal(s.submitted)); setDecisionDue(dateVal(s.decisionDue)); };
  const cycleStage = (id) => onChange(items.map((i) => (i.id === id ? { ...i, stage: SUB_STAGES[(SUB_STAGES.indexOf(i.stage) + 1) % SUB_STAGES.length] } : i)));
  const remove = (id) => { if (id === editingId) resetForm(); onChange(items.filter((i) => i.id !== id)); };

  const order = Object.fromEntries(SUB_STAGES.map((s, i) => [s, i]));
  const sorted = [...items].sort((a, b) => (order[a.stage] ?? 9) - (order[b.stage] ?? 9));

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Paper Submissions</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => (showForm ? resetForm() : setShowForm(true))}>{showForm ? "×" : "+"}</button>
      </div>
      {showForm && (
        <form className="academic-form" onSubmit={add}>
          <input className="academic-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Paper title" />
          <input className="academic-input sm" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" />
          <select className="academic-input sm" value={stage} onChange={(e) => setStage(e.target.value)} title="Stage">
            {SUB_STAGES.map((st) => <option key={st} value={st}>{SUB_STAGE_LABEL[st]}</option>)}
          </select>
          <DatePicker className="academic-input sm" small value={submitted} onChange={setSubmitted} title="Submitted on" placeholder="Submitted on" />
          <DatePicker className="academic-input sm" small value={decisionDue} onChange={setDecisionDue} title="Notification date" placeholder="Notification due" />
          <button type="submit" className="academic-submit">{editingId ? "Save" : "Add"}</button>
        </form>
      )}
      {!items.length && <div className="panel-empty">No submissions yet</div>}
      <div className="meta-list">
        {sorted.map((s) => {
          const closed = s.stage === "accepted" || s.stage === "camera ready" || s.stage === "published" || s.stage === "rejected";
          const showDue = s.decisionDue && !closed;
          const info = dueInfo(s.decisionDue, submissionDueNoun(s.stage));
          return (
            <MetaRow
              key={s.id}
              id={s.id}
              state={showDue && info.overdue ? "overdue" : showDue && info.soon ? "soon" : ""}
              lead={
                <button className="reimb-status-btn" onClick={() => cycleStage(s.id)} title="Click to advance stage" style={{ "--chip": SUB_STAGE_COLOR[s.stage] }}>
                  {SUB_STAGE_LABEL[s.stage]}
                </button>
              }
              title={s.title}
              sub={<>
                {s.venue ? <span className="meta-row-sub"> · {s.venue}</span> : null}
                {s.submitted ? <span className="meta-row-sub"> · submitted {dateVal(s.submitted)}</span> : null}
              </>}
              when={showDue ? info.text : null}
              onEdit={() => startEdit(s)}
              onDelete={() => remove(s.id)}
            />
          );
        })}
      </div>
    </div>
  );
});

/* ─── ProposalsPanel ─── */

const PROP_STATUS = ["drafting", "submitted", "awarded", "declined"];
const PROP_STATUS_LABEL = { drafting: "Drafting", submitted: "Submitted", awarded: "Awarded", declined: "Declined" };
const PROP_STATUS_COLOR = {
  drafting: "oklch(0.62 0.02 270)",
  submitted: "oklch(0.64 0.12 248)",
  awarded: "oklch(0.64 0.1 155)",
  declined: "oklch(0.64 0.14 30)",
};

const ProposalsPanel = memo(function ProposalsPanel({ items = [], onChange, currency = "₹" }) {
  const { formatMoney } = window.WhiteboardStore;
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [agency, setAgency] = useState("");
  const [amount, setAmount] = useState("");
  const [callDeadline, setCallDeadline] = useState("");

  const add = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onChange([...items, { id: uid(), title: t, agency: agency.trim(), callDeadline: toTs(callDeadline), amount: num(amount), status: "drafting", created: Date.now() }]);
    setTitle(""); setAgency(""); setAmount(""); setCallDeadline(""); setShowForm(false);
  };
  const cycleStatus = (id) => onChange(items.map((i) => (i.id === id ? { ...i, status: PROP_STATUS[(PROP_STATUS.indexOf(i.status) + 1) % PROP_STATUS.length] } : i)));
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  const sorted = [...items].sort((a, b) => (a.callDeadline || Infinity) - (b.callDeadline || Infinity));

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Grant Proposals</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>{showForm ? "×" : "+"}</button>
      </div>
      {showForm && (
        <form className="academic-form" onSubmit={add}>
          <input className="academic-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Proposal title" />
          <input className="academic-input sm" value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="Agency" />
          <input className="academic-input sm" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
          <DatePicker className="academic-input sm" small value={callDeadline} onChange={setCallDeadline} title="Call deadline" placeholder="Call deadline" />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}
      {!items.length && <div className="panel-empty">No proposals yet</div>}
      <div className="meta-list">
        {sorted.map((p) => {
          const open = p.status === "drafting" || p.status === "submitted";
          const showDue = p.callDeadline && open;
          const info = dueInfo(p.callDeadline);
          return (
            <MetaRow
              key={p.id}
              id={p.id}
              state={showDue && info.overdue ? "overdue" : showDue && info.soon ? "soon" : ""}
              lead={
                <button className="reimb-status-btn" onClick={() => cycleStatus(p.id)} title="Click to advance status" style={{ "--chip": PROP_STATUS_COLOR[p.status] }}>
                  {PROP_STATUS_LABEL[p.status]}
                </button>
              }
              title={p.title}
              sub={p.agency ? <span className="meta-row-sub"> · {p.agency}</span> : null}
              when={showDue ? info.text : null}
              value={num(p.amount) > 0 ? formatMoney(p.amount, currency) : null}
              onDelete={() => remove(p.id)}
            />
          );
        })}
      </div>
    </div>
  );
});

/* ─── CFPPanel ─── */

const CFPPanel = memo(function CFPPanel({ items = [], onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [abstractDue, setAbstractDue] = useState("");
  const [paperDue, setPaperDue] = useState("");

  const add = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    onChange([...items, { id: uid(), name: n, abstractDue: toTs(abstractDue), paperDue: toTs(paperDue), notifyDate: null, link: "", created: Date.now() }]);
    setName(""); setAbstractDue(""); setPaperDue(""); setShowForm(false);
  };
  const update = (id, patch) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  const sorted = [...items].sort((a, b) => (nextCfpDeadline(a) || Infinity) - (nextCfpDeadline(b) || Infinity));

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Calls for Papers</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>{showForm ? "×" : "+"}</button>
      </div>
      {showForm && (
        <form className="academic-form" onSubmit={add}>
          <input className="academic-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Conference / journal" />
          <DatePicker className="academic-input sm" small value={abstractDue} onChange={setAbstractDue} title="Abstract due" placeholder="Abstract due" />
          <DatePicker className="academic-input sm" small value={paperDue} onChange={setPaperDue} title="Full paper due" placeholder="Full paper due" />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}
      {!items.length && <div className="panel-empty">No calls tracked yet</div>}
      <div className="meta-list">
        {sorted.map((c) => {
          const live = nextCfpDeadline(c);
          const info = dueInfo(live);
          const which = live && live === c.abstractDue ? "abstract" : live ? "paper" : "";
          return (
            <MetaRow
              key={c.id}
              id={c.id}
              state={info.overdue ? "overdue" : info.soon ? "soon" : ""}
              chip={which ? <Chip label={which} color="var(--muted)" /> : null}
              title={c.name}
              when={live ? info.text : null}
              onDelete={() => remove(c.id)}
            />
          );
        })}
      </div>
    </div>
  );
});

/* ─── ReviewsPanel ─── */

const ReviewsPanel = memo(function ReviewsPanel({ items = [], onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [venue, setVenue] = useState("");
  const [paper, setPaper] = useState("");
  const [due, setDue] = useState("");

  const add = (e) => {
    e.preventDefault();
    const v = venue.trim();
    if (!v) return;
    onChange([...items, { id: uid(), venue: v, paper: paper.trim(), due: toTs(due), done: false, created: Date.now() }]);
    setVenue(""); setPaper(""); setDue(""); setShowForm(false);
  };
  const toggle = (id) => onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  const sorted = [...items].sort((a, b) => (a.done - b.done) || ((a.due || Infinity) - (b.due || Infinity)));

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Review Duties</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>{showForm ? "×" : "+"}</button>
      </div>
      {showForm && (
        <form className="academic-form" onSubmit={add}>
          <input className="academic-input sm" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" />
          <input className="academic-input" value={paper} onChange={(e) => setPaper(e.target.value)} placeholder="Paper / ID" />
          <DatePicker className="academic-input sm" small value={due} onChange={setDue} title="Review due" placeholder="Review due" />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}
      {!items.length && <div className="panel-empty">No reviews pending</div>}
      <ul className="todo-list">
        {sorted.map((r) => {
          const info = dueInfo(r.due);
          let cls = "reminder-item";
          if (!r.done && info.overdue) cls += " overdue";
          else if (!r.done && info.soon) cls += " soon";
          return (
            <li key={r.id} data-mb-id={r.id} className={cls}>
              <input type="checkbox" checked={!!r.done} onChange={() => toggle(r.id)} />
              <span className={"todo-text" + (r.done ? " done" : "")}>
                {r.venue}{r.paper ? <span className="meta-row-sub"> · {r.paper}</span> : null}
              </span>
              {r.due && <span className="meta-row-when">{info.text}</span>}
              <button className="btn-delete" aria-label="Delete" onClick={() => remove(r.id)}>×</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/* ─── LettersPanel ─── */

const LettersPanel = memo(function LettersPanel({ items = [], onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [student, setStudent] = useState("");
  const [purpose, setPurpose] = useState("");
  const [due, setDue] = useState("");

  const add = (e) => {
    e.preventDefault();
    const s = student.trim();
    if (!s) return;
    onChange([...items, { id: uid(), student: s, purpose: purpose.trim(), due: toTs(due), done: false, created: Date.now() }]);
    setStudent(""); setPurpose(""); setDue(""); setShowForm(false);
  };
  const toggle = (id) => onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  const sorted = [...items].sort((a, b) => (a.done - b.done) || ((a.due || Infinity) - (b.due || Infinity)));

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Recommendation Letters</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>{showForm ? "×" : "+"}</button>
      </div>
      {showForm && (
        <form className="academic-form" onSubmit={add}>
          <input className="academic-input sm" value={student} onChange={(e) => setStudent(e.target.value)} placeholder="For whom" />
          <input className="academic-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose / program" />
          <DatePicker className="academic-input sm" small value={due} onChange={setDue} title="Letter due" placeholder="Letter due" />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}
      {!items.length && <div className="panel-empty">No letters pending</div>}
      <ul className="todo-list">
        {sorted.map((l) => {
          const info = dueInfo(l.due);
          let cls = "reminder-item";
          if (!l.done && info.overdue) cls += " overdue";
          else if (!l.done && info.soon) cls += " soon";
          return (
            <li key={l.id} data-mb-id={l.id} className={cls}>
              <input type="checkbox" checked={!!l.done} onChange={() => toggle(l.id)} />
              <span className={"todo-text" + (l.done ? " done" : "")}>
                {l.student}{l.purpose ? <span className="meta-row-sub"> · {l.purpose}</span> : null}
              </span>
              {l.due && <span className="meta-row-when">{info.text}</span>}
              <button className="btn-delete" aria-label="Delete" onClick={() => remove(l.id)}>×</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/* ─── ContactsPanel ─── */

const ContactsPanel = memo(function ContactsPanel({ items = [], onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAffiliation, setEditAffiliation] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWebsite, setEditWebsite] = useState("");

  const add = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    onChange([...items, { id: uid(), name: n, affiliation: affiliation.trim(), email: email.trim(), website: website.trim(), note: "", created: Date.now() }]);
    setName(""); setAffiliation(""); setEmail(""); setWebsite(""); setShowForm(false);
  };
  const startEdit = (c) => { setEditingId(c.id); setEditName(c.name || ""); setEditAffiliation(c.affiliation || ""); setEditEmail(c.email || ""); setEditWebsite(c.website || ""); };
  const saveEdit = (id) => {
    const n = editName.trim();
    if (n) onChange(items.map((i) => (i.id === id ? { ...i, name: n, affiliation: editAffiliation.trim(), email: editEmail.trim(), website: editWebsite.trim() } : i)));
    setEditingId(null);
  };
  const remove = (id) => { if (id === editingId) setEditingId(null); onChange(items.filter((i) => i.id !== id)); };

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Collaborators &amp; Contacts</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>{showForm ? "×" : "+"}</button>
      </div>
      {showForm && (
        <form className="academic-form" onSubmit={add}>
          <input className="academic-input sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <input className="academic-input sm" value={affiliation} onChange={(e) => setAffiliation(e.target.value)} placeholder="Affiliation" />
          <input className="academic-input sm" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className="academic-input sm" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}
      {!items.length && <div className="panel-empty">No contacts yet</div>}
      <div className="meta-list">
        {items.map((c) => (
          <MetaRow
            key={c.id}
            id={c.id}
            className="contact-item"
            title={c.name}
            sub={c.affiliation ? <span className="meta-row-sub"> · {c.affiliation}</span> : null}
            extra={<>
              {c.email && (
                <a className="contact-icon" href={"mailto:" + encodeURIComponent(c.email).replace(/%40/g, "@")} title={c.email} aria-label={"Email " + c.name}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </a>
              )}
              {safeHref(c.website) && (
                <a className="contact-icon" href={safeHref(c.website)} target="_blank" rel="noopener noreferrer" title={c.website} aria-label={c.name + " website"}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </a>
              )}
            </>}
            onEdit={() => startEdit(c)}
            onDelete={() => remove(c.id)}
            editing={editingId === c.id ? (
              <div className="row-edit">
                <input className="academic-input" value={editName} autoFocus onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
                <input className="academic-input" value={editAffiliation} onChange={(e) => setEditAffiliation(e.target.value)} placeholder="Affiliation" />
                <input className="academic-input" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" />
                <input className="academic-input" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="Website" />
                <div className="row-edit-actions">
                  <button className="panel-text-btn" onClick={() => saveEdit(c.id)}>Save</button>
                  <button className="panel-text-btn" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : null}
          />
        ))}
      </div>
    </div>
  );
});

/* ─── TimetablePanel ─── (weekly grid, used on the Academic tab) */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TimetablePanel = memo(function TimetablePanel({ items = [], onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("Mon");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");

  const add = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onChange([...items, { id: uid(), title: t, day, start: start.trim(), end: end.trim(), location: location.trim(), created: Date.now() }]);
    setTitle(""); setStart(""); setEnd(""); setLocation("");
    setShowForm(false);
  };
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  const byDay = (d) => items.filter((s) => s.day === d).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  const activeDays = WEEKDAYS.filter((d) => byDay(d).length);

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Weekly Timetable</span>
        <button className="academic-add-btn" aria-label={showForm ? "Cancel" : "Add"} onClick={() => setShowForm(!showForm)}>{showForm ? "×" : "+"}</button>
      </div>
      {showForm && (
        <form className="academic-form" onSubmit={add}>
          <input className="academic-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Class / activity" />
          <select className="academic-select" value={day} onChange={(e) => setDay(e.target.value)}>
            {WEEKDAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input className="academic-input sm" type="time" value={start} onChange={(e) => setStart(e.target.value)} title="Start" />
          <input className="academic-input sm" type="time" value={end} onChange={(e) => setEnd(e.target.value)} title="End" />
          <input className="academic-input sm" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room" />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}
      {!items.length && <div className="panel-empty">No classes scheduled</div>}
      <div className="timetable">
        {activeDays.map((d) => (
          <div key={d} className="timetable-day">
            <div className="timetable-day-name">{d}</div>
            <ul className="timetable-slots">
              {byDay(d).map((s) => (
                <li key={s.id} data-mb-id={s.id} className="timetable-slot">
                  <span className="timetable-time">{s.start || "—"}{s.end ? `–${s.end}` : ""}</span>
                  <span className="timetable-course">{s.title}</span>
                  {s.location && <span className="timetable-room">{s.location}</span>}
                  <button className="btn-delete" aria-label="Delete" onClick={() => remove(s.id)}>×</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
});

/* ─── exports to window ─── */

Object.assign(window, {
  AdviseesPanel,
  SubmissionsPanel,
  ProposalsPanel,
  CFPPanel,
  ReviewsPanel,
  LettersPanel,
  ContactsPanel,
  TimetablePanel,
});
