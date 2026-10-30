import { useMemo } from "react";
import { Gauge } from "lucide-react";

const words = (t) => t.split(/\s+/).filter(Boolean).length;
const WINDOW_MS = 5 * 60 * 1000;

function split(segments, since = 0) {
  let host = 0;
  let guest = 0;
  for (const s of segments) {
    if (s.ts < since) continue;
    if (s.speaker === "host") host += words(s.text);
    else guest += words(s.text);
  }
  const total = host + guest;
  return { host, guest, total, hostPct: total ? Math.round((host / total) * 100) : 0 };
}

const Bar = ({ data, testId }) => (
  <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10" data-testid={testId}>
    <div className="bg-sky-400 transition-[width] duration-500" style={{ width: `${data.hostPct}%` }} />
    <div className="bg-emerald-400 transition-[width] duration-500" style={{ width: `${data.total ? 100 - data.hostPct : 0}%` }} />
  </div>
);

export const TalkMeter = ({ segments }) => {
  const latest = segments.reduce((m, s) => Math.max(m, s.ts), 0);
  const overall = useMemo(() => split(segments), [segments]);
  const recent = useMemo(() => split(segments, latest - WINDOW_MS), [segments, latest]);
  const tooMuch = recent.total > 60 && recent.hostPct > 40;
  if (!overall.total) return null;
  return (
    <section className="panel px-4 py-3 space-y-2.5" data-testid="talk-meter">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow flex items-center gap-2"><Gauge size={14} /> Talk time</span>
        <span className={`text-sm font-medium ${tooMuch ? "text-amber-300" : "text-emerald-300"}`} data-testid="talk-meter-status">
          {tooMuch ? "You're talking a lot — hand it back" : "Spotlight on your guest"}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-sky-300" data-testid="talk-meter-host-pct">You {overall.hostPct}%</span>
          <span className="text-emerald-300" data-testid="talk-meter-guest-pct">Guest {100 - overall.hostPct}%</span>
        </div>
        <Bar data={overall} testId="talk-meter-overall-bar" />
      </div>
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-xs font-mono uppercase tracking-widest text-slate-300">Last 5 min</span>
        <div className="flex-1"><Bar data={recent} testId="talk-meter-recent-bar" /></div>
        <span className="shrink-0 text-xs font-mono text-slate-200" data-testid="talk-meter-recent-pct">{recent.hostPct}% you</span>
      </div>
    </section>
  );
};
