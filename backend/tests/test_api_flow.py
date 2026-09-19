"""End-to-end API tests for the real (non-demo) emergency workflow."""
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import Base, engine, SessionLocal
from app.database.init_db import init_db
from app.models.entities import Referral, Hospital, EmergencyBed, Emergency
from app.services.referral_service import referral_service

ADMIN = {"X-Demo-Role": "ADMIN"}
PATIENT = {"X-Demo-Role": "PATIENT"}


def staff(hospital_id="hosp_lagos_central"):
    return {"X-Demo-Role": "HOSPITAL_STAFF", "X-Demo-Hospital": hospital_id}


@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    init_db()
    return TestClient(app)


TRAUMA = {
    "latitude": 6.5, "longitude": 3.4, "category": "Road accident", "patient_count": 1,
    "description": "Motorcycle accident. Unconscious with severe bleeding, suspected head injury and leg fracture.",
}


def report(client, **over):
    r = client.post("/api/emergencies", headers=PATIENT, json={**TRAUMA, **over})
    assert r.status_code == 201, r.text
    return r.json()


def test_seed_loads_ten_hospitals(client):
    assert len(client.get("/api/hospitals", headers=ADMIN).json()) == 10


def test_intake_auto_matches_and_dispatches(client):
    em = report(client)
    assert em["status"] == "AWAITING_ACCEPTANCE"
    matches = client.get(f"/api/emergencies/{em['id']}/matches", headers=ADMIN).json()
    assert matches["eligible_count"] >= 2
    refs = client.get("/api/referrals?status_filter=REQUESTED", headers=ADMIN).json()
    assert len(refs) == 1
    assert refs[0]["emergency"]["severity"] == "CRITICAL"
    # the referral goes to the #1 ranked hospital
    top = [m for m in matches["matches"] if m["rank"] == 1][0]
    assert refs[0]["hospital_id"] == top["hospital_id"]


def test_ineligible_hospitals_are_excluded_with_reasons(client):
    em = report(client)
    by_id = {m["hospital_id"]: m for m in client.get(f"/api/emergencies/{em['id']}/matches", headers=ADMIN).json()["matches"]}
    assert not by_id["hosp_maryland_clinic"]["eligibility"]        # ED closed
    assert not by_id["hosp_ikorodu_general"]["eligibility"]        # no free beds + no neurosurgeon
    assert not by_id["hosp_ajah_memorial"]["eligibility"]          # data 75 min old
    assert "stale" in by_id["hosp_ajah_memorial"]["rejection_reason"]


def test_accept_reserves_bed_per_patient(client):
    em = report(client, patient_count=2)
    ref = client.get("/api/referrals?status_filter=REQUESTED", headers=ADMIN).json()[0]
    r = client.post(f"/api/referrals/{ref['id']}/accept", headers=staff(ref["hospital_id"]), json={})
    assert r.status_code == 200, r.text
    assert r.json()["beds_reserved"] == 2


def test_accept_with_no_free_bed_is_refused(client):
    report(client)
    ref = client.get("/api/referrals?status_filter=REQUESTED", headers=ADMIN).json()[0]
    hid = ref["hospital_id"]
    assert client.patch(f"/api/hospitals/{hid}/beds", headers=staff(hid), json={"total_beds": 5, "available_beds": 0}).status_code == 200
    r = client.post(f"/api/referrals/{ref['id']}/accept", headers=staff(hid), json={})
    assert r.status_code == 409
    assert "no free emergency bed" in r.json()["detail"]


def test_reject_fails_over_to_next_hospital(client):
    report(client)
    first = client.get("/api/referrals?status_filter=REQUESTED", headers=ADMIN).json()[0]
    r = client.post(f"/api/referrals/{first['id']}/reject", headers=staff(first["hospital_id"]), json={"reason": "surge"})
    assert r.status_code == 200
    assert r.json()["next_hospital_contacted"] and r.json()["failover_triggered"]
    assert r.json()["next_referral_id"] != first["id"]
    stats = client.get("/api/governor/statistics", headers=ADMIN).json()
    assert stats["reroutes_count"] == 1 and stats["referrals_rejected"] == 1
    assert stats["average_matching_time_ms"] > 0


def test_staff_cannot_answer_another_hospitals_referral(client):
    report(client)
    ref = client.get("/api/referrals?status_filter=REQUESTED", headers=ADMIN).json()[0]
    other = "hosp_ikeja_general" if ref["hospital_id"] != "hosp_ikeja_general" else "hosp_lekki_medical"
    r = client.post(f"/api/referrals/{ref['id']}/accept", headers=staff(other), json={})
    assert r.status_code == 403


