import { Hourglass, Loader2, Pin, RefreshCw, X } from "lucide-react";

export const WrapUpNudge = ({ minutesLeft, openTopics, questions, loading, onRefresh, onDismiss, isPinned, onPin }) => (
  <section className="panel border-amber-400/50 bg-amber-500/10" data-testid="wrapup-nudge">
    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-amber-400/20">
      <span className="eyebrow flex items-center gap-2 text-amber-200">
        <Hourglass size={14} className="text-amber-300" /> Time to wrap up
        {loading && <Loader2 size={14} className="animate-spin text-amber-300" data-testid="wrapup-loading" />}
      </span>
      <div className="flex items-center gap-1">
        <span className="text-base font-semibold text-amber-200 mr-2" data-testid="wrapup-minutes-left">
          {minutesLeft > 0 ? `${Math.ceil(minutesLeft)} min left` : `${Math.ceil(-minutesLeft)} min over`}
        </span>
        <button onClick={onRefresh} disabled={loading} title="New closing questions" data-testid="wrapup-refresh-button" className="icon-btn"><RefreshCw size={15} /></button>
        <button onClick={onDismiss} title="Dismiss" data-testid="wrapup-dismiss-button" className="icon-btn"><X size={15} /></button>
      </div>
    </div>
    <div className="px-4 py-3 space-y-3">
      {openTopics.length > 0 && (
        <p className="text-sm text-white" data-testid="wrapup-open-topics">
          <span className="font-mono text-xs uppercase tracking-widest text-amber-300">Still open · </span>{openTopics.join(" · ")}
        </p>
      )}
      {questions.length === 0 && !loading && <p className="text-sm text-white">Closing questions will appear here.</p>}
      <ul className="space-y-2" data-testid="wrapup-questions">
        {questions.map((q, i) => (
          <li key={`${q.text}-${i}`} className="flex items-start gap-2" data-testid="wrapup-question-item">
            <p className="flex-1 text-lg leading-snug text-white">{q.text}</p>
            <button onClick={() => onPin(q)} title="Pin" data-testid="wrapup-pin-button" className={`icon-btn ${isPinned(q.text) ? "text-amber-400" : ""}`}>
              <Pin size={15} fill={isPinned(q.text) ? "currentColor" : "none"} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
