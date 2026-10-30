from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from pydantic import BeforeValidator, ConfigDict, Field
from typing import List, Optional, Annotated
from pathlib import Path
from datetime import datetime, timezone
from bson import ObjectId
import re
import os
import io
import json
import uuid
import logging

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from emergentintegrations.llm.openai import OpenAISpeechToText

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI()
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

stt = OpenAISpeechToText(api_key=LLM_KEY)

FOCUS = {
    "balanced": "Mix the types: dig deeper, clarify, challenge, and connect to the background notes.",
    "stories": "Favour questions that draw out personal stories, specific moments, feelings and turning points.",
    "technical": "Favour precise questions about how things work, numbers, methods and specifics.",
    "challenge": "Favour respectful but pointed questions that test claims, surface tension or counterpoints.",
    "timeline": "Favour questions about sequence: what came before, what happened next, what changes ahead.",
    "wrapup": "The interview is in its FINAL MINUTES. Suggest graceful closing questions: tie back to the biggest theme discussed, a quick final touch on the most important open prep topic (these topics have NOT been discussed yet - never imply the guest already mentioned them), what's next for the guest, a last word or advice, and where people can follow them. Use TYPE Pivot or Connect or Story.",
}

SYSTEM = """You are a silent co-pilot for a live interviewer. You read the running transcript and suggest the best follow-up questions the HOST could ask next.
Rules:
- React to what the GUEST just said most recently. Pick up on specific words, claims, names, numbers, emotions or things left unsaid.
- Use the background notes to make questions sharper (connect to facts the guest has not yet mentioned), but never repeat a question already asked.
- Questions must be short, natural and speakable out loud (max ~25 words). One question each, no preamble.
- Output EXACTLY 4 lines, nothing else. Each line format: TYPE | question
- TYPE is one of: Deeper, Clarify, Challenge, Story, Connect, Pivot"""

HALLUCINATIONS = {"you", "thank you.", "thanks for watching!", "thank you for watching.", "bye.", "."}


PyObjectId = Annotated[str, BeforeValidator(str)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, validation_alias="_id")

    @classmethod
    def from_mongo(cls, doc):
        return cls.model_validate(doc)

    def to_mongo(self):
        return self.model_dump(exclude={"id"})


class Turn(BaseModel):
    speaker: str
    text: str


class Topic(BaseModel):
    id: str
    label: str
    status: str = "open"


class Segment(BaseModel):
    id: str
    speaker: str
    text: str
    ts: float


class PinnedQ(BaseModel):
    id: str
    text: str
    asked: bool = False


class InterviewIn(BaseModel):
    guest_name: str = ""
    topic: str = ""
    notes: str = ""
    segments: List[Segment] = []
    pinned: List[PinnedQ] = []
    topics: List[Topic] = []
    brief: Optional[dict] = None


class Interview(BaseDocument, InterviewIn):
    created_at: str
    updated_at: str


class InterviewSummary(BaseModel):
    id: str
    guest_name: str
    topic: str
    created_at: str
    updated_at: str
    turns: int
    pinned: int


class SuggestRequest(BaseModel):
    topic: str = ""
    guest_name: str = ""
    notes: str = ""
    focus: str = "balanced"
    transcript: List[Turn]
    asked: List[str] = []
    open_topics: List[str] = []


class ExtractRequest(BaseModel):
    topic: str = ""
    notes: str


class CoverageRequest(BaseModel):
    topics: List[Topic]
    transcript: List[Turn]


def build_prompt(req: SuggestRequest) -> str:
    guest = req.guest_name or "Guest"
    lines = [f"{'HOST' if t.speaker == 'host' else guest.upper()}: {t.text}" for t in req.transcript[-60:]]
    asked = "\n".join(f"- {q}" for q in req.asked[-30:]) or "(none)"
    return (
        f"INTERVIEW TOPIC: {req.topic or '(not set)'}\nGUEST: {guest}\n\n"
        f"BACKGROUND NOTES:\n{req.notes or '(none)'}\n\n"
        f"QUESTIONS ALREADY ASKED / USED:\n{asked}\n\n"
        f"PREP TOPICS NOT YET COVERED (for Pivot/Connect, frame as new ground the guest has not mentioned yet): {', '.join(req.open_topics) or '(none)'}\n\n"
        f"FOCUS: {FOCUS.get(req.focus, FOCUS['balanced'])}\n\n"
        f"TRANSCRIPT SO FAR (most recent last):\n" + "\n".join(lines) +
        "\n\nGive the 4 best follow-up questions now."
    )


