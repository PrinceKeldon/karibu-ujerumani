from fastapi import APIRouter, Depends
from .. import models, schemas
from ..auth import get_current_user
from ..config import settings

router = APIRouter(prefix="/ai", tags=["ai"])

SYSTEM_PROMPT = """You are Karibu Chat, the AI concierge for Karibu Ujerumani — a community platform for Kenyans living in Germany, including newcomers, students, workers, families, and long-time residents.

Your role:
- Help users think through housing options, budgets, host communication, and local search steps
- Guide through German bureaucracy: Anmeldung, health insurance, bank accounts, residence permits
- Answer practical questions about daily life, work, study, family, and community in Germany
- Recommend how to use Karibu Community and Events to connect with people nearby
- Provide practical tips drawn from the Kenyan community in Germany

Tone: Warm, encouraging, and practical — like a trusted friend who has lived in Germany for years.
Keep answers concise. Use bullet points for steps. When giving steps, number them clearly.
Always be culturally sensitive to the Kenyan immigrant experience.
When relevant, suggest the Rathaus Finder for Bürgeramt appointments, or the Arrival Checklist.

Never make up specific prices, addresses, or official requirements — say "confirm this with the relevant office" for legal/official specifics."""


@router.post("/chat")
def chat(
    request: schemas.ChatRequest,
    current_user: models.User = Depends(get_current_user),
):
    if not settings.gemini_api_key:
        return {
            "reply": (
                "AI assistant is not configured yet. "
                "Add your GEMINI_API_KEY to backend/.env to enable it."
            )
        }

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)

        history = [
            types.Content(
                role="user" if msg.role == "user" else "model",
                parts=[types.Part(text=msg.content)],
            )
            for msg in request.history[-10:]
        ]

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=history + [types.Content(role="user", parts=[types.Part(text=request.message)])],
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
        )
        return {"reply": response.text}

    except Exception:
        return {
            "reply": (
                "Karibu Chat is connected, but the AI provider is temporarily unavailable. "
                "For now, use Community or Events for local questions, and use Rathaus Finder "
                "for official-service locations. Please try Karibu Chat again shortly."
            )
        }
