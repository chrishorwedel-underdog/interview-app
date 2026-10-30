import { Pin, Copy, Check, X } from "lucide-react";

export const PinnedPanel = ({ pinned, onToggleAsked, onRemove, onCopy, onClear }) => (
  <section className="panel" data-testid="pinned-questions-panel">
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
      <span className="eyebrow flex items-center gap-2"><Pin size={13} className="text-amber-400" /> Shortlist <span className="text-white">{pinned.length}</span></span>
      {pinned.length > 0 && <button onClick={onClear} data-testid="clear-pinned-button" className="text-[0.72rem] font-mono uppercase tracking-widest text-white hover:text-red-400 transition-colors">Clear</button>}
    </div>
    <ul className="p-3 space-y-1.5">
      {pinned.length === 0 && <li className="px-1 py-3 text-sm text-white" data-testid="pinned-empty">Pin a question to keep it handy for later.</li>}
      {pinned.map((p) => (
        <li key={p.id} data-testid="pinned-question-item" className="group flex items-start gap-2 rounded-md px-2 py-2 hover:bg-white/5 transition-colors">
          <button onClick={() => onToggleAsked(p.id)} data-testid="pinned-asked-toggle"
            className={`mt-0.5 h-4 w-4 shrink-0 rounded border grid place-items-center transition-colors ${p.asked ? "bg-amber-500 border-amber-500 text-black" : "border-slate-600 hover:border-amber-400"}`}>
            {p.asked && <Check size={11} strokeWidth={3} />}
          </button>
          <p className={`flex-1 text-sm leading-snug ${p.asked ? "line-through text-white" : "text-white"}`}>{p.text}</p>
          <button onClick={() => onCopy(p.text)} data-testid="pinned-copy-button" className="icon-btn opacity-0 group-hover:opacity-100"><Copy size={13} /></button>
          <button onClick={() => onRemove(p.id)} data-testid="pinned-remove-button" className="icon-btn opacity-0 group-hover:opacity-100"><X size={13} /></button>
        </li>
      ))}
    </ul>
  </section>
);
