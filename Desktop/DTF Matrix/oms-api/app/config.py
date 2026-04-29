from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://oms:oms@localhost:5432/oms"
    CORS_ORIGINS: str = "http://localhost:3000"
    LOG_LEVEL: str = "INFO"
    AUTO_CREATE_TABLES: bool = False

    # BAT
    BAT_EXPIRATION_DAYS: int = 7
    BAT_MAX_UPLOAD_MB: int = 20
    BAT_PUBLIC_BASE_URL: str = "http://localhost:8000"

    # Storage
    STORAGE_BACKEND: str = "local"  # "local" | "s3"
    STORAGE_LOCAL_PATH: str = "./storage/bat"

    # Catalogue fournisseur — mockups t-shirts indexés
    # Dossier local servi par StaticFiles (peut être un symlink en dev)
    SUPPLIER_MOCKUPS_PATH: str = "./storage/supplier-mockups"
    # Préfixe URL public utilisé par les schémas Pydantic pour exposer les vues
    SUPPLIER_MOCKUPS_PUBLIC_PREFIX: str = "/static/supplier-mockups"

    # Brouillons (devis en cours)
    # Stockage fichier JSON — un fichier par draft. En prod sur le PC du
    # travail, pointer vers un dossier synchronisé Dropbox pour partage entre
    # postes ; le code écrit en atomic-rename (compatible avec la sync).
    DRAFTS_DIR: str = "./storage/drafts"
    S3_BUCKET: str | None = None
    S3_REGION: str | None = None
    S3_ACCESS_KEY: str | None = None
    S3_SECRET_KEY: str | None = None
    S3_ENDPOINT_URL: str | None = None

    # SMTP
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 25
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_TLS: bool = False
    SMTP_FROM: str = "no-reply@example.com"
    SMTP_TEAM_ADDRESS: str = "team@example.com"
    SMTP_ENABLED: bool = False  # disable in tests

    # Webhook
    # Si l'URL n'est pas définie, le service court-circuite — pas de secret
    # par défaut signable, et la feature reste éteinte tant que l'admin n'a
    # pas explicitement renseigné secret + URL + ENABLED=true.
    KANBAN_WEBHOOK_URL: str | None = None
    KANBAN_WEBHOOK_SECRET: str | None = None
    KANBAN_WEBHOOK_ENABLED: bool = False

    # Admin
    # Jeton partagé exigé par les routes /admin/* (header X-Admin-Token).
    # Aucune valeur par défaut : tant que l'env var n'est pas définie, les
    # routes admin renvoient 503 — on évite ainsi qu'une route soit ouverte
    # par accident en dev/staging.
    ADMIN_TOKEN: str | None = None

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
