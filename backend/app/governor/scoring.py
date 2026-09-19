import math
from typing import Dict, Any, List, Tuple
from datetime import datetime, timezone
from app.core.config import settings

class GovernorScoring:
    """
    Mathematical and deterministic scoring engine for hospital candidates.
    Produces transparent, normalized (0.0 - 100.0) sub-scores and final weighted scores.
    """

    @staticmethod
    def calculate_eta_score(eta_minutes: float) -> float:
        """
        ETA score decay curve:
        < 5 mins  -> ~95-100
        10 mins   -> ~85
        15 mins   -> ~72
        25 mins   -> ~50
        45 mins   -> ~25
        > 60 mins -> < 15
        """
        score = 100.0 * math.exp(-0.028 * max(eta_minutes, 0.0))
        return round(min(max(score, 0.0), 100.0), 1)

    @staticmethod
    def calculate_capacity_score(available_beds: int, total_beds: int, overall_capacity_pct: float) -> float:
        """
        Emergency bed availability is prioritized (70%), combined with overall hospital capacity headroom (30%).
        """
        if total_beds <= 0:
            bed_ratio = 0.0
        else:
            bed_ratio = min(available_beds / float(total_beds), 1.0)
            
        bed_score = bed_ratio * 100.0
        headroom_score = max(100.0 - overall_capacity_pct, 0.0)
        
        combined = (bed_score * 0.70) + (headroom_score * 0.30)
        return round(min(max(combined, 0.0), 100.0), 1)

    @staticmethod
    def calculate_freshness_score(last_update: datetime) -> Tuple[float, str]:
        """
        Calculates freshness score based on elapsed minutes since last telemetry update:
        < 15 mins -> 100.0 (FRESH)
        15-30 mins -> 70.0 (AGING)
        30-60 mins -> 40.0 (STALE)
        > 60 mins -> 10.0 (CRITICALLY STALE)
        """
        now = datetime.now(timezone.utc)
        if last_update.tzinfo is None:
            last_update = last_update.replace(tzinfo=timezone.utc)
            
        elapsed_mins = (now - last_update).total_seconds() / 60.0
        
        if elapsed_mins < settings.STALE_FRESH_MINUTES:
            return 100.0, "FRESH"
        elif elapsed_mins < settings.STALE_AGING_MINUTES:
            return 70.0, "AGING"
        elif elapsed_mins < settings.EXCLUDE_CRITICALLY_STALE_MINUTES:
            return 35.0, "STALE"
        else:
            return 10.0, "CRITICALLY_STALE"

    @staticmethod
    def calculate_specialist_score(available_specialists_count: int, total_specialties: int) -> float:
        if total_specialties <= 0:
            return 50.0
        ratio = min(available_specialists_count / float(total_specialties), 1.0)
        return round(ratio * 100.0, 1)

    @classmethod
    def compute_breakdown(
        cls,
        capability_score: float,
        eta_minutes: float,
        available_beds: int,
        total_beds: int,
        overall_capacity_pct: float,
        available_specialists_count: int,
        total_specialties: int,
        last_update: datetime
    ) -> Dict[str, Any]:
        eta_score = cls.calculate_eta_score(eta_minutes)
        capacity_score = cls.calculate_capacity_score(available_beds, total_beds, overall_capacity_pct)
        freshness_score, freshness_category = cls.calculate_freshness_score(last_update)
        specialist_score = cls.calculate_specialist_score(available_specialists_count, total_specialties)

        w_cap = settings.WEIGHT_CAPABILITY
        w_eta = settings.WEIGHT_ETA
        w_bed = settings.WEIGHT_CAPACITY
        w_spec = settings.WEIGHT_SPECIALIST
        w_fresh = settings.WEIGHT_FRESHNESS

        final_score = (
            (capability_score * w_cap) +
            (eta_score * w_eta) +
            (capacity_score * w_bed) +
            (specialist_score * w_spec) +
            (freshness_score * w_fresh)
        )

        return {
            "capability_score": round(capability_score, 1),
            "eta_score": eta_score,
            "capacity_score": capacity_score,
            "specialist_score": specialist_score,
            "freshness_score": freshness_score,
            "freshness_category": freshness_category,
            "final_score": round(final_score, 1),
            "weights_applied": {
                "capability": w_cap,
                "eta": w_eta,
                "capacity": w_bed,
                "specialist": w_spec,
                "freshness": w_fresh
            }
        }
