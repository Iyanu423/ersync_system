import time
import logging
from typing import Tuple, List, Dict, Optional
import httpx
from app.routing.base import RoutingProvider
from app.routing.deterministic import DeterministicRoutingProvider
from app.core.config import settings

logger = logging.getLogger(__name__)


class OSRMRoutingProvider(RoutingProvider):
    """
    Live road routing through an OSRM server (ROUTING_PROVIDER=osrm).
    - One HTTP call per origin/destination pair, cached for 5 minutes (distance and ETA share it).
    - Traffic multiplier is applied on top of OSRM's free-flow duration.
    - If OSRM is unreachable, a circuit breaker sends everything to the deterministic model for 60s
      so emergency matching never waits on a dead routing server.
    """

    CACHE_TTL = 300.0
    BREAKER_SECONDS = 60.0
    TIMEOUT = 2.0

    def __init__(self):
        self.fallback = DeterministicRoutingProvider()
        self._cache: Dict[tuple, Tuple[float, float, float]] = {}
        self._down_until = 0.0

    @staticmethod
    def _key(o, d):
        return (round(o[0], 4), round(o[1], 4), round(d[0], 4), round(d[1], 4))

    def _route(self, origin: Tuple[float, float], dest: Tuple[float, float]) -> Optional[Tuple[float, float]]:
        now = time.monotonic()
        key = self._key(origin, dest)
        hit = self._cache.get(key)
        if hit and now - hit[2] < self.CACHE_TTL:
            return hit[0], hit[1]
        if now < self._down_until:
            return None
        try:
            url = (f"{settings.OSRM_BASE_URL}/route/v1/driving/"
                   f"{origin[1]},{origin[0]};{dest[1]},{dest[0]}?overview=false")
            resp = httpx.get(url, timeout=self.TIMEOUT)
            resp.raise_for_status()
            route = resp.json()["routes"][0]
            dist_km = round(route["distance"] / 1000.0, 2)
            traffic = self._traffic(origin)
            eta = round((route["duration"] / 60.0) * traffic + 1.5, 1)
            self._cache[key] = (dist_km, eta, now)
            return dist_km, eta
        except Exception as exc:
            logger.warning("OSRM unavailable (%s); using deterministic routing for %ss", exc, self.BREAKER_SECONDS)
            self._down_until = now + self.BREAKER_SECONDS
            return None

    @staticmethod
    def _traffic(origin: Tuple[float, float]) -> float:
        lat, lon = origin
        if 6.35 <= lat <= 6.70 and 3.20 <= lon <= 3.65:
            return 1.45   # Lagos
        if 8.80 <= lat <= 9.25 and 7.30 <= lon <= 7.65:
            return 1.15   # Abuja
        return 1.25

    def calculate_distance(self, origin, destination) -> float:
        r = self._route(origin, destination)
        return r[0] if r else self.fallback.calculate_distance(origin, destination)

    def calculate_eta(self, origin, destination) -> float:
        r = self._route(origin, destination)
        return r[1] if r else self.fallback.calculate_eta(origin, destination)

    def get_route_geometry(self, origin, destination) -> List[List[float]]:
        return self.fallback.get_route_geometry(origin, destination)
