import asyncio
import logging
from abc import ABC, abstractmethod
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class StorageBackend(ABC):
    @abstractmethod
    async def save(self, relative_key: str, content: bytes) -> str:
        """Save bytes under relative_key, return the stored path/URL."""

    @abstractmethod
    async def read(self, relative_key: str) -> bytes:
        """Read the bytes for relative_key."""

    @abstractmethod
    def public_url(self, relative_key: str) -> str:
        """Return a URL usable by the API to serve this file."""


class LocalStorage(StorageBackend):
    def __init__(self, root: str):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _full(self, relative_key: str) -> Path:
        # Prevent path traversal
        p = (self.root / relative_key).resolve()
        if not str(p).startswith(str(self.root)):
            raise ValueError("Invalid storage path")
        return p

    async def save(self, relative_key: str, content: bytes) -> str:
        path = self._full(relative_key)

        def _write() -> None:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)

        await asyncio.to_thread(_write)
        return str(path)

    async def read(self, relative_key: str) -> bytes:
        path = self._full(relative_key)
        return await asyncio.to_thread(path.read_bytes)

    def public_url(self, relative_key: str) -> str:
        # Served by the /bat/file/{token} endpoint
        return relative_key


class S3Storage(StorageBackend):
    def __init__(self, bucket: str, region: str | None, access_key: str | None,
                 secret_key: str | None, endpoint_url: str | None):
        try:
            import boto3  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "boto3 is required for S3 storage. Install boto3 or use STORAGE_BACKEND=local."
            ) from exc
        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            endpoint_url=endpoint_url,
        )

    async def save(self, relative_key: str, content: bytes) -> str:
        # boto3 est synchrone — déporté sur un worker thread pour ne pas
        # bloquer l'event loop FastAPI.
        await asyncio.to_thread(
            self.client.put_object,
            Bucket=self.bucket,
            Key=relative_key,
            Body=content,
        )
        return f"s3://{self.bucket}/{relative_key}"

    async def read(self, relative_key: str) -> bytes:
        def _read() -> bytes:
            obj = self.client.get_object(Bucket=self.bucket, Key=relative_key)
            return obj["Body"].read()

        return await asyncio.to_thread(_read)

    def public_url(self, relative_key: str) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": relative_key},
            ExpiresIn=3600,
        )


def get_storage() -> StorageBackend:
    if settings.STORAGE_BACKEND == "s3":
        if not settings.S3_BUCKET:
            raise RuntimeError("S3_BUCKET is required when STORAGE_BACKEND=s3")
        return S3Storage(
            bucket=settings.S3_BUCKET,
            region=settings.S3_REGION,
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
            endpoint_url=settings.S3_ENDPOINT_URL,
        )
    return LocalStorage(settings.STORAGE_LOCAL_PATH)


# Allowed MIME types and their canonical extensions
ALLOWED_MIME_TYPES: dict[str, str] = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/svg+xml": "svg",
}


def validate_mime_type(content_type: str | None) -> str:
    """Return the canonical extension for an allowed MIME type, or raise ValueError."""
    if not content_type:
        raise ValueError("Missing content type")
    ext = ALLOWED_MIME_TYPES.get(content_type.lower())
    if not ext:
        raise ValueError(f"Unsupported file type: {content_type}")
    return ext
