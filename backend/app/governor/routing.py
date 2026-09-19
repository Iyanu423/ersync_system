import math
import logging
from typing import Tuple
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class RoutingEngine:
    """
    Computes road distance and realistic dynamic ambulance ETA in Nigerian urban contexts.
    Applies empirical traffic congestion factors for Lagos, Abuja, and Ibadan.
    """

    EARTH_RADIUS_KM = 6371.0

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculates great-circle distance between two geographic points in kilometers.
        """
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(RoutingEngine.EARTH_RADIUS_KM * c, 2)

    @staticmethod
    def get_traffic_multiplier(lat: float, lon: float) -> float:
        """
        Determines empirical traffic congestion multiplier based on Nigerian urban coordinates.
        - Lagos (lat ~6.4 to 6.7, lon ~3.2 to 3.6): High congestion (1.45x)
        - Abuja (lat ~8.8 to 9.2, lon ~7.3 to 7.6): Moderate congestion (1.15x)
        - Ibadan (lat ~7.3 to 7.5, lon ~3.8 to 4.0): Moderate-high congestion (1.25x)
        - Other: Default multiplier from settings (1.35x)
        """
        if 6.35 <= lat <= 6.70 and 3.20 <= lon <= 3.65:
            # Lagos metropolitan zone (3rd Mainland Bridge, Ikorodu Rd, Lekki)
            return 1.45
        elif 8.80 <= lat <= 9.25 and 7.30 <= lon <= 7.65:
            # Abuja FCT metropolitan zone
            return 1.15
        elif 7.30 <= lat <= 7.55 and 3.80 <= lon <= 4.05:
            # Ibadan urban zone
            return 1.25
        return settings.TRAFFIC_MULTIPLIER

    @classmethod
    async def calculate_route(
        cls,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float
    ) -> Tuple[float, float]:
        """
        Returns (distance_km, eta_minutes).
        Attempts OSRM live routing if configured, otherwise computes via Haversine + traffic model.
        """
        crow_flies_km = cls.haversine_distance(origin_lat, origin_lon, dest_lat, dest_lon)
        
        # Road tortuosity factor: real road distance is ~1.25x to 1.35x straight line distance in urban grid
        road_distance_km = round(crow_flies_km * 1.28, 2)

        if settings.ROUTING_PROVIDER == "osrm" and settings.OSRM_BASE_URL:
            try:
                url = f"{settings.OSRM_BASE_URL}/route/v1/driving/{origin_lon},{origin_lat};{dest_lon},{dest_lat}?overview=false"
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("routes"):
                            route = data["routes"][0]
                            dist_km = round(route["distance"] / 1000.0, 2)
                            duration_min = round(route["duration"] / 60.0, 1)
                            # Apply urban traffic factor on top of OSRM free-flow speed
                            traffic_factor = cls.get_traffic_multiplier(origin_lat, origin_lon)
                            adjusted_eta = round((duration_min * traffic_factor) + 3.0, 1)
                            return dist_km, adjusted_eta
            except Exception as e:
                logger.debug(f"OSRM routing failed: {e}, falling back to deterministic routing model.")

        # Deterministic formula calculation
        speed_kmh = settings.AVERAGE_AMBULANCE_SPEED_KMH # ~45 km/h
        traffic_factor = cls.get_traffic_multiplier(origin_lat, origin_lon)
        
        # Base travel time in minutes + 3 min ambulance dispatch/mobilization overhead
        travel_time_min = (road_distance_km / speed_kmh) * 60.0 * traffic_factor
        eta_minutes = round(travel_time_min + 3.0, 1)

        return road_distance_km, eta_minutes
