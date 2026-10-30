import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { QuestionCard } from "./QuestionCard";

const FOCUSES = [
  ["balanced", "Balanced"],
  ["stories", "Stories"],
  ["technical", "Specifics"],
  ["challenge", "Challenge"],
  ["timeline", "Timeline"],
];

export const SuggestionsPanel = ({ questions, loading, error, focus, setFocus, onRefresh, isPinned, onPin, onCopy, onUsed, canGenerate, auto, setAuto }) => (
  <section className="panel flex flex-col" data-testid="ai-suggestions-panel">
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
      <span className="eyebrow flex items-center gap-2">
        <Sparkles size={13} className="text-emerald-400" /> Ask next
        {loading && <Loader2 size={13} className="animate-spin text-emerald-400" data-testid="suggestions-loading" />}
      </span>
      <div className="flex items-center gap-2">
        <button onClick={() => setAuto(!auto)} data-testid="auto-toggle-button"
          className={`text-[0.72rem] font-mono uppercase tracking-widest rounded-full border px-2.5 py-1 transition-colors ${auto ? "border-emerald-500/40 text-emerald-400" : "border-white/10 text-white"}`}>
          Auto {auto ? "on" : "off"}
        </button>
        <button onClick={onRefresh} disabled={!canGenerate} data-testid="generate-now-button"
          className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 px-3 py-1 text-xs transition-colors">
          <RefreshCw size={12} /> Generate now
        </button>
      </div>
    </div>
    <div className="flex gap-1.5 overflow-x-auto px-4 pt-3" data-testid="focus-filters">
      {FOCUSES.map(([k, label]) => (
        <button key={k} onClick={() => setFocus(k)} data-testid={`focus-${k}-button`}
          className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${focus === k ? "bg-slate-100 text-slate-900" : "bg-white/5 text-white hover:text-white"}`}>
          {label}
        </button>
      ))}
    </div>
    <div className="p-4 space-y-3">
      {error && <p className="text-sm text-rose-400" data-testid="suggestions-error">{error}</p>}
      {questions.length === 0 && !loading && (
        <p className="text-sm text-white py-10 leading-relaxed" data-testid="suggestions-empty">
          Follow-up questions appear here automatically each time your guest pauses. They keep updating while the guest talks, so a fresh set is ready the moment they finish.
        </p>
      )}
      {questions.map((q, i) => (
        <QuestionCard key={`${q.text}-${i}`} q={q} index={i} stale={loading && q.stale} pinned={isPinned(q.text)}
          onPin={() => onPin(q)} onCopy={() => onCopy(q.text)} onUsed={() => onUsed(q)} />
      ))}
    </div>
  </section>
);
