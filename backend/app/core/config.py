from typing import List, Union, Optional, Dict, Any
from pydantic import AnyHttpUrl, validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # DEBUG: Prove config is loading
    print("----------------------------------------------------------------")
    print("LOADING CONFIG.PY - SETTINGS INITIALIZATION")
    print("----------------------------------------------------------------")

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Safe Tasks V3"
    FRONTEND_URL: AnyHttpUrl = "http://localhost:3000"
    
    # Environment
    ENVIRONMENT: str = "development"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @validator("API_V1_STR", pre=True)
    def validate_api_v1_str(cls, v: str) -> str:
        if v:
            # Strip quotes which might differ between local .env and injected env vars
            cleaned = v.strip('"').strip("'")
            if not cleaned.startswith("/"):
                return f"/{cleaned}"
            return cleaned
        return v

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Database Settings
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "safetasks"
    POSTGRES_PORT: str = "5432"
    
    DATABASE_URL: Optional[str] = None
    SQLALCHEMY_DATABASE_URI: Optional[str] = None

    @validator("SQLALCHEMY_DATABASE_URI", pre=True)
    def assemble_db_connection(cls, v: Optional[str], values: Dict[str, Any]) -> Any:
        if isinstance(v, str):
            return v.strip('"').strip("'")

        database_url = values.get("DATABASE_URL")
        if isinstance(database_url, str) and database_url:
            return database_url.strip('"').strip("'")
        
        user = values.get("POSTGRES_USER")
        password = values.get("POSTGRES_PASSWORD")
        server = values.get("POSTGRES_SERVER")
        port = values.get("POSTGRES_PORT")
        db = values.get("POSTGRES_DB")
        
        uri = f"postgresql+asyncpg://{user}:{password}@{server}:{port}/{db}"
        return uri

    # Auth
    SECRET_KEY: str = "YOUR_SECRET_KEY_HERE"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    
    # AI (Gemini)
    GEMINI_API_KEY: Optional[str] = None
    AI_ENABLED: bool = True
    AI_MODEL: str = "gemini-pro"
    AI_MAX_TOKENS: int = 4000
    AI_TEMPERATURE: float = 0.7

    # Financial automation
    FINANCIAL_AUTOMATION_ENABLED: bool = True
    DEFAULT_INVOICE_DUE_DAYS: int = 14

    # ✅ CORREÇÃO AQUI: Adicionando as variáveis de Storage para parar o erro
    # Supabase
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    
    # Google Drive (Prevenindo o próximo erro)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_PROJECT_ID: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None
    
    # Google Service Account (Production support via Env Var)
    GOOGLE_CREDENTIALS_JSON: Optional[str] = None

    # Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # WhatsApp (Evolution API) - Optional, for future integration
    WHATSAPP_API_URL: Optional[str] = None
    WHATSAPP_API_KEY: Optional[str] = None
    WHATSAPP_INSTANCE_NAME: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
