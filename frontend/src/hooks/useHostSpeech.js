import { useRef, useState, useCallback } from "react";

const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

export function useHostSpeech(onFinal) {
  const [active, setActive] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef(null);
  const wantRef = useRef(false);
  const cbRef = useRef(onFinal);
  cbRef.current = onFinal;

  const start = useCallback(() => {
    if (!SR) throw new Error("Live mic transcription needs Google Chrome or Edge.");
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) cbRef.current(r[0].transcript.trim());
        else tmp += r[0].transcript;
      }
      setInterim(tmp);
    };
    rec.onend = () => {
      if (wantRef.current) {
        try { rec.start(); } catch (_) { /* already started */ }
      } else setActive(false);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") { wantRef.current = false; setActive(false); }
    };
    wantRef.current = true;
    recRef.current = rec;
    rec.start();
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
    setInterim("");
    setActive(false);
  }, []);

  return { active, interim, start, stop, supported: !!SR };
}
