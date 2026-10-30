const stamp = (ts, t0) => {
  const s = Math.max(0, Math.floor((ts - t0) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const list = (title, items) => (items?.length ? [`**${title}**`, ...items.map((x) => `- ${x}`), ""] : []);

const briefMd = (b) => [
  "## Prep brief",
  b.snapshot,
  "",
  ...list("Key facts", b.key_facts),
  ...list("Likely angles", (b.angles || []).map((a) => `${a.title}: ${a.why}`)),
  ...list("Opening questions", b.openers),
  ...list("Go deeper later", b.deeper),
  ...list("Watch outs", b.watch_outs),
];

export function interviewToMarkdown(iv) {
  const guest = iv.guest_name || "Guest";
  const segs = [...(iv.segments || [])].sort((a, b) => a.ts - b.ts);
  const t0 = segs[0]?.ts || 0;
  const lines = [
    `# ${iv.topic || "Interview"}${iv.guest_name ? ` — ${iv.guest_name}` : ""}`,
    iv.created_at ? `_${new Date(iv.created_at).toLocaleString()}_` : "",
    "",
    ...(iv.brief ? briefMd(iv.brief) : []),
    "## Shortlisted questions",
    ...(iv.pinned?.length ? iv.pinned.map((p) => `- [${p.asked ? "x" : " "}] ${p.text}`) : ["_None_"]),
    "",
    "## Topic coverage",
    ...(iv.topics?.length ? iv.topics.map((t) => `- ${t.label} — ${t.status}`) : ["_None_"]),
    "",
    "## Transcript",
    ...segs.map((s) => `**[${stamp(s.ts, t0)}] ${s.speaker === "guest" ? guest : "Host"}:** ${s.text}`),
  ];
  return lines.join("\n");
}

export function downloadMarkdown(iv) {
  const blob = new Blob([interviewToMarkdown(iv)], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const name = [iv.guest_name, iv.topic].filter(Boolean).join("-") || "interview";
  a.download = `${name.replace(/[^a-z0-9-]+/gi, "_").toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}
