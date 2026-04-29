"""Integration tests for /drafts routes (file-backed storage).

The routes write JSON files to `settings.DRAFTS_DIR`. We point that env var to
a fresh tmp directory per test to keep runs isolated and deterministic.
"""
import pytest
from httpx import AsyncClient

from app.config import settings


@pytest.fixture(autouse=True)
def isolated_drafts_dir(tmp_path, monkeypatch):
    """Force every draft test to write into a per-test tmp directory."""
    monkeypatch.setattr(settings, "DRAFTS_DIR", str(tmp_path / "drafts"))


@pytest.mark.asyncio
async def test_new_id_returns_uuid_hex(client: AsyncClient):
    r = await client.post("/drafts/_new_id")
    assert r.status_code == 200
    body = r.json()
    assert "id" in body
    # 32-char hex (uuid4().hex format)
    assert len(body["id"]) == 32
    assert all(c in "0123456789abcdef" for c in body["id"])


@pytest.mark.asyncio
async def test_upsert_creates_then_get_returns_payload(client: AsyncClient):
    draft_id = "abc123_-test"
    r = await client.put(
        f"/drafts/{draft_id}",
        json={
            "payload": {"step": "products", "items": [{"qty": 3}]},
            "client_name": "ACME",
            "item_count": 3,
            "reference_count": 1,
            "last_step": 2,
        },
    )
    assert r.status_code == 200
    assert r.json()["client_name"] == "ACME"
    assert r.json()["item_count"] == 3

    r = await client.get(f"/drafts/{draft_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == draft_id
    assert body["payload"] == {"step": "products", "items": [{"qty": 3}]}


@pytest.mark.asyncio
async def test_upsert_overwrites_existing_draft(client: AsyncClient):
    draft_id = "overwrite-1"
    await client.put(
        f"/drafts/{draft_id}",
        json={"payload": {"v": 1}, "item_count": 1},
    )
    await client.put(
        f"/drafts/{draft_id}",
        json={"payload": {"v": 2}, "item_count": 5},
    )
    r = await client.get(f"/drafts/{draft_id}")
    assert r.json()["payload"] == {"v": 2}
    assert r.json()["item_count"] == 5


@pytest.mark.asyncio
async def test_upsert_preserves_created_at_on_overwrite(client: AsyncClient):
    """`created_at` must be set on first write and preserved on subsequent
    upserts — only `updated_at` rotates."""
    draft_id = "stable-created-at"
    r = await client.put(f"/drafts/{draft_id}", json={"payload": {}})
    first_created = r.json()["created_at"]

    r = await client.put(f"/drafts/{draft_id}", json={"payload": {"x": 1}})
    assert r.json()["created_at"] == first_created
    assert r.json()["updated_at"] != first_created


@pytest.mark.asyncio
async def test_get_unknown_draft_returns_404(client: AsyncClient):
    r = await client.get("/drafts/nope")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_is_idempotent(client: AsyncClient):
    draft_id = "delete-me"
    await client.put(f"/drafts/{draft_id}", json={"payload": {}})
    r = await client.delete(f"/drafts/{draft_id}")
    assert r.status_code == 204
    # Deleting again must succeed silently.
    r = await client.delete(f"/drafts/{draft_id}")
    assert r.status_code == 204
    # And the GET should now 404.
    r = await client.get(f"/drafts/{draft_id}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_list_drafts_orders_by_updated_at_desc(client: AsyncClient):
    import asyncio

    await client.put("/drafts/oldest", json={"payload": {}, "item_count": 1})
    # Short sleep so updated_at differs deterministically.
    await asyncio.sleep(0.01)
    await client.put("/drafts/middle", json={"payload": {}, "item_count": 2})
    await asyncio.sleep(0.01)
    await client.put("/drafts/newest", json={"payload": {}, "item_count": 3})

    r = await client.get("/drafts")
    assert r.status_code == 200
    ids = [d["id"] for d in r.json()]
    assert ids[:3] == ["newest", "middle", "oldest"]


@pytest.mark.parametrize(
    "bad_id",
    [
        "../escape",            # path traversal — normalised away by Starlette → 404
        "with space",           # space disallowed by regex → 400
        "../../../etc/passwd",  # absolute traversal — 404 (route normalisation)
        "a" * 65,               # too long → 400
    ],
)
@pytest.mark.asyncio
async def test_invalid_draft_id_rejected(client: AsyncClient, bad_id: str):
    r = await client.put(
        f"/drafts/{bad_id}", json={"payload": {}}
    )
    # Either the regex guard rejects (400) or Starlette's path normalisation
    # short-circuits before we reach the handler (404). Both are acceptable
    # — the point is "no successful write under that id".
    assert r.status_code in (400, 404)


@pytest.mark.asyncio
async def test_drafts_dir_blank_yields_500(client: AsyncClient, monkeypatch):
    """An accidentally-empty DRAFTS_DIR must fail loudly, not silently write
    into the process cwd."""
    monkeypatch.setattr(settings, "DRAFTS_DIR", "   ")
    r = await client.put("/drafts/anything", json={"payload": {}})
    assert r.status_code == 500
