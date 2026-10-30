import { useEffect, useState } from "react";
import { ChevronDown, NotebookPen, FileText } from "lucide-react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

export const SetupPanel = ({ setup, setSetup, onOpenBrief, hasBrief, hasTranscript }) => {
  const [open, setOpen] = useState(!setup.notes && !setup.topic);
  useEffect(() => { if (hasTranscript) setOpen(false); }, [hasTranscript]);
  const set = (k) => (e) => setSetup({ ...setup, [k]: e.target.value });
  return (
    <section className="panel" data-testid="setup-panel">
      <div className="flex items-center gap-2 pr-3">
        <button onClick={() => setOpen(!open)} className="flex flex-1 min-w-0 items-center justify-between px-4 py-3" data-testid="setup-toggle-button">
          <span className="eyebrow flex items-center gap-2"><NotebookPen size={14} /> Prep notes</span>
          <span className="flex items-center gap-2 text-sm text-slate-300 truncate max-w-[55%]">
            {!open && (setup.guest_name || setup.topic) && <span className="truncate">{[setup.guest_name, setup.topic].filter(Boolean).join(" · ")}</span>}
            <ChevronDown size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </span>
        </button>
        <button onClick={onOpenBrief} data-testid="open-brief-button"
          className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${hasBrief ? "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25" : "bg-white/10 text-slate-100 hover:bg-white/20"}`}>
          <FileText size={14} /> Brief
        </button>
      </div>
      {open && (
        <div className="space-y-3 px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input data-testid="setup-guest-name-input" placeholder="Guest name" value={setup.guest_name} onChange={set("guest_name")} className="field" />
            <Input data-testid="setup-topic-input" placeholder="Interview topic" value={setup.topic} onChange={set("topic")} className="field" />
          </div>
          <Textarea
            data-testid="setup-notes-textarea"
            placeholder="Paste background research: bio, past interviews, articles, angles you want to cover..."
            value={setup.notes}
            onChange={set("notes")}
            className="field min-h-[160px] text-sm leading-relaxed"
          />
          <p className="text-[0.78rem] font-mono text-slate-400" data-testid="setup-notes-count">{setup.notes.length.toLocaleString()} characters · saved on this device</p>
        </div>
      )}
    </section>
  );
};
