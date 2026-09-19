import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models.entities import (
    Hospital, HospitalSpecialty, HospitalFacility, EmergencyBed, Emergency, EmergencyRequirement, Match, Referral
)
from app.database.session import engine, Base, SessionLocal
from app.ai.mock_provider import MockAIProvider
from app.governor.engine import GovernorDecisionEngine, CandidateEvaluation
from app.governor.scoring import GovernorScoring
from app.routing.deterministic import DeterministicRoutingProvider
from app.core.config import settings


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    """Clean session for each test - rollback at end"""
    db = SessionLocal()
    yield db
    db.rollback()
    db.close()


@pytest.fixture
def clean_db(db_session: Session):
    """Ensure clean DB by deleting all test data before test"""
    # Delete in reverse FK order
    db_session.query(Referral).delete()
    db_session.query(Match).delete()
    db_session.query(EmergencyRequirement).delete()
    db_session.query(Emergency).delete()
    db_session.query(EmergencyBed).delete()
    db_session.query(HospitalFacility).delete()
    db_session.query(HospitalSpecialty).delete()
    db_session.query(Hospital).delete()
    db_session.commit()
    yield db_session
    # Cleanup after
    db_session.query(Referral).delete()
    db_session.query(Match).delete()
    db_session.query(EmergencyRequirement).delete()
    db_session.query(Emergency).delete()
    db_session.query(EmergencyBed).delete()
    db_session.query(HospitalFacility).delete()
    db_session.query(HospitalSpecialty).delete()
    db_session.query(Hospital).delete()
    db_session.commit()


