from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List
from pathlib import Path
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
}

SYSTEM = """You are a silent co-pilot for a live interviewer. You read the running transcript and suggest the best follow-up questions the HOST could ask next.
Rules:
- React to what the GUEST just said most recently. Pick up on specific words, claims, names, numbers, emotions or things left unsaid.
- Use the background notes to make questions sharper (connect to facts the guest has not yet mentioned), but never repeat a question already asked.
- Questions must be short, natural and speakable out loud (max ~25 words). One question each, no preamble.
- Output EXACTLY 4 lines, nothing else. Each line format: TYPE | question
- TYPE is one of: Deeper, Clarify, Challenge, Story, Connect, Pivot"""

HALLUCINATIONS = {"you", "thank you.", "thanks for watching!", "thank you for watching.", "bye.", "."}


class Turn(BaseModel):
    speaker: str
    text: str


class SuggestRequest(BaseModel):
    topic: str = ""
    guest_name: str = ""
    notes: str = ""
    focus: str = "balanced"
    transcript: List[Turn]
    asked: List[str] = []


def build_prompt(req: SuggestRequest) -> str:
    guest = req.guest_name or "Guest"
    lines = [f"{'HOST' if t.speaker == 'host' else guest.upper()}: {t.text}" for t in req.transcript[-60:]]
    asked = "\n".join(f"- {q}" for q in req.asked[-30:]) or "(none)"
    return (
        f"INTERVIEW TOPIC: {req.topic or '(not set)'}\nGUEST: {guest}\n\n"
        f"BACKGROUND NOTES:\n{req.notes or '(none)'}\n\n"
        f"QUESTIONS ALREADY ASKED / USED:\n{asked}\n\n"
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
