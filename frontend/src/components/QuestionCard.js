import { motion } from "framer-motion";
import { Pin, Copy, Check } from "lucide-react";

export const TYPE_COLORS = {
  Deeper: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  Clarify: "text-sky-300 border-sky-500/30 bg-sky-500/10",
  Challenge: "text-rose-300 border-rose-500/30 bg-rose-500/10",
  Story: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  Connect: "text-violet-300 border-violet-500/30 bg-violet-500/10",
  Pivot: "text-slate-300 border-slate-500/30 bg-slate-500/10",
};

export const QuestionCard = ({ q, index, pinned, onPin, onCopy, onUsed, stale }) => (
  <motion.article
    initial={{ opacity: 0, x: 12 }}
    animate={{ opacity: stale ? 0.45 : 1, x: 0 }}
    transition={{ delay: index * 0.04 }}
    className="group panel-inner p-4 hover:border-white/25 transition-colors duration-200"
    data-testid="question-card"
  >
    <div className="flex items-center justify-between mb-2">
      <span className={`rounded border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${TYPE_COLORS[q.type] || TYPE_COLORS.Deeper}`} data-testid="question-type-badge">{q.type}</span>
      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
        <button onClick={onUsed} title="I asked this" data-testid="mark-asked-button" className="icon-btn"><Check size={15} /></button>
        <button onClick={onCopy} title="Copy" data-testid="copy-question-button" className="icon-btn"><Copy size={15} /></button>
        <button onClick={onPin} title="Pin" data-testid="pin-question-button" className={`icon-btn ${pinned ? "text-amber-400" : ""}`}><Pin size={15} fill={pinned ? "currentColor" : "none"} /></button>
      </div>
    </div>
    <p className="text-lg md:text-xl font-medium leading-snug text-slate-50" data-testid="question-text">{q.text}</p>
  </motion.article>
);