@pytest.fixture
def test_hospitals(clean_db: Session):
    """Create test hospitals with varying capabilities for filtering tests"""
    now = datetime.now(timezone.utc)
    
    # Hospital A: Full trauma center with neurosurgery, CT, beds
    hosp_a = Hospital(
        id="hosp_a",
        name="SIMULATED HOSPITAL — Trauma Center A",
        address="123 Test St", latitude=6.5244, longitude=3.3792,
        phone="+234****4567", emergency_status="OPEN", overall_capacity=60.0,
        accepting_emergencies=True, last_status_update=now - timedelta(minutes=5)
    )
    clean_db.add(hosp_a)
    clean_db.flush()
    clean_db.add_all([
        HospitalSpecialty(hospital_id="hosp_a", specialty_name="Surgery", available_count=2, status="AVAILABLE"),
        HospitalSpecialty(hospital_id="hosp_a", specialty_name="Orthopaedics", available_count=2, status="AVAILABLE"),
        HospitalSpecialty(hospital_id="hosp_a", specialty_name="Neurosurgery", available_count=1, status="AVAILABLE"),
        HospitalSpecialty(hospital_id="hosp_a", specialty_name="Anaesthesia", available_count=2, status="AVAILABLE"),
    ])
    clean_db.add_all([
        HospitalFacility(hospital_id="hosp_a", facility_name="Emergency Department", available=True, status="OPERATIONAL", quantity=1),
        HospitalFacility(hospital_id="hosp_a", facility_name="Operating Theatre", available=True, status="OPERATIONAL", quantity=2),
        HospitalFacility(hospital_id="hosp_a", facility_name="CT Scanner", available=True, status="OPERATIONAL", quantity=1),
        HospitalFacility(hospital_id="hosp_a", facility_name="X-Ray", available=True, status="OPERATIONAL", quantity=2),
        HospitalFacility(hospital_id="hosp_a", facility_name="Blood Bank", available=True, status="OPERATIONAL", quantity=1),
        HospitalFacility(hospital_id="hosp_a", facility_name="ICU", available=True, status="OPERATIONAL", quantity=1),
    ])
    for i in range(4):
        clean_db.add(EmergencyBed(hospital_id="hosp_a", bed_number=f"BED-A-{i+1:03d}", status="AVAILABLE"))
    
    # Hospital B: No neurosurgeon, no CT, but has beds
    hosp_b = Hospital(
        id="hosp_b",
        name="SIMULATED HOSPITAL — General Hospital B",
        address="456 Test Ave", latitude=6.4500, longitude=3.4000,
        phone="+234****4568", emergency_status="OPEN", overall_capacity=70.0,
        accepting_emergencies=True, last_status_update=now - timedelta(minutes=5)
    )
    clean_db.add(hosp_b)
    clean_db.flush()
    clean_db.add_all([
        HospitalSpecialty(hospital_id="hosp_b", specialty_name="Surgery", available_count=1, status="AVAILABLE"),
        HospitalSpecialty(hospital_id="hosp_b", specialty_name="Orthopaedics", available_count=1, status="AVAILABLE"),
    ])
    clean_db.add_all([
        HospitalFacility(hospital_id="hosp_b", facility_name="Emergency Department", available=True, status="OPERATIONAL", quantity=1),
        HospitalFacility(hospital_id="hosp_b", facility_name="Operating Theatre", available=True, status="OPERATIONAL", quantity=1),
        HospitalFacility(hospital_id="hosp_b", facility_name="X-Ray", available=True, status="OPERATIONAL", quantity=1),
    ])
    for i in range(3):
        clean_db.add(EmergencyBed(hospital_id="hosp_b", bed_number=f"BED-B-{i+1:03d}", status="AVAILABLE"))

    # Hospital C: Has everything but 0 available beds
    hosp_c = Hospital(
        id="hosp_c",
        name="SIMULATED HOSPITAL — Full Capacity C",
        address="789 Test Blvd", latitude=6.5000, longitude=3.4500,
        phone="+234****4569", emergency_status="OPEN", overall_capacity=95.0,
        accepting_emergencies=True, last_status_update=now - timedelta(minutes=5)
    )
    clean_db.add(hosp_c)
    clean_db.flush()
    clean_db.add_all([
        HospitalSpecialty(hospital_id="hosp_c", specialty_name="Surgery", available_count=2, status="AVAILABLE"),
        HospitalSpecialty(hospital_id="hosp_c", specialty_name="Orthopaedics", available_count=2, status="AVAILABLE"),
        HospitalSpecialty(hospital_id="hosp_c", specialty_name="Neurosurgery", available_count=1, status="AVAILABLE"),
    ])
    clean_db.add_all([
        HospitalFacility(hospital_id="hosp_c", facility_name="Emergency Department", available=True, status="OPERATIONAL", quantity=1),
        HospitalFacility(hospital_id="hosp_c", facility_name="Operating Theatre", available=True, status="OPERATIONAL", quantity=2),
        HospitalFacility(hospital_id="hosp_c", facility_name="CT Scanner", available=True, status="OPERATIONAL", quantity=1),
    ])
    for i in range(2):
        clean_db.add(EmergencyBed(hospital_id="hosp_c", bed_number=f"BED-C-{i+1:03d}", status="OCCUPIED"))
    
    # Hospital D: Stale data (45 min old), accepting=false
    hosp_d = Hospital(
        id="hosp_d",
        name="SIMULATED HOSPITAL — Stale Hospital D",
        address="999 Test Rd", latitude=6.6000, longitude=3.5000,
        phone="+234****4570", emergency_status="OPEN", overall_capacity=50.0,
        accepting_emergencies=False, last_status_update=now - timedelta(minutes=45)
    )
    clean_db.add(hosp_d)
    clean_db.flush()
    clean_db.add_all([
        HospitalSpecialty(hospital_id="hosp_d", specialty_name="Surgery", available_count=1, status="AVAILABLE"),
    ])
    clean_db.add(HospitalFacility(hospital_id="hosp_d", facility_name="Emergency Department", available=True, status="OPERATIONAL", quantity=1))
    clean_db.add(EmergencyBed(hospital_id="hosp_d", bed_number="BED-D-001", status="AVAILABLE"))

    # Hospital E: Emergency department CLOSED
    hosp_e = Hospital(
        id="hosp_e",
        name="SIMULATED HOSPITAL — Closed ED E",
        address="111 Test Ln", latitude=6.5500, longitude=3.4200,
        phone="+234****4571", emergency_status="CLOSED", overall_capacity=30.0,
        accepting_emergencies=True, last_status_update=now - timedelta(minutes=5)
    )
    clean_db.add(hosp_e)
    clean_db.flush()
    clean_db.add(HospitalFacility(hospital_id="hosp_e", facility_name="Emergency Department", available=False, status="OFFLINE", quantity=1))
    clean_db.add(EmergencyBed(hospital_id="hosp_e", bed_number="BED-E-001", status="AVAILABLE"))

    clean_db.commit()
    return [hosp_a, hosp_b, hosp_c, hosp_d, hosp_e]


