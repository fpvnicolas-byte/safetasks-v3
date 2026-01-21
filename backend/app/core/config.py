from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Project
    PROJECT_NAME: str
    API_V1_STR: str = "/api/v1"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str

    # PostgreSQL (from Supabase)
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_SERVER: str
    POSTGRES_PORT: str
    POSTGRES_DB: str

    # External APIs
    OPENAI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: str
    FISCAL_PROVIDER_API_KEY: Optional[str] = None

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    class Config:
        env_file = ".env"


settings = Settings()