@api_router.get("/")
async def root():
    return {"message": "Interview co-pilot ready"}


@api_router.post("/suggest")
async def suggest(req: SuggestRequest):
    if not req.transcript:
        raise HTTPException(400, "Transcript is empty")
    chat = LlmChat(api_key=LLM_KEY, session_id=str(uuid.uuid4()), system_message=SYSTEM).with_model(
        "gemini", "gemini-3-flash-preview").with_params(extra_body={"reasoning_effort": "minimal"})
    prompt = build_prompt(req)

    async def gen():
        try:
            async for ev in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    yield f"data: {json.dumps({'t': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("suggest failed")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api_router.post("/transcribe")
async def transcribe(file: UploadFile = File(...), prompt: str = Form("")):
    data = await file.read()
    if len(data) < 3000:
        return {"text": ""}
    buf = io.BytesIO(data)
    buf.name = file.filename or "chunk.webm"
    try:
        resp = await stt.transcribe(file=buf, model="gpt-4o-mini-transcribe", response_format="json",
                                    prompt=prompt[-400:] or None)
    except Exception as e:
        logger.exception("transcribe failed")
        raise HTTPException(502, f"Transcription failed: {e}")
    text = (resp.text or "").strip()
    if text.lower() in HALLUCINATIONS:
        text = ""
    return {"text": text}


def fast_chat(system: str) -> LlmChat:
    return LlmChat(api_key=LLM_KEY, session_id=str(uuid.uuid4()), system_message=system).with_model(
        "gemini", "gemini-3-flash-preview").with_params(extra_body={"reasoning_effort": "minimal"})


def parse_json(text: str):
    m = re.search(r"[\[{].*[\]}]", text, re.S)
    if not m:
        raise HTTPException(502, "AI returned no data")
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        raise HTTPException(502, "AI returned malformed data, try again")


@api_router.post("/topics/extract")
async def extract_topics(req: ExtractRequest):
    if not req.notes.strip():
        raise HTTPException(400, "Add some prep notes first")
    chat = fast_chat("You turn an interviewer's prep notes into a checklist of distinct subjects to cover. "
                     "Return ONLY a JSON array of 5-12 short labels (2-6 words each), in a sensible interview order.")
    text = await chat.send_message(UserMessage(text=f"Interview topic: {req.topic}\n\nPrep notes:\n{req.notes[:60000]}"))
    data = parse_json(text)
    if not isinstance(data, list):
        raise HTTPException(502, "AI returned malformed data, try again")
    labels = [str(x).strip() for x in data if str(x).strip()][:15]
    return {"topics": [Topic(id=uuid.uuid4().hex[:8], label=label).model_dump() for label in labels]}


@api_router.post("/topics/coverage")
async def topic_coverage(req: CoverageRequest):
    if not req.topics or not req.transcript:
        return {"topics": [t.model_dump() for t in req.topics]}
    chat = fast_chat("You track which interview prep topics have been discussed. For each topic decide: "
                     "'covered' = discussed in some depth, 'touched' = briefly mentioned, 'open' = not discussed. "
                     "Return ONLY a JSON object mapping topic id to status.")
    listing = "\n".join(f"{t.id}: {t.label}" for t in req.topics)
    convo = "\n".join(f"{t.speaker.upper()}: {t.text}" for t in req.transcript[-120:])
    result = parse_json(await chat.send_message(UserMessage(text=f"TOPICS:\n{listing}\n\nTRANSCRIPT:\n{convo}")))
    rank = {"open": 0, "touched": 1, "covered": 2}
    out = []
    for t in req.topics:
        new = result.get(t.id, "open") if isinstance(result, dict) else "open"
        status = new if rank.get(new, 0) > rank.get(t.status, 0) else t.status
        out.append(Topic(id=t.id, label=t.label, status=status).model_dump())
    return {"topics": out}