class TestGovernorScoring:
    """Test the mathematical scoring engine"""

    def test_eta_score_decay(self):
        # Actual formula: 100 * exp(-0.028 * eta_minutes)
        assert 94 <= GovernorScoring.calculate_eta_score(2.0) <= 96
        assert 86 <= GovernorScoring.calculate_eta_score(5.0) <= 88
        assert 75 <= GovernorScoring.calculate_eta_score(10.0) <= 76
        assert 65 <= GovernorScoring.calculate_eta_score(15.0) <= 66
        assert 49 <= GovernorScoring.calculate_eta_score(25.0) <= 50
        assert 28 <= GovernorScoring.calculate_eta_score(45.0) <= 29
        assert 18 <= GovernorScoring.calculate_eta_score(60.0) <= 19

    def test_capacity_score(self):
        # 4/5 beds = 80% bed ratio, 70% capacity = 30% headroom -> 0.8*0.7 + 0.3*0.3 = 0.56 + 0.09 = 0.65 -> 65
        assert GovernorScoring.calculate_capacity_score(4, 5, 70.0) == 65.0
        
        # 0 beds -> 0 bed_score, headroom = 50% -> 0.3*0.5 = 0.15 -> 15
        assert GovernorScoring.calculate_capacity_score(0, 5, 50.0) == 15.0
        
        # All beds available, low capacity (20% used = 80% headroom) -> 0.7*1.0 + 0.3*0.8 = 0.94 -> 94
        assert GovernorScoring.calculate_capacity_score(5, 5, 20.0) == 94.0

    def test_freshness_score(self):
            now = datetime.now(timezone.utc)
            # Fresh (< 15 min)
            fresh_dt = now - timedelta(minutes=5)
            score, cat = GovernorScoring.calculate_freshness_score(fresh_dt)
            assert score == 100.0
            assert cat == "FRESH"
        
            # Aging (15-30 min)
            aging_dt = now - timedelta(minutes=20)
            score, cat = GovernorScoring.calculate_freshness_score(aging_dt)
            assert score == 70.0
            assert cat == "AGING"
        
            # Stale (30-60 min)
            stale_dt = now - timedelta(minutes=40)
            score, cat = GovernorScoring.calculate_freshness_score(stale_dt)
            assert score == 35.0
            assert cat == "STALE"
        
            # Critically stale (> EXCLUDE_CRITICALLY_STALE_MINUTES=120 min)
            crit_dt = now - timedelta(minutes=130)
            score, cat = GovernorScoring.calculate_freshness_score(crit_dt)
            assert score == 10.0
            assert cat == "CRITICALLY_STALE"

    def test_full_breakdown(self):
        now = datetime.now(timezone.utc)
        breakdown = GovernorScoring.compute_breakdown(
            capability_score=100.0,
            eta_minutes=10.0,
            available_beds=3,
            total_beds=5,
            overall_capacity_pct=60.0,
            available_specialists_count=4,
            total_specialties=5,
            last_update=now - timedelta(minutes=5)
        )
        assert "capability_score" in breakdown
        assert "eta_score" in breakdown
        assert "capacity_score" in breakdown
        assert "specialist_score" in breakdown
        assert "freshness_score" in breakdown
        assert "final_score" in breakdown
        assert "weights_applied" in breakdown
        assert 0 <= breakdown["final_score"] <= 100


