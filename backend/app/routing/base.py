from abc import ABC, abstractmethod
from typing import Tuple, List, Dict, Any

class RoutingProvider(ABC):
    """
    Abstract interface for routing, distance, and ETA calculations.
    """

    @abstractmethod
    def calculate_distance(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
        """
        Returns distance in kilometers.
        """
        pass

    @abstractmethod
    def calculate_eta(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> float:
        """
        Returns estimated travel time in minutes.
        """
        pass

    @abstractmethod
    def get_route_geometry(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> List[List[float]]:
        """
        Returns a list of [lat, lng] coordinates representing the travel route polyline.
        """
        pass
