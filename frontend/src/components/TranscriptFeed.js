import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Trash2 } from "lucide-react";

const fmt = (ts, t0) => {
  const s = Math.max(0, Math.floor((ts - t0) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const ManualLine = ({ onAdd }) => {
  const [text, setText] = useState("");
  const [speaker, setSpeaker] = useState("guest");
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(speaker, text.trim());
    setText("");
  };
  return (
    <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
      <button type="button" data-testid="manual-speaker-toggle" onClick={() => setSpeaker(speaker === "guest" ? "host" : "guest")}
        className={`shrink-0 rounded-md px-2 text-[10px] font-mono uppercase tracking-widest border transition-colors ${speaker === "guest" ? "border-emerald-500/40 text-emerald-400" : "border-sky-500/40 text-sky-400"}`}>
        {speaker === "guest" ? "Guest" : "You"}
      </button>
      <input data-testid="manual-line-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a line if audio misses something..."
        className="field flex-1 rounded-md px-3 py-2 text-sm outline-none" />
      <button data-testid="manual-line-submit" className="rounded-md bg-white/10 hover:bg-white/20 px-3 transition-colors"><Send size={14} /></button>
    </form>
  );
};

export const TranscriptFeed = ({ turns, interim, guestName, t0, onAdd, onClear, guestSpeaking }) => {
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [turns, interim]);
  return (
    <section className="panel flex flex-col min-h-[320px] lg:flex-1 lg:min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="eyebrow">Live transcript</span>
        <div className="flex items-center gap-3">
          {guestSpeaking && <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 animate-pulse" data-testid="guest-speaking-indicator">guest speaking</span>}
          {turns.length > 0 && <button onClick={onClear} data-testid="clear-transcript-button" className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>}
        </div>
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto px-4 py-3 space-y-4 max-h-[50vh] lg:max-h-none" data-testid="live-transcript-container">
        {turns.length === 0 && !interim && (
          <p className="text-sm text-slate-500 leading-relaxed pt-6" data-testid="transcript-empty">Press <b className="text-slate-300">Start listening</b>, allow your mic, then pick your video call's tab and turn on <b className="text-slate-300">Share tab audio</b>. What you and your guest say will appear here.</p>
        )}
        {turns.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} data-testid={`transcript-${t.speaker}-item`}
            className={`border-l-2 pl-3 ${t.speaker === "guest" ? "border-emerald-500" : "border-sky-500/60"}`}>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest mb-1">
              <span className={t.speaker === "guest" ? "text-emerald-400" : "text-sky-400"}>{t.speaker === "guest" ? guestName || "Guest" : "You"}</span>
              <span className="text-slate-600">{fmt(t.ts, t0)}</span>
            </div>
            <p className={`text-sm leading-relaxed ${t.speaker === "guest" ? "text-slate-100" : "text-slate-400"}`}>{t.text}</p>
          </motion.div>
        ))}
        {interim && <p className="border-l-2 border-sky-500/30 pl-3 text-sm italic text-slate-500" data-testid="transcript-interim">{interim}</p>}
      </div>
      <ManualLine onAdd={onAdd} />
    </section>
  );
};
