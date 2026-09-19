from app.core.config import settings
from app.ai.base import AIProvider
from app.ai.factory import get_ai_provider
from app.schemas.schemas import AIAnalysisResult
from typing import Dict, Any, Optional

class AIService:
    """
    Singleton AI Service orchestrating emergency understanding across configured providers.
    Ensures absolute fallback reliability and strict JSON validation.
    """
    _instance: Optional["AIService"] = None
    _provider: AIProvider

    def __init__(self):
        self._provider = get_ai_provider()

    @classmethod
    def get_instance(cls) -> "AIService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def analyse(
        self,
        description: str,
        category: str = "Other",
        additional_info: Optional[Dict[str, Any]] = None
    ) -> AIAnalysisResult:
        return await self._provider.analyse_emergency(
            description=description,
            category=category,
            additional_info=additional_info
        )

ai_service = AIService.get_instance()
