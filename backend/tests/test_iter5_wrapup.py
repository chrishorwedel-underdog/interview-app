# Iteration 5: /api/suggest with focus='wrapup' closing questions
import os
import json
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

TYPES = {"Deeper", "Clarify", "Challenge", "Story", "Connect", "Pivot"}


def stream(payload):
    r = requests.post(f"{BASE_URL}/api/suggest", json=payload, stream=True, timeout=90)
    assert r.status_code == 200, r.text
    full = ""
    for line in r.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue
        d = line[6:]
        if d == "[DONE]":
            break
        obj = json.loads(d)
        assert "error" not in obj, obj
        full += obj.get("t", "")
    return full


PAYLOAD = {
    "topic": "Building a climate startup", "guest_name": "Ana", "notes": "Founded GreenGrid 2019; raised Series B; book coming 2026",
    "focus": "wrapup", "asked": [], "open_topics": ["Series B fundraising", "Upcoming book"],
    "transcript": [
        {"speaker": "host", "text": "How did GreenGrid start?"},
        {"speaker": "guest", "text": "It started in my garage in 2019 after a blackout hit our town for a week."},
    ],
}


def test_wrapup_returns_4_typed_lines():
    full = stream(PAYLOAD)
    lines = [l.strip() for l in full.strip().splitlines() if "|" in l]
    print(full)
    assert len(lines) == 4
    for l in lines:
        t, q = [x.strip() for x in l.split("|", 1)]
        assert t.strip("*- ").title() in TYPES
        assert len(q) > 5


def test_wrapup_empty_transcript_400():
    p = dict(PAYLOAD, transcript=[])
    r = requests.post(f"{BASE_URL}/api/suggest", json=p, timeout=30)
    assert r.status_code == 400


def test_balanced_regression():
    full = stream(dict(PAYLOAD, focus="balanced"))
    assert len([l for l in full.splitlines() if "|" in l]) == 4
