# Interview co-pilot API tests: /api/, /api/suggest (SSE), /api/transcribe
import os
import io
import json
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
TYPES = {"Deeper", "Clarify", "Challenge", "Story", "Connect", "Pivot"}


def read_sse(resp):
    chunks, done, errors = [], False, []
    for line in resp.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue
        data = line[6:]
        if data == "[DONE]":
            done = True
            break
        msg = json.loads(data)
        if "error" in msg:
            errors.append(msg["error"])
        else:
            chunks.append(msg["t"])
    return "".join(chunks), done, errors, len(chunks)


# Health
def test_root():
    r = requests.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert "message" in r.json()


# Suggest SSE
class TestSuggest:
    payload = {
        "topic": "Building a climate startup",
        "guest_name": "Maya",
        "notes": "Maya founded CarbonLoop in 2019, raised $40M, previously at Tesla.",
        "focus": "balanced",
        "transcript": [
            {"speaker": "host", "text": "What made you leave Tesla?"},
            {"speaker": "guest", "text": "Honestly, I hit a wall. I saw how much carbon was being wasted in supply chains and nobody cared. My dad got sick that year too."},
        ],
        "asked": [],
    }

    def test_suggest_stream_format(self):
        r = requests.post(f"{BASE_URL}/api/suggest", json=self.payload, stream=True, timeout=60)
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        full, done, errors, n = read_sse(r)
        print("FULL:", full, "chunks:", n)
        assert not errors, errors
        assert done
        lines = [l.strip() for l in full.strip().split("\n") if l.strip()]
        assert len(lines) == 4, lines
        for l in lines:
            assert "|" in l
            t = re.sub(r"[^a-zA-Z]", "", l.split("|")[0])
            assert t.capitalize() in TYPES, l

    @pytest.mark.parametrize("focus", ["stories", "technical", "challenge", "timeline", "bogus"])
    def test_suggest_focuses(self, focus):
        p = dict(self.payload, focus=focus)
        r = requests.post(f"{BASE_URL}/api/suggest", json=p, stream=True, timeout=60)
        assert r.status_code == 200
        full, done, errors, _ = read_sse(r)
        assert done and not errors
        assert len([l for l in full.split("\n") if "|" in l]) >= 3

    def test_suggest_empty_transcript(self):
        r = requests.post(f"{BASE_URL}/api/suggest", json=dict(self.payload, transcript=[]))
        assert r.status_code == 400
        assert "empty" in r.json()["detail"].lower()

    def test_suggest_missing_transcript(self):
        r = requests.post(f"{BASE_URL}/api/suggest", json={"topic": "x"})
        assert r.status_code == 422


# Transcribe
class TestTranscribe:
    def test_tiny_file_empty(self):
        r = requests.post(f"{BASE_URL}/api/transcribe", files={"file": ("chunk.webm", b"x" * 100, "audio/webm")},
                          data={"prompt": ""})
        assert r.status_code == 200
        assert r.json() == {"text": ""}

    def test_real_speech_mp3(self):
        from gtts import gTTS
        buf = io.BytesIO()
        gTTS("I left Tesla because supply chains were wasting enormous amounts of carbon.", lang="en").write_to_fp(buf)
        r = requests.post(f"{BASE_URL}/api/transcribe",
                          files={"file": ("speech.mp3", buf.getvalue(), "audio/mpeg")},
                          data={"prompt": "Climate startup interview"}, timeout=60)
        assert r.status_code == 200, r.text
        text = r.json()["text"].lower()
        print("TRANSCRIBED:", text)
        assert "tesla" in text and "carbon" in text

    def test_missing_file(self):
        r = requests.post(f"{BASE_URL}/api/transcribe", data={"prompt": "x"})
        assert r.status_code == 422

    def test_garbage_large_file(self):
        r = requests.post(f"{BASE_URL}/api/transcribe", files={"file": ("chunk.webm", os.urandom(5000), "audio/webm")})
        print(r.status_code, r.text[:200])
        assert r.status_code in (502, 200)
