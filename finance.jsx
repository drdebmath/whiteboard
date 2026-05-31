// finance.jsx — Finance tab panels for Whiteboard.
// Loaded after academic.jsx, before app.jsx. No imports/exports — globals on window.
// Panels follow the { items, onChange, currency } contract.

const { useState, useEffect, useRef, memo } = React;
const { uid, num, formatMoney } = window.WhiteboardStore;
const { formatWhen, Chip } = window;

/* ─── shared bits ─── */

// Bill due → printable "Mon D · rel" with overdue/soon flags.
function dueInfo(due) {
  if (!due) return { text: "No date", overdue: false, soon: false };
  const { label, rel, overdue, soon } = formatWhen(due);
  return { text: `${label} · ${rel}`, overdue, soon };
}

// Number field that keeps its own text while focused and commits on blur/Enter,
// so per-keystroke edits don't spam the undo stack or trigger a sync each keypress.
function MoneyInput({ value, onCommit, placeholder, className = "" }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : String(value));
  }, [value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      className={"money-input " + className}
      value={text}
      placeholder={placeholder}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { focused.current = false; onCommit(num(text)); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
    />
  );
}

/* ─── GrantPanel ─── */

// Grant expiry → printable "Mon D · rel" with expired/soon flags.
function grantExpiryInfo(expiry) {
  if (!expiry) return { text: "No end date", overdue: false, soon: false };
  const { label, rel, overdue, soon } = formatWhen(expiry);
  return { text: `${overdue ? "ended" : "ends"} ${label} · ${rel}`, overdue, soon };
}

