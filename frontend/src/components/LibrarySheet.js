import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, FolderOpen, Trash2, Plus, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { api } from "@/lib/api";
import { downloadMarkdown } from "@/lib/exportMd";

const when = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const InterviewDetail = ({ iv, onBack, onLoad, onDelete }) => {
  const segs = [...iv.segments].sort((a, b) => a.ts - b.ts);
  return (
    <div className="flex flex-col gap-4" data-testid="library-detail">
      <button onClick={onBack} data-testid="library-back-button" className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white w-fit"><ArrowLeft size={14} /> All interviews</button>
      <div>
        <h3 className="font-display text-xl font-bold">{iv.guest_name || "Untitled guest"}</h3>
        <p className="text-sm text-slate-300">{iv.topic || "No topic"} · {when(iv.updated_at)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onLoad(iv)} data-testid="library-load-button" className="flex items-center gap-1.5 rounded-full bg-emerald-500 text-[#04110b] font-semibold px-3 py-1.5 text-sm hover:bg-emerald-400 transition-colors"><FolderOpen size={14} /> Open in workspace</button>
        <button onClick={() => downloadMarkdown(iv)} data-testid="library-export-button" className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 transition-colors"><Download size={14} /> Export</button>
        <button onClick={() => onDelete(iv.id)} data-testid="library-delete-button" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/15 transition-colors"><Trash2 size={14} /> Delete</button>
      </div>
      <div>
        <p className="eyebrow mb-2">Shortlist</p>
        {iv.pinned.length === 0 ? <p className="text-sm text-slate-400">No pinned questions.</p> : (
          <ul className="space-y-1.5">{iv.pinned.map((p) => <li key={p.id} className={`text-sm ${p.asked ? "line-through text-slate-400" : "text-slate-100"}`}>• {p.text}</li>)}</ul>
        )}
      </div>
      {iv.topics.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Coverage</p>
          <p className="text-sm text-slate-200">{iv.topics.map((t) => `${t.status === "covered" ? "✓" : "○"} ${t.label}`).join("   ")}</p>
        </div>
      )}
      <div>
        <p className="eyebrow mb-2">Transcript</p>
        <div className="space-y-3" data-testid="library-transcript">
          {segs.length === 0 && <p className="text-sm text-slate-400">Empty transcript.</p>}
          {segs.map((s) => (
            <p key={s.id} className="text-sm leading-relaxed text-slate-100">
              <span className={`font-mono text-[11px] uppercase tracking-widest mr-2 ${s.speaker === "guest" ? "text-emerald-300" : "text-sky-300"}`}>{s.speaker === "guest" ? iv.guest_name || "Guest" : "You"}</span>{s.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

export const LibrarySheet = ({ open, onOpenChange, onLoad, onNew, currentId }) => {
  const [items, setItems] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDetail(null);
    api.listInterviews().then(setItems).catch((e) => toast.error(e.message));
  }, [open]);

  const openItem = (id) => api.getInterview(id).then(setDetail).catch((e) => toast.error(e.message));
  const remove = async (id) => {
    if (!window.confirm("Delete this saved interview permanently?")) return;
    await api.deleteInterview(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
    setDetail(null);
    toast.success("Interview deleted");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-[#0b1120] border-white/10 text-slate-50 overflow-y-auto" data-testid="library-sheet">
        <SheetHeader><SheetTitle className="font-display text-slate-50 text-left">Saved interviews</SheetTitle></SheetHeader>
        <div className="mt-5">
          {detail ? (
            <InterviewDetail iv={detail} onBack={() => setDetail(null)} onLoad={onLoad} onDelete={remove} />
          ) : (
            <div className="space-y-2">
              <button onClick={onNew} data-testid="library-new-button" className="flex w-full items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm text-slate-200 hover:border-emerald-400/60 hover:text-white transition-colors"><Plus size={15} /> Start a new interview</button>
              {items === null && <Loader2 className="animate-spin text-slate-400 mx-auto mt-6" />}
              {items?.length === 0 && <p className="text-sm text-slate-300 py-4" data-testid="library-empty">Nothing saved yet. Use Save in the top bar — interviews also save automatically when you press Stop.</p>}
              {items?.map((it) => (
                <button key={it.id} onClick={() => openItem(it.id)} data-testid="library-item"
                  className="w-full text-left rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-white/25 hover:bg-white/[0.06] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-50 truncate">{it.guest_name || "Untitled guest"}</span>
                    {it.id === currentId && <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300">current</span>}
                  </div>
                  <p className="text-sm text-slate-300 truncate">{it.topic || "No topic"}</p>
                  <p className="mt-1 text-[11px] font-mono text-slate-400">{when(it.updated_at)} · {it.turns} lines · {it.pinned} pinned</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