class TestRoutingProvider:
    """Test deterministic routing"""

    def test_distance_eta(self):
            provider = DeterministicRoutingProvider()
        
            # Lagos Island to Victoria Island - Haversine ~4.5km, *1.35 = ~6km
            dist = provider.calculate_distance((6.4549, 3.4246), (6.4281, 3.4219))
            assert 4 <= dist <= 8
        
            eta = provider.calculate_eta((6.4549, 3.4246), (6.4281, 3.4219))
            # ~6km / 30 km/h * 60 = 12 min base, * 1.1 (off-peak) = ~13 min
            assert 5 <= eta <= 25
        
            # Route geometry - generates 7 points (start + 5 intermediate + end)
            route = provider.get_route_geometry((6.4549, 3.4246), (6.4281, 3.4219))
            assert len(route) == 7
            assert route[0] == [6.4549, 3.4246]
            assert route[-1] == [6.4281, 3.4219]


class TestMockAIProvider:
    """Test deterministic AI triage"""

    @pytest.mark.asyncio
    async def test_motorcycle_accident_critical(self):
        provider = MockAIProvider()
        result = await provider.analyse_emergency(
            description="Motorcycle accident. One patient unconscious with severe bleeding and suspected head injury.",
            category="Road accident"
        )
        assert result.severity == "CRITICAL"
        assert "Surgery" in result.required_capabilities
        assert "Orthopaedics" in result.required_capabilities
        assert "Neurosurgery" in result.required_capabilities
        assert "Emergency Department" in result.required_facilities
        assert "CT Scanner" in result.required_facilities
        assert "Operating Theatre" in result.required_facilities

    @pytest.mark.asyncio
    async def test_chest_pain_high(self):
        provider = MockAIProvider()
        # Category defaults for Chest pain = HIGH, but "chest pain" in desc triggers upgrade to CRITICAL
        result = await provider.analyse_emergency(
            description="55 year old male crushing chest pain radiating to left arm",
            category="Chest pain"
        )
        # Actually upgrades to CRITICAL because "chest pain" is in the upgrade list
        assert result.severity == "CRITICAL"
        assert "Cardiology" in result.required_capabilities
        assert "ICU" in result.required_facilities

    @pytest.mark.asyncio
    async def test_fracture_medium(self):
        provider = MockAIProvider()
        result = await provider.analyse_emergency(
            description="Open femur fracture after fall",
            category="Fracture"
        )
        # "fracture" in desc upgrades from MEDIUM to HIGH
        assert result.severity == "HIGH"
        assert "Orthopaedics" in result.required_capabilities
        assert "X-Ray" in result.required_facilities


