import { useState } from "react";
import { ChevronDown, NotebookPen } from "lucide-react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

export const SetupPanel = ({ setup, setSetup }) => {
  const [open, setOpen] = useState(!setup.notes && !setup.topic);
  const set = (k) => (e) => setSetup({ ...setup, [k]: e.target.value });
  return (
    <section className="panel" data-testid="setup-panel">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3" data-testid="setup-toggle-button">
        <span className="eyebrow flex items-center gap-2"><NotebookPen size={13} /> Prep notes</span>
        <span className="flex items-center gap-2 text-xs text-slate-400 truncate max-w-[60%]">
          {!open && (setup.guest_name || setup.topic) && <span className="truncate">{[setup.guest_name, setup.topic].filter(Boolean).join(" · ")}</span>}
          <ChevronDown size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
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
          <p className="text-[11px] font-mono text-slate-500" data-testid="setup-notes-count">{setup.notes.length.toLocaleString()} characters · saved on this device</p>
        </div>
      )}
    </section>
  );
};
