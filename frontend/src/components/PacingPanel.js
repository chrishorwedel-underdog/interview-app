import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

const STATUS = {
  idle: ["text-white", "Set your target, then start"],
  none: ["text-white", "Add prep topics to track pace"],
  ahead: ["text-emerald-300", "Ahead of pace"],
  on: ["text-emerald-300", "On pace"],
  behind: ["text-amber-300", "Behind — move on soon"],
  over: ["text-rose-300", "Over time"],
  done: ["text-emerald-300", "All topics covered"],
};

function pace(elapsedMin, targetMin, topics) {
  const total = topics.length;
  const covered = topics.filter((t) => t.status === "covered").length;
  const touched = topics.filter((t) => t.status === "touched").length;
  const progress = total ? (covered + touched * 0.5) / total : 0;
  const timeFrac = Math.min(1, elapsedMin / targetMin);
  const left = targetMin - elapsedMin;
  const open = total - covered;
  let status = "on";
  if (!total) status = "none";
  else if (open === 0) status = "done";
  else if (elapsedMin < 0.5) status = "idle";
  else if (left <= 0) status = "over";
  else if (progress < timeFrac - 0.12) status = "behind";
  else if (progress > timeFrac + 0.12) status = "ahead";
  return { total, covered, progress, timeFrac, left, open, status, perTopic: open && left > 0 ? left / open : 0 };
}

const Row = ({ label, frac, color, value, testId }) => (
  <div className="flex items-center gap-3">
    <span className="w-14 shrink-0 text-xs font-mono uppercase tracking-widest text-white">{label}</span>
    <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full ${color} transition-[width] duration-700`} style={{ width: `${Math.round(frac * 100)}%` }} data-testid={testId} />
    </div>
    <span className="w-16 shrink-0 text-right text-sm text-white">{value}</span>
  </div>
);

export const PacingPanel = ({ elapsedMs, targetMin, setTargetMin, topics }) => {
  const [draft, setDraft] = useState(String(targetMin));
  useEffect(() => setDraft(String(targetMin)), [targetMin]);
  const commit = () => {
    const n = Math.min(300, Math.max(1, Math.round(Number(draft)) || targetMin));
    setTargetMin(n);
    setDraft(String(n));
  };
  const elapsedMin = elapsedMs / 60000;
  const p = pace(elapsedMin, targetMin, topics);
  const [color, text] = STATUS[p.status];
  return (
    <section className="panel px-4 py-3 space-y-2.5" data-testid="pacing-panel" data-status={p.status}>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow flex items-center gap-2"><Timer size={14} /> Pacing</span>
        <label className="flex items-center gap-1.5 text-sm text-white">
          Target
          <input type="number" min={1} max={300} step={5} value={draft} data-testid="pacing-target-input"
            onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="field w-16 rounded-md px-2 py-0.5 text-sm text-center outline-none" />
          min
        </label>
      </div>
      <p className={`text-base font-medium ${color}`} data-testid="pacing-status">{text}</p>
      <Row label="Time" frac={p.timeFrac} color={p.status === "over" ? "bg-rose-400" : "bg-sky-400"}
        value={`${Math.floor(elapsedMin)}/${targetMin}m`} testId="pacing-time-bar" />
      <Row label="Topics" frac={p.progress} color="bg-emerald-400" value={p.total ? `${p.covered}/${p.total}` : "—"} testId="pacing-topic-bar" />
      {p.total > 0 && p.open > 0 && (
        <p className="text-sm text-white" data-testid="pacing-hint">
          {p.left > 0 ? `${Math.ceil(p.left)} min left · about ${p.perTopic.toFixed(1)} min per open topic` : `${Math.ceil(-p.left)} min over · ${p.open} topic${p.open > 1 ? "s" : ""} still open`}
        </p>
      )}
    </section>
  );
};
