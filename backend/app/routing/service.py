from typing import Tuple, List, Optional
from app.routing.base import RoutingProvider
from app.routing.deterministic import DeterministicRoutingProvider
from app.core.config import settings

class RoutingService:
    _instance: Optional["RoutingService"] = None
    _provider: RoutingProvider

    def __init__(self):
        # Default to deterministic provider for resilient demo and tests
        self._provider = DeterministicRoutingProvider()

    @classmethod
    def get_instance(cls) -> "RoutingService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def calculate_distance(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
        return self._provider.calculate_distance(origin, destination)

    def calculate_eta(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
        return self._provider.calculate_eta(origin, destination)

    def get_route_geometry(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> List[List[float]]:
        return self._provider.get_route_geometry(origin, destination)

routing_service = RoutingService.get_instance()