class TestGovernorHardFilters:
    """Test deterministic filtering and ranking"""

    def test_critical_emergency_requires_beds(self, clean_db, test_hospitals):
        """CRITICAL emergency with no available beds -> excluded"""
        emg = Emergency(
            id="emg_1",
            incident_reference="TEST-001",
            latitude=6.5244, longitude=3.3792,
            description="Test", category="Test", severity="CRITICAL", patient_count=1, status="MATCHING"
        )
        clean_db.add(emg)
        # Add mandatory bed requirement
        clean_db.add(EmergencyRequirement(
            emergency_id="emg_1", requirement_type="BED", requirement_name="Emergency Bed", mandatory=True
        ))
        # Add mandatory specialties/facilities
        for spec in ["Surgery", "Orthopaedics", "Neurosurgery"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_1", requirement_type="SPECIALTY", requirement_name=spec, mandatory=True
            ))
        for fac in ["Emergency Department", "CT Scanner", "Operating Theatre"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_1", requirement_type="FACILITY", requirement_name=fac, mandatory=True
            ))
        clean_db.commit()

        candidates = GovernorDecisionEngine.evaluate_emergency(clean_db, emg)
        
        # Hosp C: 0 available beds -> should be INELIGIBLE
        c = next(c for c in candidates if c.hospital.id == "hosp_c")
        assert c.eligible == False
        assert any("No emergency beds" in r for r in c.rejection_reasons)
        
        # Hosp D: not accepting, stale -> INELIGIBLE
        d = next(c for c in candidates if c.hospital.id == "hosp_d")
        assert d.eligible == False
        
        # Hosp E: ED closed -> INELIGIBLE
        e = next(c for c in candidates if c.hospital.id == "hosp_e")
        assert e.eligible == False
        assert any("CLOSED" in r for r in e.rejection_reasons)

    def test_missing_mandatory_specialist_excludes(self, clean_db, test_hospitals):
        """Hospital without mandatory neurosurgeon excluded"""
        emg = Emergency(
            id="emg_2",
            incident_reference="TEST-002",
            latitude=6.5244, longitude=3.3792,
            description="Test", category="Test", severity="CRITICAL", patient_count=1, status="MATCHING"
        )
        clean_db.add(emg)
        for spec in ["Surgery", "Orthopaedics", "Neurosurgery"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_2", requirement_type="SPECIALTY", requirement_name=spec, mandatory=True
            ))
        for fac in ["Emergency Department", "CT Scanner"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_2", requirement_type="FACILITY", requirement_name=fac, mandatory=True
            ))
        clean_db.commit()

        candidates = GovernorDecisionEngine.evaluate_emergency(clean_db, emg)
        
        # Hosp B: has Surgery & Orthopaedics but NO Neurosurgery -> INELIGIBLE
        b = next(c for c in candidates if c.hospital.id == "hosp_b")
        assert b.eligible == False
        assert any("Neurosurgery" in r for r in b.rejection_reasons)

    def test_missing_mandatory_facility_excludes(self, clean_db, test_hospitals):
        """Hospital without mandatory CT Scanner excluded"""
        emg = Emergency(
            id="emg_3",
            incident_reference="TEST-003",
            latitude=6.5244, longitude=3.3792,
            description="Test", category="Test", severity="CRITICAL", patient_count=1, status="MATCHING"
        )
        clean_db.add(emg)
        for spec in ["Surgery", "Orthopaedics"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_3", requirement_type="SPECIALTY", requirement_name=spec, mandatory=True
            ))
        for fac in ["Emergency Department", "CT Scanner", "Operating Theatre"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_3", requirement_type="FACILITY", requirement_name=fac, mandatory=True
            ))
        clean_db.commit()

        candidates = GovernorDecisionEngine.evaluate_emergency(clean_db, emg)
        
        # Hosp B: no CT Scanner -> INELIGIBLE
        b = next(c for c in candidates if c.hospital.id == "hosp_b")
        assert b.eligible == False
        assert any("CT Scanner" in r for r in b.rejection_reasons)

    def test_ranking_eligible_hospitals(self, clean_db, test_hospitals):
        """Eligible hospitals ranked by final score descending"""
        emg = Emergency(
            id="emg_4",
            incident_reference="TEST-004",
            latitude=6.5244, longitude=3.3792,
            description="Test", category="Test", severity="CRITICAL", patient_count=1, status="MATCHING"
        )
        clean_db.add(emg)
        for spec in ["Surgery", "Orthopaedics", "Neurosurgery"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_4", requirement_type="SPECIALTY", requirement_name=spec, mandatory=True
            ))
        for fac in ["Emergency Department", "CT Scanner", "Operating Theatre"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_4", requirement_type="FACILITY", requirement_name=fac, mandatory=True
            ))
        clean_db.commit()

        candidates = GovernorDecisionEngine.evaluate_emergency(clean_db, emg)
        eligible = [c for c in candidates if c.eligible]
        
        # Should have at least Hosp A as eligible (Hosp B, C, D, E excluded)
        assert len(eligible) >= 1
        assert eligible[0].rank == 1
        assert eligible[0].hospital.id == "hosp_a"
        
        # Scores should be sorted descending
        scores = [c.final_score for c in eligible]
        assert scores == sorted(scores, reverse=True)

    def test_score_breakdown_generated(self, clean_db, test_hospitals):
        """Every candidate gets a score breakdown with explanations"""
        emg = Emergency(
            id="emg_5",
            incident_reference="TEST-005",
            latitude=6.5244, longitude=3.3792,
            description="Test", category="Test", severity="CRITICAL", patient_count=1, status="MATCHING"
        )
        clean_db.add(emg)
        for spec in ["Surgery", "Orthopaedics", "Neurosurgery"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_5", requirement_type="SPECIALTY", requirement_name=spec, mandatory=True
            ))
        for fac in ["Emergency Department", "CT Scanner", "Operating Theatre"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_5", requirement_type="FACILITY", requirement_name=fac, mandatory=True
            ))
        clean_db.commit()

        candidates = GovernorDecisionEngine.evaluate_emergency(clean_db, emg)
        
        for c in candidates:
            assert c.score_breakdown is not None
            assert "capability_score" in c.score_breakdown
            assert "eta_score" in c.score_breakdown
            assert "capacity_score" in c.score_breakdown
            assert "specialist_score" in c.score_breakdown
            assert "freshness_score" in c.score_breakdown
            assert "final_score" in c.score_breakdown
            assert "explanations" in c.score_breakdown
            assert isinstance(c.score_breakdown["explanations"], list)


