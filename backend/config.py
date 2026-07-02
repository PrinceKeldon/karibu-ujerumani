from pathlib import Path

from pydantic_settings import BaseSettings


ENV_FILE = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost/karibu_ujerumani"
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    gemini_api_key: str = ""
    supabase_url: str = ""
    seed_demo_data: bool = False

    model_config = {"env_file": ENV_FILE, "env_file_encoding": "utf-8"}


settings = Settings()
