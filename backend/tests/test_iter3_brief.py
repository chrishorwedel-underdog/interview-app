# Iteration 3: Guest Prep Brief endpoint + brief persistence on interviews
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

NOTES = ("Dr. Maya Chen founded VoltCell in 2015, a solid-state battery startup. Raised $120M Series C in 2021. "
         "Previously worked at Tesla for 6 years on battery chemistry. Left Tesla after disagreement on safety testing. "
         "VoltCell recalled 2,000 units in 2023 due to overheating. Plans IPO in 2026. Mother of two, grew up in Taipei.")


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


# Brief generation
class TestBrief:
    def test_brief_empty_notes_400(self, s):
        r = s.post(f"{BASE_URL}/api/brief", json={"guest_name": "X", "topic": "Y", "notes": "   "}, timeout=30)
        assert r.status_code == 400
        assert "notes" in r.json()["detail"].lower()

    def test_brief_missing_notes_422(self, s):
        r = s.post(f"{BASE_URL}/api/brief", json={"guest_name": "X"}, timeout=30)
        assert r.status_code == 422

    def test_brief_generate_shape(self, s):
        r = s.post(f"{BASE_URL}/api/brief", json={"guest_name": "Maya Chen", "topic": "Future of batteries", "notes": NOTES}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["snapshot"], str) and len(d["snapshot"]) > 20
        for k in ("key_facts", "openers", "deeper", "watch_outs", "angles"):
            assert isinstance(d[k], list) and len(d[k]) > 0, k
        assert all(isinstance(x, str) for x in d["openers"])
        assert 3 <= len(d["openers"]) <= 6
        assert all(set(a.keys()) == {"title", "why"} and a["title"] for a in d["angles"])
        assert isinstance(d["created_at"], str) and "T" in d["created_at"]


# Interviews with brief field
class TestInterviewBrief:
    def test_brief_roundtrip(self, s):
        brief = {"snapshot": "TEST snap", "key_facts": ["a"], "angles": [{"title": "t", "why": "w"}],
                 "openers": ["o1"], "deeper": ["d1"], "watch_outs": ["w1"], "created_at": "2026-01-01T00:00:00"}
        r = s.post(f"{BASE_URL}/api/interviews", json={"guest_name": "TEST_brief", "brief": brief})
        assert r.status_code == 200
        iid = r.json()["id"]
        try:
            assert r.json()["brief"]["snapshot"] == "TEST snap"
            g = s.get(f"{BASE_URL}/api/interviews/{iid}").json()
            assert g["brief"]["openers"] == ["o1"]
            assert g["brief"]["angles"][0]["title"] == "t"
            brief["snapshot"] = "TEST updated"
            u = s.put(f"{BASE_URL}/api/interviews/{iid}", json={"guest_name": "TEST_brief", "brief": brief})
            assert u.status_code == 200 and u.json()["brief"]["snapshot"] == "TEST updated"
            assert s.get(f"{BASE_URL}/api/interviews/{iid}").json()["brief"]["snapshot"] == "TEST updated"
            u2 = s.put(f"{BASE_URL}/api/interviews/{iid}", json={"guest_name": "TEST_brief", "brief": None})
            assert u2.json()["brief"] is None
        finally:
            s.delete(f"{BASE_URL}/api/interviews/{iid}")

    def test_interview_without_brief(self, s):
        r = s.post(f"{BASE_URL}/api/interviews", json={"guest_name": "TEST_nobrief"})
        assert r.status_code == 200
        iid = r.json()["id"]
        try:
            assert r.json()["brief"] is None
            assert s.get(f"{BASE_URL}/api/interviews/{iid}").json()["brief"] is None
        finally:
            s.delete(f"{BASE_URL}/api/interviews/{iid}")