class TestEdgeCases:
    """Test the 15 edge cases from requirements"""

    def test_no_hospitals_available(self, clean_db):
        """No hospitals in DB"""
        emg = Emergency(
            id="emg_6", incident_reference="TEST-006",
            latitude=6.5244, longitude=3.3792, description="Test", category="Test",
            severity="CRITICAL", patient_count=1, status="MATCHING"
        )
        clean_db.add(emg)
        clean_db.add(EmergencyRequirement(
            emergency_id="emg_6", requirement_type="SPECIALTY", requirement_name="Surgery", mandatory=True
        ))
        clean_db.commit()
        
        candidates = GovernorDecisionEngine.evaluate_emergency(clean_db, emg)
        assert len(candidates) == 0

    def test_no_hospital_has_required_specialist(self, clean_db):
        """No hospital has the mandatory neurosurgeon"""
        now = datetime.now(timezone.utc)
        hosp = Hospital(
            id="hosp_x", name="Test Hosp", address="Test", latitude=6.5, longitude=3.3,
            phone="123", emergency_status="OPEN", overall_capacity=50.0,
            accepting_emergencies=True, last_status_update=now
        )
        clean_db.add(hosp)
        clean_db.flush()
        # No neurosurgeon
        clean_db.add(HospitalSpecialty(hospital_id="hosp_x", specialty_name="Surgery", available_count=1, status="AVAILABLE"))
        clean_db.add(HospitalFacility(hospital_id="hosp_x", facility_name="Emergency Department", available=True, status="OPERATIONAL"))
        clean_db.add(EmergencyBed(hospital_id="hosp_x", bed_number="BED-1", status="AVAILABLE"))
        clean_db.commit()
        
        emg = Emergency(
            id="emg_7", incident_reference="TEST-007",
            latitude=6.5244, longitude=3.3792, description="Test", category="Test",
            severity="CRITICAL", patient_count=1, status="MATCHING"
        )
        clean_db.add(emg)
        clean_db.add(EmergencyRequirement(
            emergency_id="emg_7", requirement_type="SPECIALTY", requirement_name="Neurosurgery", mandatory=True
        ))
        clean_db.commit()
        
        candidates = GovernorDecisionEngine.evaluate_emergency(clean_db, emg)
        assert len(candidates) == 1
        assert candidates[0].eligible == False

    def test_all_hospitals_full(self, clean_db):
        """All hospitals have 0 available beds"""
        now = datetime.now(timezone.utc)
        hosp = Hospital(
            id="hosp_y", name="Full Hosp", address="Test", latitude=6.5, longitude=3.3,
            phone="123", emergency_status="OPEN", overall_capacity=90.0,
            accepting_emergencies=True, last_status_update=now
        )
        clean_db.add(hosp)
        clean_db.flush()
        clean_db.add_all([
            HospitalSpecialty(hospital_id="hosp_y", specialty_name="Surgery", available_count=1, status="AVAILABLE"),
            HospitalSpecialty(hospital_id="hosp_y", specialty_name="Orthopaedics", available_count=1, status="AVAILABLE"),
            HospitalSpecialty(hospital_id="hosp_y", specialty_name="Neurosurgery", available_count=1, status="AVAILABLE"),
        ])
        clean_db.add(HospitalFacility(hospital_id="hosp_y", facility_name="Emergency Department", available=True, status="OPERATIONAL"))
        clean_db.add(HospitalFacility(hospital_id="hosp_y", facility_name="CT Scanner", available=True, status="OPERATIONAL"))
        clean_db.add(HospitalFacility(hospital_id="hosp_y", facility_name="Operating Theatre", available=True, status="OPERATIONAL"))
        # All beds occupied
        clean_db.add(EmergencyBed(hospital_id="hosp_y", bed_number="BED-1", status="OCCUPIED"))
        clean_db.commit()
        
        emg = Emergency(
            id="emg_8", incident_reference="TEST-008",
            latitude=6.5244, longitude=3.3792, description="Test", category="Test",
            severity="CRITICAL", patient_count=1, status="MATCHING"
        )
        clean_db.add(emg)
        for spec in ["Surgery", "Orthopaedics", "Neurosurgery"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_8", requirement_type="SPECIALTY", requirement_name=spec, mandatory=True
            ))
        for fac in ["Emergency Department", "CT Scanner", "Operating Theatre"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_8", requirement_type="FACILITY", requirement_name=fac, mandatory=True
            ))
        clean_db.add(EmergencyRequirement(
            emergency_id="emg_8", requirement_type="BED", requirement_name="Emergency Bed", mandatory=True
        ))
        clean_db.commit()
        
        candidates = GovernorDecisionEngine.evaluate_emergency(clean_db, emg)
        assert len(candidates) == 1
        assert candidates[0].eligible == False
        assert any("beds" in r.lower() for r in candidates[0].rejection_reasons)

    def test_closest_hospital_cannot_handle(self, clean_db, test_hospitals):
        """Closest hospital with open ED that lacks neurosurgeon should be excluded"""
        emg = Emergency(
            id="emg_9", incident_reference="TEST-009",
            latitude=6.5244, longitude=3.3792, description="Test", category="Test",
            severity="CRITICAL", patient_count=1, status="MATCHING"
        )
        clean_db.add(emg)
        for spec in ["Surgery", "Orthopaedics", "Neurosurgery"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_9", requirement_type="SPECIALTY", requirement_name=spec, mandatory=True
            ))
        for fac in ["Emergency Department", "CT Scanner", "Operating Theatre"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_9", requirement_type="FACILITY", requirement_name=fac, mandatory=True
            ))
        clean_db.commit()
        
        candidates = GovernorDecisionEngine.evaluate_emergency(clean_db, emg)
        
        # Hosp C (11.18km) is closer than Hosp B (11.59km) but has no available beds -> ineligible
        # Hosp B (11.59km) is next closest with OPEN ED but lacks neurosurgeon
        b = next(c for c in candidates if c.hospital.id == "hosp_b")
        assert b.eligible == False
        
        # Ineligible with OPEN ED sorted by distance
        ineligible_open = [c for c in candidates if not c.eligible and c.hospital.emergency_status == "OPEN"]
        # First should be hosp_c (no beds, 11.18km), then hosp_b (no neuro, 11.59km)
        assert ineligible_open[0].hospital.id == "hosp_c"
        assert ineligible_open[1].hospital.id == "hosp_b"

    def test_stale_hospital_penalized(self, clean_db, test_hospitals):
        """Stale hospital (>30min) gets freshness penalty"""
        emg = Emergency(
            id="emg_10", incident_reference="TEST-010",
            latitude=6.5244, longitude=3.3792, description="Test", category="Test",
            severity="CRITICAL", patient_count=1, status="MATCHING"
        )
        clean_db.add(emg)
        for spec in ["Surgery"]:
            clean_db.add(EmergencyRequirement(
                emergency_id="emg_10", requirement_type="SPECIALTY", requirement_name=spec, mandatory=True
            ))
        clean_db.add(EmergencyRequirement(
            emergency_id="emg_10", requirement_type="FACILITY", requirement_name="Emergency Department", mandatory=True
        ))
        clean_db.commit()
        
        candidates = GovernorDecisionEngine.evaluate_emergency(clean_db, emg)
        
        # Hosp D is stale (45min) -> should get freshness penalty
        d = next(c for c in candidates if c.hospital.id == "hosp_d")
        assert d.eligible == False  # Also not accepting
        assert d.score_breakdown["freshness_score"] <= 35
        assert d.score_breakdown["freshness_category"] in ["STALE", "CRITICALLY_STALE"]


