# Iteration 2: topics extract/coverage, interviews CRUD, suggest with open_topics
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

NOTES = """Guest: Maya Chen, founder of SolarRoof.
- Childhood in rural Oregon, grew up off-grid
- Dropped out of Stanford engineering
- First startup failed in 2015 (battery company)
- SolarRoof raised $40M Series B in 2023
- Controversy over supply chain labor in panels
- Plans to expand to India
- Views on climate policy and subsidies
- Work-life balance, two kids"""


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


# --- Topics extract
class TestExtract:
    def test_extract_ok(self, s):
        r = s.post(f"{API}/topics/extract", json={"topic": "Solar startups", "notes": NOTES}, timeout=60)
        assert r.status_code == 200, r.text
        topics = r.json()["topics"]
        assert 5 <= len(topics) <= 12, topics
        for t in topics:
            assert isinstance(t["id"], str) and t["id"]
            assert isinstance(t["label"], str) and t["label"]
            assert t["status"] == "open"
        assert len({t["id"] for t in topics}) == len(topics)

    def test_extract_empty_notes(self, s):
        r = s.post(f"{API}/topics/extract", json={"topic": "x", "notes": "   "})
        assert r.status_code == 400

    def test_extract_missing_notes(self, s):
        r = s.post(f"{API}/topics/extract", json={"topic": "x"})
        assert r.status_code == 422


# --- Coverage
TOPICS = [
    {"id": "t1", "label": "First startup failure", "status": "open"},
    {"id": "t2", "label": "Expansion to India", "status": "open"},
    {"id": "t3", "label": "Childhood off-grid", "status": "covered"},
    {"id": "t4", "label": "Climate policy views", "status": "touched"},
]
TRANSCRIPT = [
    {"speaker": "host", "text": "Tell me about your first company."},
    {"speaker": "guest", "text": "My first startup was a battery company in 2015. It failed because we ran out of cash, "
                                 "our cells overheated in testing, and our lead investor pulled out. I learned to raise more "
                                 "runway and to test earlier. It took me two years to recover emotionally from that failure."},
]


class TestCoverage:
    def test_coverage_statuses_and_no_downgrade(self, s):
        r = s.post(f"{API}/topics/coverage", json={"topics": TOPICS, "transcript": TRANSCRIPT}, timeout=60)
        assert r.status_code == 200, r.text
        out = {t["id"]: t for t in r.json()["topics"]}
        assert set(out) == {"t1", "t2", "t3", "t4"}
        for t in out.values():
            assert t["status"] in ("open", "touched", "covered")
        assert out["t1"]["status"] in ("touched", "covered")
        assert out["t2"]["status"] == "open"
        assert out["t3"]["status"] == "covered"  # never downgraded
        assert out["t4"]["status"] in ("touched", "covered")  # never downgraded
        assert out["t1"]["label"] == "First startup failure"

    def test_coverage_empty_transcript_passthrough(self, s):
        r = s.post(f"{API}/topics/coverage", json={"topics": TOPICS, "transcript": []})
        assert r.status_code == 200
        assert r.json()["topics"] == TOPICS

    def test_coverage_empty_topics(self, s):
        r = s.post(f"{API}/topics/coverage", json={"topics": [], "transcript": TRANSCRIPT})
        assert r.status_code == 200
        assert r.json()["topics"] == []


# --- Suggest with open_topics
def test_suggest_open_topics(s):
    r = s.post(f"{API}/suggest", json={"transcript": TRANSCRIPT, "open_topics": ["Expansion to India"]},
               stream=True, timeout=60)
    assert r.status_code == 200
    body = r.text
    assert "[DONE]" in body
    assert '"error"' not in body


# --- Interviews CRUD
@pytest.fixture(scope="class")
def created_ids(s):
    ids = []
    yield ids
    for i in ids:
        s.delete(f"{API}/interviews/{i}")


class TestInterviews:
    payload = {
        "guest_name": "TEST_Maya",
        "topic": "TEST_Solar",
        "notes": "some notes",
        "segments": [{"id": "a1", "speaker": "host", "text": "Hi", "ts": 1000.0},
                     {"id": "a2", "speaker": "guest", "text": "Hello there", "ts": 2000.0}],
        "pinned": [{"id": "p1", "text": "Why India?", "asked": False}],
        "topics": [{"id": "t1", "label": "India", "status": "open"}],
    }

    def test_create_get_list_update_delete(self, s, created_ids):
        r = s.post(f"{API}/interviews", json=self.payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_id" not in d and isinstance(d["id"], str) and len(d["id"]) == 24
        created_ids.append(d["id"])
        assert d["guest_name"] == "TEST_Maya" and len(d["segments"]) == 2 and d["pinned"][0]["text"] == "Why India?"
        assert d["created_at"] == d["updated_at"]
        iid = d["id"]

        g = s.get(f"{API}/interviews/{iid}")
        assert g.status_code == 200
        gd = g.json()
        assert gd["id"] == iid and gd["notes"] == "some notes" and gd["topics"][0]["label"] == "India"

        time.sleep(0.5)
        r2 = s.post(f"{API}/interviews", json={**self.payload, "guest_name": "TEST_Second", "segments": []})
        assert r2.status_code == 200
        id2 = r2.json()["id"]
        created_ids.append(id2)

        lst = s.get(f"{API}/interviews").json()
        ids = [x["id"] for x in lst]
        assert ids.index(id2) < ids.index(iid)  # sorted by updated_at desc
        item = next(x for x in lst if x["id"] == iid)
        assert item["turns"] == 2 and item["pinned"] == 1 and item["topic"] == "TEST_Solar"
        assert "segments" not in item and "notes" not in item

        time.sleep(0.5)
        upd = {**self.payload, "guest_name": "TEST_Maya_upd",
               "topics": [{"id": "t1", "label": "India", "status": "covered"}]}
        u = s.put(f"{API}/interviews/{iid}", json=upd)
        assert u.status_code == 200, u.text
        ud = u.json()
        assert ud["id"] == iid and ud["guest_name"] == "TEST_Maya_upd" and ud["updated_at"] > ud["created_at"]
        assert s.get(f"{API}/interviews/{iid}").json()["topics"][0]["status"] == "covered"
        lst = s.get(f"{API}/interviews").json()
        assert lst[0]["id"] == iid  # now most recent

        dl = s.delete(f"{API}/interviews/{iid}")
        assert dl.status_code == 200 and dl.json() == {"ok": True}
        assert s.get(f"{API}/interviews/{iid}").status_code == 404
        assert s.delete(f"{API}/interviews/{iid}").status_code == 404

    @pytest.mark.parametrize("bad", ["abc", "000000000000000000000000"])
    def test_404s(self, s, bad):
        assert s.get(f"{API}/interviews/{bad}").status_code == 404
        assert s.put(f"{API}/interviews/{bad}", json=self.payload).status_code == 404
        assert s.delete(f"{API}/interviews/{bad}").status_code == 404

    def test_create_minimal(self, s, created_ids):
        r = s.post(f"{API}/interviews", json={})
        assert r.status_code == 200
        created_ids.append(r.json()["id"])
        assert r.json()["segments"] == []
