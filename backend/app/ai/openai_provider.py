import json
import httpx
from typing import Dict, Any, Optional
from app.ai.base import AIProvider
from app.ai.mock_provider import MockAIProvider
from app.schemas.schemas import AIAnalysisResult
from app.core.config import settings

class OpenAICompatibleProvider(AIProvider):
    """
    Connects to any OpenAI-compatible API endpoint (OpenAI, Ollama, LMStudio, vLLM, DeepSeek, Groq).
    Uses strict system instructions and structured JSON response parsing.
    Seamlessly falls back to MockAIProvider if the upstream connection fails or times out.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY or "dummy-key"
        self.base_url = (base_url or settings.OPENAI_BASE_URL or "https://api.openai.com/v1").rstrip("/")
        self.model = model or settings.AI_MODEL or "gpt-4o-mini"
        self.fallback = MockAIProvider()

    async def analyse_emergency(
        self,
        description: str,
        category: str = "Other",
        additional_info: Optional[Dict[str, Any]] = None
    ) -> AIAnalysisResult:
        system_prompt = (
            "You are an expert emergency medical triage classification engine for the AI Governor platform.\n"
            "Your task is strictly to parse the unstructured emergency intake text and return structured JSON requirements.\n"
            "CRITICAL SAFETY RULE: You NEVER recommend or select a hospital directly. Only extract clinical capabilities.\n\n"
            "Return valid JSON adhering strictly to this schema:\n"
            "{\n"
            '  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",\n'
            '  "confidence": float (0.0 to 1.0),\n'
            '  "suspected_conditions": ["list", "of", "conditions"],\n'
            '  "required_capabilities": ["Surgery", "Orthopaedics", "Neurosurgery", "Cardiology", "Paediatrics", "General Medicine", "Anaesthesia", "Obstetrics/Gynaecology"],\n'
            '  "required_facilities": ["Emergency Department", "Operating Theatre", "CT Scanner", "X-Ray", "ICU", "Blood Bank", "Ultrasound"],\n'
            '  "rationale": "Brief clinical rationale explanation"\n'
            "}"
        )

        user_content = f"Emergency Category: {category}\nEmergency Report Description: {description}"
        if additional_info:
            user_content += f"\nAdditional Context: {json.dumps(additional_info)}"

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
                "max_tokens": 500
            }

            async with httpx.AsyncClient(timeout=6.0) as client:
                response = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    content_str = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content_str)

                    return AIAnalysisResult(
                        severity=parsed.get("severity", "CRITICAL").upper(),
                        confidence=float(parsed.get("confidence", 0.90)),
                        suspected_conditions=parsed.get("suspected_conditions", []),
                        required_capabilities=parsed.get("required_capabilities", ["Surgery"]),
                        required_facilities=parsed.get("required_facilities", ["Emergency Department"]),
                        rationale=parsed.get("rationale", "Extracted via LLM triage engine."),
                        disclaimer="Suspected emergency requirements based on preliminary triage intake. Not a definitive medical diagnosis."
                    )
        except Exception:
            # Fall back reliably to deterministic mock provider
            pass

        return await self.fallback.analyse_emergency(description, category, additional_info)