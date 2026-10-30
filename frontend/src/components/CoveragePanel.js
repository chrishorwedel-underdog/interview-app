import { useState } from "react";
import { ListChecks, Wand2, Loader2, Plus, X, Check, RefreshCw } from "lucide-react";

const STYLE = {
  open: "border-slate-500/60 text-slate-200 bg-transparent",
  touched: "border-amber-400/60 text-amber-200 bg-amber-500/10",
  covered: "border-emerald-400/60 text-emerald-200 bg-emerald-500/15",
};

export const CoveragePanel = ({ topics, extracting, checking, hasNotes, onExtract, onCheck, onCycle, onAdd, onRemove }) => {
  const [label, setLabel] = useState("");
  const covered = topics.filter((t) => t.status === "covered").length;
  const submit = (e) => {
    e.preventDefault();
    if (label.trim()) { onAdd(label.trim()); setLabel(""); }
  };
  return (
    <section className="panel" data-testid="coverage-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
        <span className="eyebrow flex items-center gap-2">
          <ListChecks size={13} className="text-emerald-400" /> Coverage
          {topics.length > 0 && <span className="text-slate-200" data-testid="coverage-count">{covered}/{topics.length}</span>}
          {checking && <Loader2 size={13} className="animate-spin text-emerald-400" data-testid="coverage-checking" />}
        </span>
        <div className="flex items-center gap-2">
          {topics.length > 0 && (
            <button onClick={onCheck} data-testid="coverage-check-button" className="icon-btn" title="Re-check against transcript"><RefreshCw size={14} /></button>
          )}
          <button onClick={onExtract} disabled={!hasNotes || extracting} data-testid="coverage-extract-button"
            className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 px-3 py-1 text-xs transition-colors">
            {extracting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} {topics.length ? "Re-read notes" : "Pull topics from notes"}
          </button>
        </div>
      </div>
      {topics.length > 0 && (
        <div className="h-1 bg-white/5"><div className="h-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${(covered / topics.length) * 100}%` }} /></div>
      )}
      <div className="p-3">
        {topics.length === 0 && (
          <p className="px-1 pb-2 text-sm text-slate-300" data-testid="coverage-empty">
            {hasNotes ? "Pull the topics out of your prep notes, or add your own below. They tick off as they come up." : "Add prep notes, then pull topics from them — or add topics yourself below."}
          </p>
        )}
        <ul className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <li key={t.id} data-testid="coverage-topic-item" data-status={t.status}
              className={`group flex items-center gap-1.5 rounded-full border pl-3 pr-1.5 py-1 text-sm transition-colors ${STYLE[t.status]}`}>
              <button onClick={() => onCycle(t.id)} data-testid="coverage-topic-toggle" className="flex items-center gap-1.5" title="Click to change status">
                {t.status === "covered" && <Check size={13} strokeWidth={3} />}
                {t.status === "touched" && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
                <span className={t.status === "covered" ? "line-through decoration-emerald-400/50" : ""}>{t.label}</span>
              </button>
              <button onClick={() => onRemove(t.id)} data-testid="coverage-topic-remove" className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-white transition-opacity"><X size={12} /></button>
            </li>
          ))}
        </ul>
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add a topic to cover..." data-testid="coverage-add-input"
            className="field flex-1 rounded-md px-3 py-1.5 text-sm outline-none" />
          <button data-testid="coverage-add-button" className="rounded-md bg-white/10 hover:bg-white/20 px-2.5 transition-colors"><Plus size={14} /></button>
        </form>
        {topics.length > 0 && <p className="mt-2 text-[11px] font-mono text-slate-400">open · <span className="text-amber-300">touched</span> · <span className="text-emerald-300">covered</span> — click a topic to change it</p>}
      </div>
    </section>
  );
};
