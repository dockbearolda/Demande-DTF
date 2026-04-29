"""Fully mocked tests for dropbox_service. No network calls."""

from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Stub the `dropbox` SDK before importing the module under test, so the suite
# runs even when the real SDK is not installed.
# ---------------------------------------------------------------------------
if "dropbox" not in sys.modules:
    fake_dropbox = types.ModuleType("dropbox")
    fake_exceptions = types.ModuleType("dropbox.exceptions")
    fake_files = types.ModuleType("dropbox.files")

    class _ApiError(Exception):
        pass

    class _AuthError(Exception):
        pass

    class _FolderMetadata:
        pass

    fake_exceptions.ApiError = _ApiError
    fake_exceptions.AuthError = _AuthError
    fake_files.FolderMetadata = _FolderMetadata
    fake_dropbox.Dropbox = MagicMock()
    fake_dropbox.exceptions = fake_exceptions
    fake_dropbox.files = fake_files

    sys.modules["dropbox"] = fake_dropbox
    sys.modules["dropbox.exceptions"] = fake_exceptions
    sys.modules["dropbox.files"] = fake_files


from app.services import dropbox_service  # noqa: E402
from app.services.dropbox_service import (  # noqa: E402
    SUBFOLDERS,
    build_client_path,
    create_client_folder,
    sanitize_name,
)
from dropbox.exceptions import ApiError, AuthError  # noqa: E402
from dropbox.files import FolderMetadata  # noqa: E402


def make_client(*, exists: bool = False) -> MagicMock:
    client = MagicMock()
    if exists:
        client.files_get_metadata.return_value = FolderMetadata()
    else:
        client.files_get_metadata.side_effect = ApiError("not_found")
    client.files_create_folder_v2.return_value = MagicMock()
    return client


# ---------------------------------------------------------------------------
# sanitize_name / build_client_path
# ---------------------------------------------------------------------------
def test_sanitize_strips_illegal_chars():
    assert sanitize_name("Acme/Co:?*") == "Acme_Co"
    assert sanitize_name("  Hello   World  ") == "Hello_World"
    assert sanitize_name("///") == "client"


def test_build_client_path_uses_clients_root():
    assert build_client_path("Acme") == "/Clients/Acme"
    assert build_client_path("Foo Bar") == "/Clients/Foo_Bar"


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_create_all_subfolders_success():
    client = make_client(exists=False)

    result = await create_client_folder("Acme", dbx_client=client)

    assert result["success"] is True
    assert result["errors"] == []
    assert result["subfolders_created"] == SUBFOLDERS
    assert result["path"] == "/Clients/Acme"

    # base + 5 subfolders = 6 creations
    assert client.files_create_folder_v2.call_count == 6

    expected_calls = [result["path"]] + [f"{result['path']}/{s}" for s in SUBFOLDERS]
    actual_calls = [c.args[0] for c in client.files_create_folder_v2.call_args_list]
    assert actual_calls == expected_calls


# ---------------------------------------------------------------------------
# Idempotence
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_idempotent_when_folders_already_exist():
    client = make_client(exists=True)

    result = await create_client_folder("Acme", dbx_client=client)

    assert result["success"] is True
    assert result["subfolders_created"] == SUBFOLDERS
    client.files_create_folder_v2.assert_not_called()


@pytest.mark.asyncio
async def test_idempotent_when_create_returns_conflict():
    client = MagicMock()
    client.files_get_metadata.side_effect = ApiError("not_found")
    client.files_create_folder_v2.side_effect = ApiError("path/conflict/folder")

    result = await create_client_folder("Acme", dbx_client=client)

    assert result["success"] is True
    assert result["errors"] == []
    assert result["subfolders_created"] == SUBFOLDERS


# ---------------------------------------------------------------------------
# Failure modes
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_auth_error_returns_failure():
    client = MagicMock()
    client.files_get_metadata.side_effect = AuthError("invalid_access_token")

    result = await create_client_folder("Acme", dbx_client=client)

    assert result["success"] is False
    assert any("auth_error" in e for e in result["errors"])


@pytest.mark.asyncio
async def test_quota_exceeded():
    client = MagicMock()
    client.files_get_metadata.side_effect = ApiError("not_found")
    client.files_create_folder_v2.side_effect = ApiError("insufficient_space quota")

    result = await create_client_folder("Acme", dbx_client=client)

    assert result["success"] is False
    assert any("insufficient_space" in e or "quota" in e for e in result["errors"])


@pytest.mark.asyncio
async def test_network_timeout():
    client = MagicMock()
    client.files_get_metadata.side_effect = TimeoutError("connection timed out")

    result = await create_client_folder("Acme", dbx_client=client)

    assert result["success"] is False
    assert any("network_error" in e for e in result["errors"])


# ---------------------------------------------------------------------------
# Sanitization in real usage
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_special_characters_in_client_name():
    client = make_client(exists=False)

    result = await create_client_folder("Foo*Bar?/Baz", dbx_client=client)

    assert result["success"] is True
    assert "*" not in result["path"]
    assert "?" not in result["path"]
    assert result["path"].startswith("/Clients/")


@pytest.mark.asyncio
async def test_empty_client_name_falls_back():
    client = make_client(exists=False)
    result = await create_client_folder("///", dbx_client=client)
    assert result["success"] is True
    assert result["path"] == "/Clients/client"


# ---------------------------------------------------------------------------
# Token / configuration
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_missing_token_returns_error(monkeypatch):
    monkeypatch.delenv("DROPBOX_ACCESS_TOKEN", raising=False)

    result = await create_client_folder("Acme")

    assert result["success"] is False
    assert any("DROPBOX_ACCESS_TOKEN" in e for e in result["errors"])


@pytest.mark.asyncio
async def test_token_present_builds_client(monkeypatch):
    monkeypatch.setenv("DROPBOX_ACCESS_TOKEN", "test-token")
    fake_client = make_client(exists=False)

    with patch.object(dropbox_service.dropbox, "Dropbox", return_value=fake_client) as ctor:
        result = await create_client_folder("Acme")

    ctor.assert_called_once_with("test-token")
    assert result["success"] is True