def test_staff_header_selects_hospital_and_blocks_others(client):
    ok = client.patch("/api/hospitals/hosp_lekki_medical/status", headers=staff("hosp_lekki_medical"), json={"emergency_status": "LIMITED"})
    assert ok.status_code == 200
    bad = client.patch("/api/hospitals/hosp_ikeja_general/status", headers=staff("hosp_lekki_medical"), json={"emergency_status": "CLOSED"})
    assert bad.status_code == 403


def test_anonymous_default_is_not_admin(client):
    assert client.post("/api/simulation/reset").status_code == 403


def test_unanswered_referral_times_out_and_fails_over(client):
    report(client)
    ref = client.get("/api/referrals?status_filter=REQUESTED", headers=ADMIN).json()[0]
    db = SessionLocal()
    r = db.query(Referral).filter(Referral.id == ref["id"]).first()
    r.reservation_expiry = datetime.now(timezone.utc) - timedelta(seconds=5)
    db.commit()
    assert referral_service.expire_stale_referrals(db) == 1
    db.close()
    all_refs = client.get("/api/referrals", headers=ADMIN).json()
    assert {x["status"] for x in all_refs} == {"TIMEOUT", "REQUESTED"}
    assert client.get("/api/governor/statistics", headers=ADMIN).json()["referrals_timed_out"] == 1


def test_bed_endpoint_changes_real_beds_and_keeps_reserved(client):
    report(client)
    ref = client.get("/api/referrals?status_filter=REQUESTED", headers=ADMIN).json()[0]
    hid = ref["hospital_id"]
    client.post(f"/api/referrals/{ref['id']}/accept", headers=staff(hid), json={})
    h = client.patch(f"/api/hospitals/{hid}/beds", headers=staff(hid), json={"total_beds": 3, "available_beds": 3}).json()
    # 1 bed is RESERVED for the live case, so only 2 can be free
    assert h["total_emergency_beds"] == 3 and h["available_emergency_beds"] == 2
    detail = client.get(f"/api/hospitals/{hid}", headers=ADMIN).json()
    assert sum(1 for b in detail["beds"] if b["status"] == "RESERVED") == 1


def test_arrived_then_close_releases_beds(client):
    em = report(client)
    ref = client.get("/api/referrals?status_filter=REQUESTED", headers=ADMIN).json()[0]
    hid = ref["hospital_id"]
    client.post(f"/api/referrals/{ref['id']}/accept", headers=staff(hid), json={})
    before = client.get(f"/api/hospitals/{hid}", headers=ADMIN).json()["available_emergency_beds"]
    assert client.post(f"/api/emergencies/{em['id']}/arrived", headers=staff(hid)).json()["status"] == "ARRIVED"
    assert client.post(f"/api/emergencies/{em['id']}/close", headers=staff(hid)).json()["status"] == "CLOSED"
    after = client.get(f"/api/hospitals/{hid}", headers=ADMIN).json()["available_emergency_beds"]
    assert after == before + 1
    # can't close twice
    assert client.post(f"/api/emergencies/{em['id']}/close", headers=staff(hid)).status_code == 409


def test_limited_hospital_ranks_lower_but_stays_eligible(client):
    base = report(client)
    top = client.get(f"/api/emergencies/{base['id']}/matches", headers=ADMIN).json()["matches"][0]
    client.patch(f"/api/hospitals/{top['hospital_id']}/status", headers=ADMIN, json={"emergency_status": "LIMITED"})
    m = client.post(f"/api/emergencies/{base['id']}/match", headers=ADMIN).json()["matches"]
    same = [x for x in m if x["hospital_id"] == top["hospital_id"]][0]
    assert same["eligibility"] and same["score"] < top["score"]


def test_demo_scenario_and_reset(client):
    r = client.post("/api/demo/scenario/mass-casualty", headers=ADMIN)
    assert r.status_code == 200, r.text
    assert r.json()["second_accepted"] and r.json()["bed_reserved"]
    assert client.post("/api/simulation/reset", headers=ADMIN).status_code == 200
    assert client.get("/api/governor/statistics", headers=ADMIN).json()["active_emergencies"] == 0


def test_login_works(client):
    r = client.post("/api/auth/token", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "ADMIN"
    assert client.post("/api/auth/token", json={"username": "admin", "password": "nope"}).status_code == 401
