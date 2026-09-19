from app.ai.base import AIProvider
from app.ai.mock_provider import MockAIProvider
from app.ai.openai_provider import OpenAICompatibleProvider
from app.core.config import settings


def get_ai_provider() -> AIProvider:
    """
    Factory returning the configured AI emergency analysis provider.
    Falls back to the offline MockAIProvider if no provider/key is configured.
    (OpenAICompatibleProvider itself also falls back to the mock if the upstream call fails.)
    """
    if settings.AI_PROVIDER == "openai" and settings.OPENAI_API_KEY:
        return OpenAICompatibleProvider(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL, model=settings.AI_MODEL)
    if settings.AI_PROVIDER == "local":
        return OpenAICompatibleProvider(api_key="local", base_url=settings.LOCAL_LLM_URL, model=settings.AI_MODEL)
    return MockAIProvider()