class TestReferralStateMachine:
    """Test referral acceptance, rejection, failover"""

    def test_accept_reserves_bed(self, clean_db, test_hospitals):
        """Accepting a referral reserves a bed"""
        emg = Emergency(
            id="emg_11", incident_reference="TEST-011",
            latitude=6.5244, longitude=3.3792, description="Test", category="Test",
            severity="CRITICAL", patient_count=1, status="AWAITING_ACCEPTANCE"
        )
        clean_db.add(emg)
        clean_db.commit()
        
        ref = Referral(
            id="ref_11", emergency_id="emg_11", hospital_id="hosp_a",
            status="REQUESTED", requested_at=datetime.now(timezone.utc),
            reservation_expiry=datetime.now(timezone.utc) + timedelta(minutes=15),
            eta_minutes=15.0
        )
        clean_db.add(ref)
        clean_db.commit()
        
        from app.services.referral_service import referral_service
        accepted_ref, bed = referral_service.accept_referral(clean_db, "ref_11", actor="TEST")
        
        assert accepted_ref.status == "ACCEPTED"
        assert bed is not None
        assert bed.status == "RESERVED"
        assert bed.reserved_for == "emg_11"
        
        emg = clean_db.query(Emergency).filter(Emergency.id == "emg_11").first()
        assert emg.status == "PATIENT_EN_ROUTE"

    def test_reject_triggers_failover(self, clean_db, test_hospitals):
        """Rejecting triggers automatic failover to next candidate"""
        emg = Emergency(
            id="emg_12", incident_reference="TEST-012",
            latitude=6.5244, longitude=3.3792, description="Test", category="Test",
            severity="CRITICAL", patient_count=1, status="AWAITING_ACCEPTANCE"
        )
        clean_db.add(emg)
        clean_db.commit()
        
        # Create Match records so failover can find next candidate
        from app.models.entities import Match
        match1 = Match(
            emergency_id="emg_12", hospital_id="hosp_a",
            score=85.0, distance_km=10.0, eta_minutes=15.0,
            eligibility=True, rank=1
        )
        match2 = Match(
            emergency_id="emg_12", hospital_id="hosp_b",
            score=70.0, distance_km=12.0, eta_minutes=18.0,
            eligibility=True, rank=2
        )
        clean_db.add_all([match1, match2])
        clean_db.commit()
        
        # Create only FIRST referral to Hosp A
        ref1 = Referral(
            id="ref_12_1", emergency_id="emg_12", hospital_id="hosp_a",
            status="REQUESTED", requested_at=datetime.now(timezone.utc),
            reservation_expiry=datetime.now(timezone.utc) + timedelta(minutes=15),
            eta_minutes=15.0
        )
        clean_db.add(ref1)
        clean_db.commit()
        
        from app.services.referral_service import referral_service
        # Reject first referral
        rejected_ref, next_ref = referral_service.reject_referral(
            clean_db, "ref_12_1", reason="Test rejection", actor="TEST"
        )
        
        assert rejected_ref.status == "REJECTED"
        assert next_ref is not None  # Auto-failover to next
        assert next_ref.hospital_id == "hosp_b"  # Next eligible
        
        emg = clean_db.query(Emergency).filter(Emergency.id == "emg_12").first()
        # After failover, emergency goes to AWAITING_ACCEPTANCE for the new referral
        assert emg.status == "AWAITING_ACCEPTANCE"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])