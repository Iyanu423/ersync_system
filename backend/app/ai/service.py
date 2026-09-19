from app.core.config import settings
from app.ai.base import AIProvider
from app.ai.mock_provider import MockAIProvider
from app.ai.openai_provider import OpenAICompatibleProvider
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
        if settings.AI_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            self._provider = OpenAICompatibleProvider(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_BASE_URL,
                model=settings.AI_MODEL
            )
        elif settings.AI_PROVIDER == "local":
            self._provider = OpenAICompatibleProvider(
                api_key="local",
                base_url=settings.LOCAL_LLM_URL,
                model=settings.AI_MODEL
            )
        else:
            self._provider = MockAIProvider()

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
