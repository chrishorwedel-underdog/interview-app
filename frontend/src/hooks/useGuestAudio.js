import { useRef, useState, useCallback } from "react";

const VOICE_RMS = 0.012;
const PAUSE_MS = 750;
const MAX_SEG_MS = 7000;
const IDLE_SEG_MS = 3000;

// Captures the call's audio (shared tab / screen), cuts it into speech segments on pauses.
export function useGuestAudio(onSegment) {
  const [active, setActive] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const st = useRef({});
  const cbRef = useRef(onSegment);
  cbRef.current = onSegment;

  const newRecorder = (stream) => {
    const s = st.current;
    const chunks = [];
    const startedAt = Date.now();
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      if (rec._send) cbRef.current(new Blob(chunks, { type: "audio/webm" }), startedAt);
    };
    rec.start();
    s.rec = rec;
    s.segStart = startedAt;
    s.hasVoice = false;
  };

  const cut = (send) => {
    const s = st.current;
    if (!s.rec) return;
    s.rec._send = send;
    s.rec.stop();
    if (s.running) newRecorder(s.stream);
  };

  const start = useCallback(async () => {
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      systemAudio: "include",
    });
    const tracks = display.getAudioTracks();
    display.getVideoTracks().forEach((t) => t.stop());
    if (!tracks.length) throw new Error("No audio was shared. Pick the call's tab and turn on \"Share tab audio\".");
    const stream = new MediaStream(tracks);
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const s = st.current;
    Object.assign(s, { stream, ctx, running: true, lastVoice: 0 });
    newRecorder(stream);

    s.timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = Date.now();
      setLevel(Math.min(1, rms * 12));
      if (rms > VOICE_RMS) { s.lastVoice = now; s.hasVoice = true; }
      const isSpeaking = now - s.lastVoice < PAUSE_MS;
      setSpeaking(isSpeaking);
      if (s.hasVoice && (!isSpeaking || now - s.segStart > MAX_SEG_MS)) cut(true);
      else if (!s.hasVoice && now - s.segStart > IDLE_SEG_MS) cut(false);
    }, 60);

    tracks[0].onended = () => stop();
    setActive(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    const s = st.current;
    if (!s.running) return;
    s.running = false;
    clearInterval(s.timer);
    cut(!!s.hasVoice);
    s.stream?.getTracks().forEach((t) => t.stop());
    s.ctx?.close();
    setActive(false);
    setSpeaking(false);
    setLevel(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { active, speaking, level, start, stop };
}
