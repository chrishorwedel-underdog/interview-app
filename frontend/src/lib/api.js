const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export async function transcribeBlob(blob, prompt) {
  const fd = new FormData();
  fd.append("file", blob, "chunk.webm");
  fd.append("prompt", prompt || "");
  const res = await fetch(`${API}/transcribe`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Transcription failed");
  return (await res.json()).text;
}

export async function streamSuggestions(payload, onText, signal) {
  const res = await fetch(`${API}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new Error("Could not generate questions");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop();
    for (const ev of events) {
      const data = ev.replace(/^data: /, "");
      if (data === "[DONE]") return full;
      const msg = JSON.parse(data);
      if (msg.error) throw new Error(msg.error);
      full += msg.t;
      onText(full);
    }
  }
  return full;
}

const TYPES = ["Deeper", "Clarify", "Challenge", "Story", "Connect", "Pivot"];

export function parseQuestions(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [type, ...rest] = l.split("|");
      const raw = type.replace(/[^a-zA-Z]/g, "").toLowerCase();
      const t = raw.charAt(0).toUpperCase() + raw.slice(1);
      if (rest.length && TYPES.includes(t)) return { type: t, text: rest.join("|").trim() };
      return { type: "Deeper", text: l.replace(/^[-*\d.\s]+/, "") };
    })
    .filter((q) => q.text.length > 3);
}
