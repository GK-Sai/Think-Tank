"""Settings, read from the environment (or a .env file beside this project)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- database ---------------------------------------------------------
    # asyncpg is the driver; note the +asyncpg in the URL.
    database_url: str = "postgresql+asyncpg://thinktank:thinktank@localhost:5432/thinktank"

    # --- auth -------------------------------------------------------------
    # The access token is a JWT the client holds and sends back as
    # `Authorization: Bearer <token>`. Change the secret before anything real
    # runs on it — rotating it signs everyone out, which is the point.
    secret_key: str = "change-me-before-you-deploy-this-anywhere"
    jwt_algorithm: str = "HS256"
    session_days: int = 14

    # --- cors -------------------------------------------------------------
    # The token travels in a header, not a cookie, so these are not
    # credentialed requests and "*" would be legal. Naming the front ends
    # anyway keeps a stray page on some other origin from calling the API.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"

    # Somebody counts as online if they did anything in the app this recently.
    online_window_seconds: int = 180

    # The shared password new members are created with, mirroring the demo.
    default_member_password: str = "tt123"

    # --- logging ----------------------------------------------------------
    # DEBUG while you are developing, INFO once it is running for real.
    log_level: str = "INFO"
    # Written relative to wherever you start uvicorn, i.e. thinktank-api/logs.
    log_dir: str = "logs"
    log_to_file: bool = True
    log_file_max_bytes: int = 5 * 1024 * 1024   # 5 MB, then it rotates
    log_file_backups: int = 5                   # thinktank.log.1 … .5
    # Prints every SQL statement SQLAlchemy runs. Very loud — turn it on only
    # while you are working out why a query returns what it returns.
    log_sql: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()