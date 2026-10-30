import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/App.css";
import { Toaster, toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { SetupPanel } from "@/components/SetupPanel";
import { TranscriptFeed } from "@/components/TranscriptFeed";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { PinnedPanel } from "@/components/PinnedPanel";
import { CoveragePanel } from "@/components/CoveragePanel";
import { LibrarySheet } from "@/components/LibrarySheet";
import { CompactLayout } from "@/components/CompactLayout";
import { TalkMeter } from "@/components/TalkMeter";
import { BriefDialog } from "@/components/BriefDialog";
import { PacingPanel } from "@/components/PacingPanel";
import { BriefGlance } from "@/components/BriefGlance";
import { useHostSpeech } from "@/hooks/useHostSpeech";
import { useGuestAudio } from "@/hooks/useGuestAudio";
import { useLocalState } from "@/hooks/useLocalState";
import { transcribeBlob, streamSuggestions, parseQuestions, api } from "@/lib/api";

const RANK = { open: 0, touched: 1, covered: 2 };
const NEXT = { open: "touched", touched: "covered", covered: "open" };
const SCALES = [1, 1.12, 0.9];

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

function useElapsed(t0, live, lastTs) {
  const [now, setNow] = useState(Date.now());
  const run = useRef({ base: 0, start: 0 });
  useEffect(() => {
    if (!live) return;
    run.current = { base: lastTs ? Math.max(0, lastTs - t0) : 0, start: Date.now() };
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
  const ms = live ? run.current.base + Math.max(0, now - run.current.start) : Math.max(0, (lastTs || t0) - t0);
  const s = Math.floor(ms / 1000);
  return { ms, label: `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` };
}

export default function App() {
  const [setup, setSetup] = useLocalState("fu-setup", { guest_name: "", topic: "", notes: "" });
  const [pinned, setPinned] = useLocalState("fu-pinned", []);
  const [asked, setAsked] = useLocalState("fu-asked", []);
  const [segments, setSegments] = useLocalState("fu-segments", []);
  const [topics, setTopics] = useLocalState("fu-topics", []);
  const [interviewId, setInterviewId] = useLocalState("fu-interview-id", null);
  const [compact, setCompact] = useLocalState("fu-compact", window.innerWidth < 900);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [brief, setBrief] = useLocalState("fu-brief", null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [textScale, setTextScale] = useLocalState("fu-text-scale", 1);
  const [targetMin, setTargetMin] = useLocalState("fu-target-min", 45);
  useEffect(() => { document.documentElement.style.fontSize = `${18 * textScale}px`; }, [textScale]);
  useEffect(() => {
    const header = document.querySelector("header");
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--hdr", `${header.offsetHeight}px`));
    ro.observe(header);
    return () => ro.disconnect();
  }, []);
  const [checking, setChecking] = useState(false);
  const covRef = useRef({ busy: false, last: 0, timer: null });
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
  ctxRef.current = { setup, turns, focus, asked, topics, segments, pinned, interviewId, brief };

  const addSegment = useCallback((speaker, text, ts = Date.now()) => {
    if (!text) return;
    setSegments((s) => [...s, { id: uid(), speaker, text, ts }]);
    if (speaker === "guest") setGuestTick((t) => t + 1);
  }, [setSegments]);

  const generate = useCallback(async () => {
    const { setup: su, turns: tr, focus: fo, asked: as, topics: tp } = ctxRef.current;
    if (!tr.length) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError("");
    setQuestions((q) => q.map((x) => ({ ...x, stale: true })));
    try {
      await streamSuggestions(
        { ...su, focus: fo, asked: as, open_topics: tp.filter((t) => t.status !== "covered").map((t) => t.label), transcript: tr.map(({ speaker, text }) => ({ speaker, text })) },
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

  const checkCoverage = useCallback(async (force) => {
    const c = covRef.current;
    const { topics: tp, turns: tr } = ctxRef.current;
    if (!tp.length || !tr.length) return;
    const wait = 15000 - (Date.now() - c.last);
    if (c.busy || (!force && wait > 0)) {
      if (!c.timer) c.timer = setTimeout(() => { c.timer = null; checkCoverage(true); }, Math.max(wait, 3000));
      return;
    }
    c.busy = true;
    c.last = Date.now();
    setChecking(true);
    try {
      const res = await api.coverage(tp, tr.map(({ speaker, text }) => ({ speaker, text })));
      const status = Object.fromEntries(res.topics.map((t) => [t.id, t.status]));
      setTopics((cur) => cur.map((t) => (RANK[status[t.id]] > RANK[t.status] ? { ...t, status: status[t.id] } : t)));
    } catch (_) {
      // coverage is best-effort during a live call
    } finally {
      c.busy = false;
      setChecking(false);
    }
  }, [setTopics]);

  // Regenerate whenever a new guest segment lands (each pause or every ~7s of talking).
  useEffect(() => {
    if (!guestTick) return;
    if (auto) generate();
    checkCoverage(false);
  }, [guestTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const extractTopics = async () => {
    if (topics.length && !window.confirm("Replace the current topic list with a fresh one from your notes?")) return;
    setExtracting(true);
    try {
      const res = await api.extractTopics(setup.topic, setup.notes);
      setTopics(res.topics);
      if (turns.length) setTimeout(() => checkCoverage(true), 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setExtracting(false);
    }
  };
  const cycleTopic = (id) => setTopics((ts) => ts.map((t) => (t.id === id ? { ...t, status: NEXT[t.status] } : t)));
  const addTopic = (label) => setTopics((ts) => [...ts, { id: uid(), label, status: "open" }]);
  const removeTopic = (id) => setTopics((ts) => ts.filter((t) => t.id !== id));

  const generateBrief = async () => {
    setBriefLoading(true);
    try {
      setBrief(await api.brief(setup.guest_name, setup.topic, setup.notes));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBriefLoading(false);
    }
  };

  const saveInterview = async (quiet) => {
    const { setup: su, segments: sg, pinned: pn, topics: tp, interviewId: id, brief: br } = ctxRef.current;
    const body = { ...su, segments: sg, pinned: pn, topics: tp, brief: br };
    setSaving(true);
    try {
      let res;
      try {
        res = id ? await api.updateInterview(id, body) : await api.createInterview(body);
      } catch (e) {
        if (e.status !== 404) throw e;
        res = await api.createInterview(body);
      }
      setInterviewId(res.id);
      if (!quiet) toast.success("Interview saved");
    } catch (e) {
      toast.error(`Couldn't save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetWorkspace = (data = {}) => {
    abortRef.current?.abort();
    setSetup({ guest_name: data.guest_name || "", topic: data.topic || "", notes: data.notes || "" });
    setSegments(data.segments || []);
    setPinned(data.pinned || []);
    setTopics(data.topics || []);
    setBrief(data.brief || null);
    setInterviewId(data.id || null);
    setAsked([]);
    setQuestions([]);
    setT0(data.segments?.length ? Math.min(...data.segments.map((s) => s.ts)) : Date.now());
  };
  const loadInterview = (iv) => {
    if (live) return toast.error("Stop listening before opening another interview");
    resetWorkspace(iv);
    setLibraryOpen(false);
    toast.success("Interview opened");
    if (iv.segments?.length) setTimeout(generate, 0);
  };
  const newInterview = () => {
    if (live) return toast.error("Stop listening first");
    if (segments.length && !window.confirm("Start a new interview? Save the current one first if you want to keep it.")) return;
    resetWorkspace();
    setLibraryOpen(false);
  };

  const host = useHostSpeech((text) => addSegment("host", text));
  const guest = useGuestAudio(async (blob, startedAt) => {
    try {
      const recent = ctxRef.current.turns.slice(-3).map((t) => t.text).join(" ");
      const text = await transcribeBlob(blob, `${ctxRef.current.setup.topic}. ${recent}`);
      addSegment("guest", text, startedAt);
    } catch (e) {
      if (Date.now() - lastErrRef.current > 15000) toast.error("A bit of guest audio couldn't be transcribed");
      lastErrRef.current = Date.now();
    }
  });
  const lastErrRef = useRef(0);
  useEffect(() => {
    const h = (e) => toast.error(e.detail);
    window.addEventListener("host-mic-error", h);
    return () => window.removeEventListener("host-mic-error", h);
  }, []);

  const live = host.active || guest.active;
  const { ms: elapsedMs, label: elapsed } = useElapsed(t0, live, segments.reduce((m, s) => Math.max(m, s.ts), 0));

  const startHost = () => { try { host.start(); } catch (e) { toast.error(e.message); } };
  const startGuest = async () => {
    try { await guest.start(); } catch (e) { if (e.name !== "NotAllowedError") toast.error(e.message); else toast("Guest audio not shared — you can add it from the Guest button."); }
  };
  const startAll = async () => {
    if (!segments.length) setT0(Date.now());
    if (setup.notes.trim() && !topics.length) extractTopics();
    startHost();
    await startGuest();
  };
  const stopAll = () => {
    host.stop();
    guest.stop();
    if (segments.length) setTimeout(() => saveInterview(true).then(() => toast.success("Interview auto-saved")), 1500);
  };

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
    setSegments([]); setAsked([]); setQuestions([]); setT0(Date.now()); setInterviewId(null);
    setTopics((ts) => ts.map((t) => ({ ...t, status: "open" })));
  };

  const panels = {
    setup: <SetupPanel setup={setup} setSetup={setSetup} hasBrief={!!brief} hasTranscript={segments.length > 0} onOpenBrief={() => setBriefOpen(true)} />,
    talk: <TalkMeter segments={segments} />,
    pacing: <PacingPanel elapsedMs={elapsedMs} targetMin={targetMin} setTargetMin={setTargetMin} topics={topics} />,
    glance: <BriefGlance brief={brief} onOpen={() => setBriefOpen(true)} />,
    transcript: (
      <TranscriptFeed turns={turns} interim={host.interim} guestName={setup.guest_name} t0={t0}
        onAdd={(sp, text) => addSegment(sp, text)} onClear={clearTranscript} guestSpeaking={guest.speaking} compact={compact} />
    ),
    suggestions: (
      <SuggestionsPanel questions={questions} loading={loading} error={error} focus={focus}
        setFocus={(f) => { setFocus(f); ctxRef.current.focus = f; if (turns.length) generate(); }}
        onRefresh={generate} canGenerate={turns.length > 0 && !loading} auto={auto} setAuto={setAuto}
        isPinned={isPinned} onPin={togglePin} onCopy={copy} onUsed={markUsed} />
    ),
    coverage: (
      <CoveragePanel topics={topics} extracting={extracting} checking={checking} hasNotes={!!setup.notes.trim()}
        onExtract={extractTopics} onCheck={() => checkCoverage(true)} onCycle={cycleTopic} onAdd={addTopic} onRemove={removeTopic} />
    ),
    pinned: (
      <PinnedPanel pinned={pinned} onCopy={copy} onClear={() => setPinned([])}
        onRemove={(id) => setPinned((ps) => ps.filter((p) => p.id !== id))}
        onToggleAsked={(id) => setPinned((ps) => ps.map((p) => (p.id === id ? { ...p, asked: !p.asked } : p)))} />
    ),
  };
  const counts = { coverage: topics.length ? `${topics.filter((t) => t.status === "covered").length}/${topics.length}` : "", pinned: pinned.length || "" };

  return (
    <div className="app-root">
      <Toaster theme="dark" position="bottom-center" />
      <TopBar host={host} guest={guest} live={live} elapsed={elapsed} onStart={startAll} onStop={stopAll}
        onToggleHost={() => (host.active ? host.stop() : startHost())}
        onToggleGuest={() => (guest.active ? guest.stop() : startGuest())}
        compact={compact} onToggleCompact={() => setCompact(!compact)} saving={saving}
        textScale={textScale} onCycleText={() => setTextScale(SCALES[(SCALES.indexOf(textScale) + 1) % SCALES.length] ?? 1)}
        onSave={() => saveInterview(false)} onLibrary={() => setLibraryOpen(true)} />
      <LibrarySheet open={libraryOpen} onOpenChange={setLibraryOpen} onLoad={loadInterview} onNew={newInterview} currentId={interviewId} />
      <BriefDialog open={briefOpen} onOpenChange={setBriefOpen} brief={brief} loading={briefLoading} onGenerate={generateBrief}
        setup={setup} isPinned={isPinned} onPin={(q) => togglePin({ text: q })} />
      {compact ? <CompactLayout panels={panels} counts={counts} /> : (
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 md:p-6">
          <div className="lg:col-span-5 flex flex-col gap-4 lg:h-[calc(100vh-var(--hdr,70px)-2rem)] lg:sticky lg:top-[calc(var(--hdr,70px)+1rem)] lg:overflow-y-auto">
            {panels.setup}
            {panels.glance}
            {panels.transcript}
          </div>
          <div className="lg:col-span-7 flex flex-col gap-4">
            {panels.suggestions}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <div className="flex flex-col gap-4">
                {panels.talk}
                {panels.pacing}
                {panels.coverage}
              </div>
              {panels.pinned}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