const GrantCard = memo(function GrantCard({ grant, isOpen, onToggle, onUpdate, onRemove, currency }) {
  const [headName, setHeadName] = useState("");
  const [headAmount, setHeadAmount] = useState("");

  const heads = grant.heads || [];
  const totalN = num(grant.total);
  const advanceN = num(grant.advance);
  const allocated = heads.reduce((s, h) => s + num(h.amount), 0);
  const spentTotal = heads.reduce((s, h) => s + num(h.spent), 0);
  const remaining = totalN - spentTotal;
  const unallocated = totalN - allocated;
  const exp = grantExpiryInfo(grant.expiry);

  const addHead = () => {
    const n = headName.trim();
    if (!n) return;
    onUpdate({ heads: [...heads, { id: uid(), name: n, amount: num(headAmount), spent: 0 }] });
    setHeadName("");
    setHeadAmount("");
  };
  const updateHead = (id, patch) => onUpdate({ heads: heads.map((h) => (h.id === id ? { ...h, ...patch } : h)) });
  const removeHead = (id) => onUpdate({ heads: heads.filter((h) => h.id !== id) });

  let cls = "grant-card project-card";
  if (isOpen) cls += " open";
  if (exp.overdue) cls += " overdue";
  else if (exp.soon) cls += " soon";

  return (
    <div data-mb-id={grant.id} className={cls}>
      <div className="project-title-row">
        <button
          type="button"
          className="expand-icon-btn"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse grant" : "Expand grant"}
          onClick={onToggle}
        >
          {isOpen ? "▼" : "▶"}
        </button>
        <span
          className="project-name-label grant-title"
          onClick={!isOpen ? onToggle : undefined}
          role={!isOpen ? "button" : undefined}
          tabIndex={!isOpen ? 0 : undefined}
          onKeyDown={!isOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } } : undefined}
        >
          {grant.title || "Untitled grant"}
        </span>
        <span className="grant-remaining money" title="Remaining after spending">{formatMoney(remaining, currency)}</span>
        <span className="grant-due">{exp.text}</span>
        <button className="btn-delete" aria-label="Delete" onClick={onRemove}>×</button>
      </div>
      {isOpen && (
        <div className="project-details grant-details">
          <div className="grant-fields">
            <label>Title
              <input
                className="academic-input"
                value={grant.title || ""}
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="Grant name / agency"
              />
            </label>
            <label>Total grant
              <MoneyInput value={grant.total} onCommit={(v) => onUpdate({ total: v })} className="grant-input" />
            </label>
            <label>Advance taken
              <MoneyInput value={grant.advance} onCommit={(v) => onUpdate({ advance: v })} className="grant-input" />
            </label>
            <label>End date
              <DatePicker className="academic-input sm" small value={grant.expiry ? new Date(grant.expiry).toISOString().slice(0, 10) : ""} onChange={(v) => onUpdate({ expiry: v ? new Date(v).getTime() : null })} />
            </label>
          </div>
          <div className="grant-summary">
            <span>Spent {formatMoney(spentTotal, currency)}</span>
            <span>Remaining {formatMoney(remaining, currency)}</span>
            <span>Advance {formatMoney(advanceN, currency)}</span>
            <span className={unallocated < 0 ? "money-neg" : ""}>Unallocated {formatMoney(unallocated, currency)}</span>
          </div>
          <div className="grant-heads">
            <div className="grant-heads-label">Budget heads</div>
            <div className="todo-input-row">
              <input
                className="todo-input"
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addHead()}
                placeholder="e.g. Travel, Contingency, Equipment…"
              />
              <input
                className="todo-input money-input"
                type="number"
                inputMode="decimal"
                value={headAmount}
                onChange={(e) => setHeadAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addHead()}
                placeholder="Amount"
              />
              <button className="btn-add" aria-label="Add budget head" onClick={addHead}>+</button>
            </div>
            {!heads.length && <div className="panel-empty">No budget heads yet</div>}
            <ul className="grant-head-list">
              {heads.map((h) => {
                const amountN = num(h.amount);
                const spentN = num(h.spent);
                const pct = amountN > 0 ? Math.min(100, Math.round((spentN / amountN) * 100)) : 0;
                const over = amountN > 0 && spentN > amountN;
                return (
                  <li key={h.id} className={"grant-head-item" + (over ? " over" : "")}>
                    <div className="grant-head-top">
                      <span className="grant-head-name">{h.name}</span>
                      <span className="grant-head-figures">
                        <label className="grant-head-field">Spent <MoneyInput value={h.spent} onCommit={(v) => updateHead(h.id, { spent: v })} className="grant-head-amount" /></label>
                        <span className="grant-head-sep">of</span>
                        <label className="grant-head-field"><MoneyInput value={h.amount} onCommit={(v) => updateHead(h.id, { amount: v })} className="grant-head-amount" /></label>
                      </span>
                      <button className="btn-delete" aria-label="Delete" onClick={() => removeHead(h.id)}>×</button>
                    </div>
                    <div className="budget-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className={"budget-bar-fill" + (over ? " over" : "")} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            {heads.length > 0 && (
              <div className="grant-summary">
                <span>Spent {formatMoney(spentTotal, currency)}</span>
                <span>Allocated {formatMoney(allocated, currency)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

const GrantPanel = memo(function GrantPanel({ items = [], onChange, currency = "₹" }) {
  const [expanded, setExpanded] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [advance, setAdvance] = useState("");
  const [expiry, setExpiry] = useState("");

  const add = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const id = uid();
    onChange([
      ...items,
      { id, title: t, total: num(total), advance: num(advance), expiry: expiry ? new Date(expiry).getTime() : null, heads: [], created: Date.now() },
    ]);
    setTitle("");
    setTotal("");
    setAdvance("");
    setExpiry("");
    setShowForm(false);
    setExpanded((p) => ({ ...p, [id]: true }));
  };
  const toggleExpand = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const update = (id, patch) => onChange(items.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const remove = (id) => {
    onChange(items.filter((g) => g.id !== id));
    setExpanded((p) => { const n = { ...p }; delete n[id]; return n; });
  };

  const totalGrant = items.reduce((s, g) => s + num(g.total), 0);
  const totalRemaining = items.reduce(
    (s, g) => s + (num(g.total) - (g.heads || []).reduce((hs, h) => hs + num(h.spent), 0)),
    0
  );

  const sorted = [...items].sort((a, b) => (a.expiry || Infinity) - (b.expiry || Infinity));

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Grants</span>
        <button className="academic-add-btn" onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add"}</button>
      </div>
      {showForm && (
        <form className="academic-form" onSubmit={add}>
          <input className="academic-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Grant name / agency" />
          <input className="academic-input sm" type="number" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Total" />
          <input className="academic-input sm" type="number" inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="Advance" />
          <DatePicker className="academic-input sm" small value={expiry} onChange={setExpiry} title="End date" />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}
      {!items.length && <div className="panel-empty">No grants yet</div>}
      {items.length > 0 && (
        <div className="fin-summary">
          <span>Remaining {formatMoney(totalRemaining, currency)}</span>
          <span>of {formatMoney(totalGrant, currency)}</span>
        </div>
      )}
      <div className="grant-list">
        {sorted.map((g) => (
          <GrantCard
            key={g.id}
            grant={g}
            isOpen={!!expanded[g.id]}
            onToggle={() => toggleExpand(g.id)}
            onUpdate={(patch) => update(g.id, patch)}
            onRemove={() => remove(g.id)}
            currency={currency}
          />
        ))}
      </div>
    </div>
  );
});

/* ─── BillsPanel ─── */

const BILL_CADENCES = [
  { value: "weekly", label: "Weekly", perMonth: 52 / 12 },
  { value: "monthly", label: "Monthly", perMonth: 1 },
  { value: "quarterly", label: "Quarterly", perMonth: 1 / 3 },
  { value: "yearly", label: "Yearly", perMonth: 1 / 12 },
];
const CADENCE_LABEL = Object.fromEntries(BILL_CADENCES.map((c) => [c.value, c.label]));

const BillsPanel = memo(function BillsPanel({ items = [], onChange, currency = "₹" }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState("monthly");
  const [due, setDue] = useState("");

  const add = () => {
    const n = name.trim();
    if (!n) return;
    onChange([
      ...items,
      { id: uid(), name: n, amount: num(amount), cadence, due: due ? new Date(due).getTime() : null, created: Date.now() },
    ]);
    setName("");
    setAmount("");
    setCadence("monthly");
    setDue("");
  };
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  const monthlyTotal = items.reduce((s, i) => {
    const f = BILL_CADENCES.find((c) => c.value === i.cadence);
    return s + num(i.amount) * (f ? f.perMonth : 1);
  }, 0);

  const sorted = [...items].sort((a, b) => (a.due || Infinity) - (b.due || Infinity));

  return (
    <div className="panel">
      <div className="panel-header">Bills &amp; Subscriptions</div>
      <form className="academic-form" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="academic-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <input className="academic-input sm" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
        <select className="academic-select" value={cadence} onChange={(e) => setCadence(e.target.value)}>
          {BILL_CADENCES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <DatePicker className="academic-input sm" small value={due} onChange={setDue} />
        <button type="submit" className="academic-submit">Add</button>
      </form>
      {!items.length && <div className="panel-empty">No bills yet</div>}
      {items.length > 0 && (
        <div className="fin-summary">
          <span>Monthly total</span>
          <span className="money">{formatMoney(monthlyTotal, currency)}</span>
        </div>
      )}
      <ul className="todo-list bills-list">
        {sorted.map((b) => {
          const { text, overdue, soon } = dueInfo(b.due);
          let cls = "bill-item";
          if (overdue) cls += " overdue";
          else if (soon) cls += " soon";
          return (
            <li key={b.id} data-mb-id={b.id} className={cls}>
              <span className="bill-name">{b.name}</span>
              <Chip label={CADENCE_LABEL[b.cadence] || b.cadence} color="var(--muted)" />
              <span className="bill-amount money">{formatMoney(b.amount, currency)}</span>
              <span className="bill-due">{text}</span>
              <button className="btn-delete" aria-label="Delete" onClick={() => remove(b.id)}>×</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/* ─── ReimbursementPanel ─── */

const REIMB_STATUS = ["pending", "claimed", "received"];
const REIMB_STATUS_LABEL = { pending: "Pending", claimed: "Claimed", received: "Received" };
const REIMB_STATUS_COLOR = {
  pending: "oklch(0.7 0.13 60)",   // amber
  claimed: "oklch(0.64 0.12 248)", // blue
  received: "oklch(0.64 0.1 155)", // green
};

const ReimbursementPanel = memo(function ReimbursementPanel({ items = [], onChange, currency = "₹" }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [party, setParty] = useState("");
  const [due, setDue] = useState("");

  const add = () => {
    const t = title.trim();
    if (!t) return;
    onChange([
      ...items,
      { id: uid(), title: t, amount: num(amount), party: party.trim(), status: "pending", due: due ? new Date(due).getTime() : null, created: Date.now() },
    ]);
    setTitle("");
    setAmount("");
    setParty("");
    setDue("");
  };
  const cycleStatus = (id) =>
    onChange(items.map((i) => (i.id === id ? { ...i, status: REIMB_STATUS[(REIMB_STATUS.indexOf(i.status) + 1) % REIMB_STATUS.length] } : i)));
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  const outstanding = items.filter((i) => i.status !== "received").reduce((s, i) => s + num(i.amount), 0);
  const order = { pending: 0, claimed: 1, received: 2 };
  const sorted = [...items].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

  return (
    <div className="panel">
      <div className="panel-header">Reimbursements &amp; Claims</div>
      <form className="academic-form" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="academic-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What for…" />
        <input className="academic-input sm" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
        <input className="academic-input sm" value={party} onChange={(e) => setParty(e.target.value)} placeholder="From" />
        <DatePicker className="academic-input sm" small value={due} onChange={setDue} title="Due date" />
        <button type="submit" className="academic-submit">Add</button>
      </form>
      {!items.length && <div className="panel-empty">No claims yet</div>}
      {items.length > 0 && (
        <div className="fin-summary">
          <span>Outstanding</span>
          <span className="money">{formatMoney(outstanding, currency)}</span>
        </div>
      )}
      <ul className="todo-list reimb-list">
        {sorted.map((r) => {
          const showDue = r.due && r.status !== "received";
          const { text: dueText, overdue, soon } = dueInfo(r.due);
          let cls = "reimb-item status-" + r.status;
          if (showDue && overdue) cls += " overdue";
          else if (showDue && soon) cls += " soon";
          return (
            <li key={r.id} data-mb-id={r.id} className={cls}>
              <button
                className="reimb-status-btn"
                onClick={() => cycleStatus(r.id)}
                title="Click to advance status"
                style={{ "--chip": REIMB_STATUS_COLOR[r.status] }}
              >
                {REIMB_STATUS_LABEL[r.status]}
              </button>
              <span className="reimb-title">
                {r.title}
                {r.party ? <span className="reimb-party"> · {r.party}</span> : null}
              </span>
              {showDue && <span className="reimb-due">{dueText}</span>}
              <span className="reimb-amount money">{formatMoney(r.amount, currency)}</span>
              <button className="btn-delete" aria-label="Delete" onClick={() => remove(r.id)}>×</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/* ─── SavingsPanel ─── */

const SavingsPanel = memo(function SavingsPanel({ items = [], onChange, currency = "₹" }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");

  const add = () => {
    const n = name.trim();
    if (!n) return;
    onChange([...items, { id: uid(), name: n, target: num(target), current: 0, created: Date.now() }]);
    setName("");
    setTarget("");
  };
  const update = (id, patch) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  const totalCurrent = items.reduce((s, i) => s + num(i.current), 0);
  const totalTarget = items.reduce((s, i) => s + num(i.target), 0);

  return (
    <div className="panel">
      <div className="panel-header">Savings Goals</div>
      <div className="todo-input-row">
        <input
          className="todo-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="e.g. Emergency fund…"
        />
        <input
          className="todo-input money-input"
          type="number"
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Target"
        />
        <button className="btn-add" aria-label="Add savings goal" onClick={add}>+</button>
      </div>
      {!items.length && <div className="panel-empty">No savings goals yet</div>}
      {items.length > 0 && (
        <div className="fin-summary">
          <span>Saved {formatMoney(totalCurrent, currency)}</span>
          <span>of {formatMoney(totalTarget, currency)}</span>
        </div>
      )}
      <ul className="budget-list">
        {items.map((s) => {
          const targetN = num(s.target);
          const currentN = num(s.current);
          const pct = targetN > 0 ? Math.min(100, Math.round((currentN / targetN) * 100)) : 0;
          const done = targetN > 0 && currentN >= targetN;
          return (
            <li key={s.id} data-mb-id={s.id} className={"budget-item savings-item" + (done ? " done" : "")}>
              <div className="budget-top">
                <span className="budget-cat">{s.name}{done ? " ✓" : ""}</span>
                <span className="budget-figures">
                  <MoneyInput value={s.current} onCommit={(v) => update(s.id, { current: v })} className="budget-spent" />
                  <span className="budget-sep">/ {formatMoney(targetN, currency)}</span>
                  <span className="budget-pct">{pct}%</span>
                </span>
                <button className="btn-delete" aria-label="Delete" onClick={() => remove(s.id)}>×</button>
              </div>
              <div className="budget-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={"budget-bar-fill savings" + (done ? " done" : "")} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/* ─── LoanPanel ─── */

const LoanPanel = memo(function LoanPanel({ items = [], onChange, currency = "₹" }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [lender, setLender] = useState("");
  const [principal, setPrincipal] = useState("");
  const [outstanding, setOutstanding] = useState("");
  const [rate, setRate] = useState("");
  const [emi, setEmi] = useState("");
  const [due, setDue] = useState("");

  const add = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const out = outstanding === "" ? num(principal) : num(outstanding);
    onChange([
      ...items,
      { id: uid(), name: n, lender: lender.trim(), principal: num(principal), outstanding: out, rate: num(rate), emi: num(emi), due: due ? new Date(due).getTime() : null, created: Date.now() },
    ]);
    setName("");
    setLender("");
    setPrincipal("");
    setOutstanding("");
    setRate("");
    setEmi("");
    setDue("");
    setShowForm(false);
  };
  const update = (id, patch) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  const totalOutstanding = items.reduce((s, i) => s + num(i.outstanding), 0);
  const monthlyEmi = items.reduce((s, i) => s + num(i.emi), 0);

  const sorted = [...items].sort((a, b) => (a.due || Infinity) - (b.due || Infinity));

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Loans</span>
        <button className="academic-add-btn" onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add"}</button>
      </div>
      {showForm && (
        <form className="academic-form" onSubmit={add}>
          <input className="academic-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Loan (e.g. Home loan)" />
          <input className="academic-input sm" value={lender} onChange={(e) => setLender(e.target.value)} placeholder="Lender" />
          <input className="academic-input sm" type="number" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="Principal" />
          <input className="academic-input sm" type="number" inputMode="decimal" value={outstanding} onChange={(e) => setOutstanding(e.target.value)} placeholder="Outstanding" />
          <input className="academic-input sm" type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate %" />
          <input className="academic-input sm" type="number" inputMode="decimal" value={emi} onChange={(e) => setEmi(e.target.value)} placeholder="EMI" />
          <DatePicker className="academic-input sm" small value={due} onChange={setDue} title="Next payment" />
          <button type="submit" className="academic-submit">Add</button>
        </form>
      )}
      {!items.length && <div className="panel-empty">No loans yet</div>}
      {items.length > 0 && (
        <div className="fin-summary">
          <span>Outstanding {formatMoney(totalOutstanding, currency)}</span>
          {monthlyEmi > 0 && <span>EMI {formatMoney(monthlyEmi, currency)}/mo</span>}
        </div>
      )}
      <ul className="budget-list loan-list">
        {sorted.map((l) => {
          const principalN = num(l.principal);
          const outstandingN = num(l.outstanding);
          const paid = principalN - outstandingN;
          const pct = principalN > 0 ? Math.min(100, Math.max(0, Math.round((paid / principalN) * 100))) : 0;
          const done = principalN > 0 && outstandingN <= 0;
          const { text: dueText, overdue, soon } = dueInfo(l.due);
          return (
            <li key={l.id} data-mb-id={l.id} className={"budget-item loan-item" + (done ? " done" : "")}>
              <div className="budget-top">
                <span className="loan-name">
                  {l.name}{done ? " ✓" : ""}
                  {l.lender ? <span className="loan-lender"> · {l.lender}</span> : null}
                </span>
                <span className="budget-figures">
                  <MoneyInput value={l.outstanding} onCommit={(v) => update(l.id, { outstanding: v })} className="budget-spent" />
                  <span className="budget-sep">/ {formatMoney(principalN, currency)}</span>
                </span>
                <button className="btn-delete" aria-label="Delete" onClick={() => remove(l.id)}>×</button>
              </div>
              <div className="budget-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={"budget-bar-fill" + (done ? " done" : "")} style={{ width: `${pct}%` }} />
              </div>
              <div className="loan-meta">
                {num(l.rate) > 0 && <span className="loan-rate">{num(l.rate)}% p.a.</span>}
                {num(l.emi) > 0 && <span className="loan-emi">EMI {formatMoney(l.emi, currency)}</span>}
                {l.due && <span className={"loan-due" + (overdue ? " overdue" : soon ? " soon" : "")}>Next {dueText}</span>}
                <span className="loan-paid">{pct}% paid</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/* ─── InvestmentPanel ─── */

const INVEST_TYPES = ["Stocks", "Mutual Fund", "FD", "Gold", "Crypto", "Other"];
const INVEST_TYPE_COLOR = {
  Stocks: "oklch(0.64 0.14 30)",
  "Mutual Fund": "oklch(0.64 0.12 248)",
  FD: "oklch(0.64 0.1 155)",
  Gold: "oklch(0.7 0.13 85)",
  Crypto: "oklch(0.62 0.13 300)",
  Other: "oklch(0.62 0.02 270)",
};

const InvestmentPanel = memo(function InvestmentPanel({ items = [], onChange, currency = "₹" }) {
  const [name, setName] = useState("");
  const [type, setType] = useState(INVEST_TYPES[0]);
  const [invested, setInvested] = useState("");
  const [value, setValue] = useState("");

  const add = () => {
    const n = name.trim();
    if (!n) return;
    onChange([...items, { id: uid(), name: n, type, invested: num(invested), value: num(value), created: Date.now() }]);
    setName("");
    setType(INVEST_TYPES[0]);
    setInvested("");
    setValue("");
  };
  const update = (id, patch) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id) => onChange(items.filter((i) => i.id !== id));

  const totalInvested = items.reduce((s, i) => s + num(i.invested), 0);
  const totalValue = items.reduce((s, i) => s + num(i.value), 0);
  const totalGain = totalValue - totalInvested;
  const totalPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  return (
    <div className="panel">
      <div className="panel-header">Investments</div>
      <form className="academic-form" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="academic-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Holding" />
        <select className="academic-select" value={type} onChange={(e) => setType(e.target.value)}>
          {INVEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="academic-input sm" type="number" inputMode="decimal" value={invested} onChange={(e) => setInvested(e.target.value)} placeholder="Invested" />
        <input className="academic-input sm" type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" />
        <button type="submit" className="academic-submit">Add</button>
      </form>
      {!items.length && <div className="panel-empty">No investments yet</div>}
      {items.length > 0 && (
        <div className="fin-summary invest-summary">
          <span>Invested {formatMoney(totalInvested, currency)}</span>
          <span>Value {formatMoney(totalValue, currency)}</span>
          <span className={totalGain >= 0 ? "money-pos" : "money-neg"}>
            {totalGain >= 0 ? "▲" : "▼"} {formatMoney(Math.abs(totalGain), currency)} ({totalPct >= 0 ? "+" : ""}{totalPct.toFixed(1)}%)
          </span>
        </div>
      )}
      <ul className="invest-list">
        {items.map((i) => {
          const investedN = num(i.invested);
          const valueN = num(i.value);
          const gain = valueN - investedN;
          const pct = investedN > 0 ? (gain / investedN) * 100 : 0;
          const up = gain >= 0;
          return (
            <li key={i.id} data-mb-id={i.id} className="invest-item">
              <div className="invest-row">
                <Chip label={i.type} color={INVEST_TYPE_COLOR[i.type]} />
                <span className="invest-name">{i.name}</span>
                <span className={"invest-gain " + (up ? "money-pos" : "money-neg")}>
                  {up ? "▲" : "▼"} {formatMoney(Math.abs(gain), currency)} ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                </span>
                <button className="btn-delete" aria-label="Delete" onClick={() => remove(i.id)}>×</button>
              </div>
              <div className="invest-figures">
                <label>Invested <MoneyInput value={i.invested} onCommit={(v) => update(i.id, { invested: v })} className="invest-input" /></label>
                <label>Value <MoneyInput value={i.value} onCommit={(v) => update(i.id, { value: v })} className="invest-input" /></label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/* ─── exports to window ─── */

Object.assign(window, { GrantPanel, BillsPanel, ReimbursementPanel, LoanPanel, SavingsPanel, InvestmentPanel });
