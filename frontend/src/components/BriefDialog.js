import { FileText, Loader2, Pin, Printer, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

const Section = ({ title, children }) => (
  <div className="break-inside-avoid">
    <h4 className="eyebrow mb-2 print:text-black">{title}</h4>
    {children}
  </div>
);

const QuestionList = ({ items, isPinned, onPin, testId }) => (
  <ol className="space-y-2" data-testid={testId}>
    {items.map((q, i) => (
      <li key={i} className="flex items-start gap-2">
        <span className="font-mono text-sm text-slate-400 mt-0.5">{i + 1}.</span>
        <p className="flex-1 text-base leading-snug text-slate-50 print:text-black">{q}</p>
        <button onClick={() => onPin(q)} data-testid="brief-pin-button" title="Pin to shortlist"
          className={`icon-btn print:hidden ${isPinned(q) ? "text-amber-400" : ""}`}>
          <Pin size={15} fill={isPinned(q) ? "currentColor" : "none"} />
        </button>
      </li>
    ))}
  </ol>
);

const BriefBody = ({ brief, isPinned, onPin }) => (
  <div className="space-y-6">
    <p className="text-lg leading-relaxed text-slate-100 print:text-black" data-testid="brief-snapshot">{brief.snapshot}</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Section title="Key facts">
        <ul className="space-y-1.5 text-base text-slate-200 print:text-black" data-testid="brief-key-facts">
          {brief.key_facts.map((f, i) => <li key={i}>• {f}</li>)}
        </ul>
      </Section>
      <Section title="Likely angles">
        <ul className="space-y-2.5" data-testid="brief-angles">
          {brief.angles.map((a, i) => (
            <li key={i}>
              <p className="text-base font-semibold text-emerald-300 print:text-black">{a.title}</p>
              <p className="text-sm text-slate-300 print:text-black">{a.why}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
    <Section title="Opening questions"><QuestionList items={brief.openers} isPinned={isPinned} onPin={onPin} testId="brief-openers" /></Section>
    <Section title="Go deeper later"><QuestionList items={brief.deeper} isPinned={isPinned} onPin={onPin} testId="brief-deeper" /></Section>
    {brief.watch_outs.length > 0 && (
      <Section title="Watch outs">
        <ul className="space-y-1.5 text-base text-amber-200 print:text-black" data-testid="brief-watch-outs">
          {brief.watch_outs.map((w, i) => <li key={i}>• {w}</li>)}
        </ul>
      </Section>
    )}
  </div>
);

export const BriefDialog = ({ open, onOpenChange, brief, loading, onGenerate, setup, isPinned, onPin }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="print-area max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0b1120] border-white/15 text-slate-50" data-testid="brief-dialog">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl text-left print:text-black">
          Prep brief{setup.guest_name ? ` · ${setup.guest_name}` : ""}
        </DialogTitle>
        {setup.topic && <p className="text-base text-slate-300 print:text-black">{setup.topic}</p>}
      </DialogHeader>
      <div className="flex flex-wrap gap-2 print:hidden">
        <button onClick={onGenerate} disabled={loading || !setup.notes.trim()} data-testid="brief-generate-button"
          className="flex items-center gap-2 rounded-full bg-emerald-500 text-[#04110b] font-semibold px-4 py-2 text-sm hover:bg-emerald-400 disabled:opacity-40 transition-colors">
          {loading ? <Loader2 size={15} className="animate-spin" /> : brief ? <RefreshCw size={15} /> : <FileText size={15} />}
          {loading ? "Writing brief..." : brief ? "Rewrite from notes" : "Write my brief"}
        </button>
        {brief && (
          <button onClick={() => window.print()} data-testid="brief-print-button"
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/20 transition-colors">
            <Printer size={15} /> Print / PDF
          </button>
        )}
      </div>
      {!brief && !loading && (
        <p className="text-base text-slate-300" data-testid="brief-empty">
          {setup.notes.trim() ? "Turn your prep notes into a one-page brief: who they are, key facts, angles, openers and watch outs." : "Add prep notes first, then write your brief."}
        </p>
      )}
      {brief && <BriefBody brief={brief} isPinned={isPinned} onPin={onPin} />}
    </DialogContent>
  </Dialog>
);
