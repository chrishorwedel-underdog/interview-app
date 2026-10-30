import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/App.css";
import { Toaster, toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { SetupPanel } from "@/components/SetupPanel";
import { TranscriptFeed } from "@/components/TranscriptFeed";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { PinnedPanel } from "@/components/PinnedPanel";
import { useHostSpeech } from "@/hooks/useHostSpeech";
import { useGuestAudio } from "@/hooks/useGuestAudio";
import { useLocalState } from "@/hooks/useLocalState";
import { transcribeBlob, streamSuggestions, parseQuestions } from "@/lib/api";

const uid = () => Math.random().toString(36).slice(2, 10);
const MERGE_GAP_MS = 12000;

function mergeTurns(segments) {
  const sorted = [...segments].sort((a, b) => a.ts - b.ts);
  const out = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.speaker === s.speaker && s.ts - last.end < MERGE_GAP_MS) {
      last.text += " " + s.text;
      last.end = s.ts;
    } else out.push({ ...s, end: s.ts });
  }
  return out;
}

function useElapsed(t0, live) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!live) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [live]);
  const s = Math.max(0, Math.floor((now - t0) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function App() {
  const [setup, setSetup] = useLocalState("fu-setup", { guest_name: "", topic: "", notes: "" });
  const [pinned, setPinned] = useLocalState("fu-pinned", []);
  const [asked, setAsked] = useLocalState("fu-asked", []);
  const [segments, setSegments] = useLocalState("fu-segments", []);
  const [focus, setFocus] = useState("balanced");
  const [auto, setAuto] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [t0, setT0] = useState(() => segments[0]?.ts || Date.now());
  const abortRef = useRef(null);
  const [guestTick, setGuestTick] = useState(0);

  const turns = useMemo(() => mergeTurns(segments), [segments]);
  const ctxRef = useRef({});
  ctxRef.current = { setup, turns, focus, asked };

  const addSegment = useCallback((speaker, text, ts = Date.now()) => {
    if (!text) return;
    setSegments((s) => [...s, { id: uid(), speaker, text, ts }]);
    if (speaker === "guest") setGuestTick((t) => t + 1);
  }, [setSegments]);

  const generate = useCallback(async () => {
    const { setup: su, turns: tr, focus: fo, asked: as } = ctxRef.current;
    if (!tr.length) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError("");
    setQuestions((q) => q.map((x) => ({ ...x, stale: true })));
    try {
      await streamSuggestions(
        { ...su, focus: fo, asked: as, transcript: tr.map(({ speaker, text }) => ({ speaker, text })) },
        (full) => {
          const qs = parseQuestions(full.includes("\n") ? full.slice(0, full.lastIndexOf("\n")) : "");
          if (qs.length) setQuestions(qs);
        },
        ctrl.signal
      ).then((full) => !ctrl.signal.aborted && setQuestions(parseQuestions(full)));
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }, []);

  // Regenerate whenever a new guest segment lands (each pause or every ~7s of talking).
  useEffect(() => {
    if (guestTick && auto) generate();
  }, [guestTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const host = useHostSpeech((text) => addSegment("host", text));
  const guest = useGuestAudio(async (blob, startedAt) => {
    try {
      const recent = ctxRef.current.turns.slice(-3).map((t) => t.text).join(" ");
      const text = await transcribeBlob(blob, `${ctxRef.current.setup.topic}. ${recent}`);
      addSegment("guest", text, startedAt);
    } catch (e) {
      toast.error(e.message);
    }
  });

  const live = host.active || guest.active;
  const elapsed = useElapsed(t0, live);

  const startHost = () => { try { host.start(); } catch (e) { toast.error(e.message); } };
  const startGuest = async () => {
    try { await guest.start(); } catch (e) { if (e.name !== "NotAllowedError") toast.error(e.message); else toast("Guest audio not shared — you can add it from the Guest button."); }
  };
  const startAll = async () => {
    if (!segments.length) setT0(Date.now());
    startHost();
    await startGuest();
  };
  const stopAll = () => { host.stop(); guest.stop(); };

  const isPinned = (text) => pinned.some((p) => p.text === text);
  const togglePin = (q) => {
    if (isPinned(q.text)) setPinned(pinned.filter((p) => p.text !== q.text));
    else { setPinned([...pinned, { id: uid(), text: q.text, asked: false }]); toast.success("Pinned to shortlist"); }
  };
  const copy = (text) => { navigator.clipboard?.writeText(text); toast.success("Copied"); };
  const markUsed = (q) => {
    setAsked([...asked, q.text]);
    setQuestions((qs) => qs.filter((x) => x.text !== q.text));
  };
  const clearTranscript = () => {
    if (!window.confirm("Clear the transcript and start a fresh interview?")) return;
    setSegments([]); setAsked([]); setQuestions([]); setT0(Date.now());
  };

  return (
    <div className="app-root">
      <Toaster theme="dark" position="bottom-center" />
      <TopBar host={host} guest={guest} live={live} elapsed={elapsed} onStart={startAll} onStop={stopAll}
        onToggleHost={() => (host.active ? host.stop() : startHost())}
        onToggleGuest={() => (guest.active ? guest.stop() : startGuest())} />
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 md:p-6">
        <div className="lg:col-span-5 flex flex-col gap-4 lg:h-[calc(100vh-110px)] lg:sticky lg:top-[86px]">
          <SetupPanel setup={setup} setSetup={setSetup} />
          <TranscriptFeed turns={turns} interim={host.interim} guestName={setup.guest_name} t0={t0}
            onAdd={(sp, text) => addSegment(sp, text)} onClear={clearTranscript} guestSpeaking={guest.speaking} />
        </div>
        <div className="lg:col-span-7 flex flex-col gap-4">
          <SuggestionsPanel questions={questions} loading={loading} error={error} focus={focus}
            setFocus={(f) => { setFocus(f); ctxRef.current.focus = f; if (turns.length) generate(); }}
            onRefresh={generate} canGenerate={turns.length > 0 && !loading} auto={auto} setAuto={setAuto}
            isPinned={isPinned} onPin={togglePin} onCopy={copy} onUsed={markUsed} />
          <PinnedPanel pinned={pinned} onCopy={copy} onClear={() => setPinned([])}
            onRemove={(id) => setPinned(pinned.filter((p) => p.id !== id))}
            onToggleAsked={(id) => setPinned(pinned.map((p) => (p.id === id ? { ...p, asked: !p.asked } : p)))} />
        </div>
      </main>
    </div>
  );
}