class BriefRequest(BaseModel):
    guest_name: str = ""
    topic: str = ""
    notes: str


BRIEF_SYSTEM = """You prepare an interviewer for a call. From their prep notes write a one-page brief.
Return ONLY JSON with this shape:
{"snapshot": "2-3 sentence summary of who the guest is and why they matter for this topic",
 "key_facts": ["5-8 short facts worth remembering, with numbers/dates when present"],
 "angles": [{"title": "short angle name", "why": "one sentence on why it's interesting / what it could reveal"}],
 "openers": ["3-5 strong, warm opening questions, speakable, max 25 words"],
 "deeper": ["4-6 deeper or challenging questions for later in the interview"],
 "watch_outs": ["2-4 sensitivities, contradictions or things to verify"]}
Give 3-5 angles. Only use facts from the notes; do not invent."""


@api_router.post("/brief")
async def prep_brief(req: BriefRequest):
    if not req.notes.strip():
        raise HTTPException(400, "Add some prep notes first")
    chat = fast_chat(BRIEF_SYSTEM)
    text = await chat.send_message(UserMessage(
        text=f"Guest: {req.guest_name or '(unnamed)'}\nInterview topic: {req.topic or '(not set)'}\n\nPrep notes:\n{req.notes[:60000]}"))
    data = parse_json(text)
    if not isinstance(data, dict):
        raise HTTPException(502, "AI returned malformed data, try again")
    def strs(key, cap):
        val = data.get(key)
        return [str(x) for x in val][:cap] if isinstance(val, list) else []

    angles = data.get("angles") if isinstance(data.get("angles"), list) else []
    return {
        "snapshot": str(data.get("snapshot", "")),
        "key_facts": strs("key_facts", 10),
        "angles": [{"title": str(a.get("title", "")), "why": str(a.get("why", ""))} for a in angles if isinstance(a, dict)][:6],
        "openers": strs("openers", 6),
        "deeper": strs("deeper", 8),
        "watch_outs": strs("watch_outs", 5),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def oid(interview_id: str) -> ObjectId:
    if not ObjectId.is_valid(interview_id):
        raise HTTPException(404, "Interview not found")
    return ObjectId(interview_id)


@api_router.get("/interviews", response_model=List[InterviewSummary])
async def list_interviews():
    docs = await db.interviews.find({}, {"notes": 0}).sort("updated_at", -1).to_list(500)
    return [InterviewSummary(id=str(d["_id"]), guest_name=d.get("guest_name", ""), topic=d.get("topic", ""),
                             created_at=d["created_at"], updated_at=d["updated_at"],
                             turns=len(d.get("segments", [])), pinned=len(d.get("pinned", []))) for d in docs]


@api_router.post("/interviews", response_model=Interview)
async def create_interview(body: InterviewIn):
    now = datetime.now(timezone.utc).isoformat()
    item = Interview(**body.model_dump(), created_at=now, updated_at=now)
    res = await db.interviews.insert_one(item.to_mongo())
    item.id = str(res.inserted_id)
    return item


@api_router.get("/interviews/{interview_id}", response_model=Interview)
async def get_interview(interview_id: str):
    doc = await db.interviews.find_one({"_id": oid(interview_id)})
    if not doc:
        raise HTTPException(404, "Interview not found")
    return Interview.from_mongo(doc)


@api_router.put("/interviews/{interview_id}", response_model=Interview)
async def update_interview(interview_id: str, body: InterviewIn):
    update = {**body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    doc = await db.interviews.find_one_and_update({"_id": oid(interview_id)}, {"$set": update}, return_document=True)
    if not doc:
        raise HTTPException(404, "Interview not found")
    return Interview.from_mongo(doc)


@api_router.delete("/interviews/{interview_id}")
async def delete_interview(interview_id: str):
    res = await db.interviews.delete_one({"_id": oid(interview_id)})
    if not res.deleted_count:
        raise HTTPException(404, "Interview not found")
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
