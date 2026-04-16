"""Centralized configuration with environment variable support"""

from pydantic_settings import BaseSettings   # pyright: ignore[reportMissingImports]


class Settings(BaseSettings):
    # App
    debug: bool = False
    log_level: str = "INFO"

    # URLs
    frontend_base_url: str = ""
    public_base_url: str = ""

    # Auth
    auth_secret: str = "globalflow-dev-auth-secret"  # Override in production!
    auth_state_max_age_seconds: int = 900

    # Cache
    redis_url: str = ""  # e.g., "redis://localhost:6379/0"
    cache_ttl_default: int = 300  # 5 minutes

    # Rate limiting
    rate_limit_per_minute: int = 60

    # Autopilot
    autopilot_enabled: bool = True
    autopilot_interval_seconds: int = 55

    # Allowed origins
    allowed_origins: str = "*"
    allowed_return_hosts: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
