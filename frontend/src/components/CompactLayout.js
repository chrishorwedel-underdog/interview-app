import { useState } from "react";
import { Sparkles, MessageSquareText, ListChecks, Pin, NotebookPen } from "lucide-react";

const TABS = [
  ["suggestions", "Ask", Sparkles],
  ["transcript", "Live", MessageSquareText],
  ["coverage", "Topics", ListChecks],
  ["pinned", "Pins", Pin],
  ["setup", "Prep", NotebookPen],
];

export const CompactLayout = ({ panels, counts }) => {
  const [tab, setTab] = useState("suggestions");
  return (
    <div className="flex flex-col" data-testid="compact-layout">
      <nav className="sticky top-[49px] z-10 grid grid-cols-5 border-b border-white/10 bg-[#0b1120]" data-testid="compact-tabs">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} data-testid={`compact-tab-${key}`}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors border-b-2 ${tab === key ? "border-emerald-400 text-white" : "border-transparent text-slate-300 hover:text-white"}`}>
            <Icon size={15} />
            <span>{label}{counts[key] ? ` ${counts[key]}` : ""}</span>
          </button>
        ))}
      </nav>
      <main className="p-2.5 flex flex-col gap-3">
        {tab === "suggestions" ? (
          <>
            {panels.suggestions}
            {panels.pinned}
          </>
        ) : (
          panels[tab]
        )}
      </main>
    </div>
  );
};
