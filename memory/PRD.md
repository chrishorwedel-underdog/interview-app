# Follow-Up · Interview Co-Pilot — PRD

## Original problem
Web app open during an interview that listens to the host's questions and the guest's answers and generates logical follow-up questions in real time.

## User choices
- Video calls: host via local mic, guest via computer/call audio (headphones)
- Best low-cost model; large background notes
- Suggestions must be ready the moment the guest finishes (seamless)
- Extras: topic + guest notes, pin favourite questions

## Architecture
- Backend FastAPI: `/api/suggest` (SSE stream, Gemini 3 Flash, minimal reasoning, ~1s first token), `/api/transcribe` (gpt-4o-mini-transcribe via Emergent LLM key)
- Frontend React: host mic via browser Web Speech API (free, Chrome/Edge); guest audio via shared tab (getDisplayMedia) + voice-activity detection → chunks cut on 750ms pause or every 7s → transcribe → auto-regenerate questions
- State in localStorage (setup, transcript, pinned, asked). No auth.

## Implemented (2026-06, iteration 3)
- Prep brief (/api/brief): a one-page brief with a snapshot, key facts, angles, openers, deeper questions and watch outs. You can pin any question from it, print it or save it as PDF, and it is stored with the saved interview and included in the export.
- Talk time meter: your share of words versus the guest's, overall and for the last 5 minutes, with a warning when you pass 40%
- Larger text: base size is now 18px, with a size switch (M/L/XL) in the top bar. Prep notes collapse automatically once the transcript starts.
- Tested: backend 100%; frontend 95%, then fixed the narrow-header overflow at XL

## Implemented (2026-06, iteration 2)
- Coverage tracker: AI pulls a topic checklist from your prep notes. Topics are marked open, touched or covered automatically as the guest talks (checked at most every 15s), and you can click to change them. Open topics steer the Pivot/Connect questions.
- Saved interviews (MongoDB): Save button, auto-save on Stop, a list of saved interviews with detail, open in workspace, Markdown export, delete and new interview
- Side window mode: a compact tabbed layout (Ask/Live/Topics/Pins/Prep) with a one-row header. The setting is remembered and turns on by default below 900px.
- Higher-contrast text, panels and fields
- Tested: backend 24/24, frontend all flows pass

## Implemented (2026-06)
- Setup panel (guest, topic, notes), live 2-speaker transcript, manual line input
- Auto/manual follow-up generation, 4 typed questions, focus filters
- Pin shortlist (asked/remove/clear), copy, mark-asked (excluded from future suggestions)
- Tested: backend 13/13, frontend all flows pass

## Backlog
- P1: Save past interviews & export transcript + questions
- P1: Compact side-window mode / keyboard shortcuts
- P2: Speaker-name diarisation for multi-guest panels
