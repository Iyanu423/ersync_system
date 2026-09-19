from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from app.schemas.schemas import AIAnalysisResult

class AIProvider(ABC):
    """
    Abstract base class for AI emergency understanding providers.
    The AI is strictly limited to extracting structured requirements,
    severity, and suspected clinical factors from unstructured text.
    It NEVER chooses or recommends a hospital directly.
    """

    @abstractmethod
    async def analyse_emergency(
        self,
        description: str,
        category: str = "Other",
        additional_info: Optional[Dict[str, Any]] = None
    ) -> AIAnalysisResult:
        """
        Parses unstructured natural language emergency report into structured requirements.
        """
        pass
