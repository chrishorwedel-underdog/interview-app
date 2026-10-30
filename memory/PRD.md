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

## Implemented (2026-06)
- Setup panel (guest, topic, notes), live 2-speaker transcript, manual line input
- Auto/manual follow-up generation, 4 typed questions, focus filters
- Pin shortlist (asked/remove/clear), copy, mark-asked (excluded from future suggestions)
- Tested: backend 13/13, frontend all flows pass

## Backlog
- P1: Save past interviews & export transcript + questions
- P1: Compact side-window mode / keyboard shortcuts
- P2: Speaker-name diarisation for multi-guest panels
