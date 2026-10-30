import { useState } from "react";
import { BookOpenText, ChevronDown, Maximize2 } from "lucide-react";

export const BriefGlance = ({ brief, onOpen }) => {
  const [open, setOpen] = useState(true);
  if (!brief) return null;
  return (
    <section className="panel" data-testid="brief-glance">
      <div className="flex items-center justify-between gap-2 pl-4 pr-2 py-2.5 border-b border-white/10">
        <button onClick={() => setOpen(!open)} data-testid="brief-glance-toggle" className="flex flex-1 items-center justify-between">
          <span className="eyebrow flex items-center gap-2"><BookOpenText size={14} className="text-emerald-400" /> Key facts</span>
          <ChevronDown size={16} className={`text-white transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
        <button onClick={onOpen} data-testid="brief-glance-open" title="Open full brief" className="icon-btn"><Maximize2 size={14} /></button>
      </div>
      {open && (
        <ul className="px-4 py-3 space-y-1.5 max-h-72 overflow-y-auto" data-testid="brief-glance-facts">
          {brief.key_facts.map((f, i) => (
            <li key={i} className="flex gap-2 text-base leading-snug text-white">
              <span className="text-emerald-400">•</span><span>{f}</span>
            </li>
          ))}
          {brief.watch_outs?.length > 0 && (
            <li className="pt-2 text-sm text-amber-200" data-testid="brief-glance-watchouts">
              <span className="font-mono text-xs uppercase tracking-widest text-amber-300">Watch out · </span>
              {brief.watch_outs.join(" · ")}
            </li>
          )}
        </ul>
      )}
    </section>
  );
};
