from app.ai.base import AIProvider
from app.ai.mock_provider import MockAIProvider
from app.ai.openai_provider import OpenAIProvider
from app.core.config import settings

def get_ai_provider() -> AIProvider:
    """
    Factory returning the configured AI emergency analysis provider.
    Defaults to MockAIProvider if AI_PROVIDER == 'mock' or if OpenAI keys are not provided.
    """
    if settings.AI_PROVIDER in ["openai", "local"]:
        return OpenAIProvider()
    return MockAIProvider()
