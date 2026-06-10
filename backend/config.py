"""
BrewTrade AI - Configuration Settings
Central configuration for the BrewTrade AI backend.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    """Application settings (env-overridable via .env if present)."""

    # Anthropic Claude API
    CLAUDE_API_KEY: str = "YOUR_CLAUDE_API_KEY_HERE"
    CLAUDE_MODEL: str = "claude-sonnet-4-5"

    # Database
    DATABASE_URL = os.getenv("DATABASE_URL")

    # App
    APP_NAME: str = "BrewTrade AI"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # CORS
    # CORS_ORIGINS: list[str] = [
    #     "http://localhost:5173",
    #     "http://localhost:3000",
    # ]

    # CORS_ORIGINS = ["https://brewtrade-ai.onrender.com"]

    CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://brewtrade-ai.onrender.com"
]

    # Static / uploads
    STATIC_DIR: str = "static"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
