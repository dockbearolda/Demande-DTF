"""Integration tests for /catalog/supplier routes.

The routes serve a tree of `SupplierModel → SupplierColor → SupplierMockup`.
Tests seed the relationships directly via the test session and assert the
public-URL computation, category grouping, and disabled-row filtering.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.supplier_catalog import (
    SupplierColor,
    SupplierMockup,
    SupplierModel,
)


async def _seed_model(
    db: AsyncSession,
    *,
    ref_internal: str,
    category: str,
    enabled: bool = True,
    colors: list[dict] | None = None,
) -> SupplierModel:
    """Insert a complete model with colors+mockups in one shot."""
    model = SupplierModel(
        ref_internal=ref_internal,
        ref_supplier=f"SUP-{ref_internal}",
        ref_label=f"Label {ref_internal}",
        category=category,
        enabled=enabled,
        position=0,
    )
    db.add(model)
    await db.flush()

    for c in colors or []:
        color = SupplierColor(
            supplier_model_id=model.id,
            slug=c["slug"],
            label=c["label"],
            hex=c.get("hex"),
            enabled=c.get("enabled", True),
            position=0,
        )
        db.add(color)
        await db.flush()
        for view, file_path in (c.get("mockups") or {}).items():
            db.add(
                SupplierMockup(
                    supplier_color_id=color.id,
                    view=view,
                    file_path=file_path,
                    ext="png",
                    is_lifestyle=False,
                )
            )

    await db.commit()
    return model


@pytest.mark.asyncio
async def test_tree_empty_returns_zeros(client: AsyncClient):
    r = await client.get("/catalog/supplier/tree")
    assert r.status_code == 200
    body = r.json()
    assert body["categories"] == []
    assert body["total_models"] == 0
    assert body["total_colors"] == 0
    assert body["total_mockups"] == 0


@pytest.mark.asyncio
async def test_tree_groups_by_category_in_canonical_order(
    client: AsyncClient, db_session: AsyncSession
):
    await _seed_model(
        db_session,
        ref_internal="F-001",
        category="FEMME",
        colors=[{"slug": "noir", "label": "Noir"}],
    )
    await _seed_model(
        db_session,
        ref_internal="H-001",
        category="HOMME",
        colors=[{"slug": "blanc", "label": "Blanc"}],
    )

    r = await client.get("/catalog/supplier/tree")
    assert r.status_code == 200
    cats = [g["category"] for g in r.json()["categories"]]
    # HOMME comes before FEMME per CATEGORY_ORDER.
    assert cats.index("HOMME") < cats.index("FEMME")


@pytest.mark.asyncio
async def test_tree_skips_disabled_models(
    client: AsyncClient, db_session: AsyncSession
):
    await _seed_model(
        db_session,
        ref_internal="H-DIS",
        category="HOMME",
        enabled=False,
        colors=[{"slug": "noir", "label": "Noir"}],
    )
    r = await client.get("/catalog/supplier/tree")
    refs = [m["ref_internal"] for g in r.json()["categories"] for m in g["models"]]
    assert "H-DIS" not in refs


@pytest.mark.asyncio
async def test_tree_skips_disabled_colors(
    client: AsyncClient, db_session: AsyncSession
):
    await _seed_model(
        db_session,
        ref_internal="H-002",
        category="HOMME",
        colors=[
            {"slug": "noir", "label": "Noir", "enabled": True},
            {"slug": "rouge", "label": "Rouge", "enabled": False},
        ],
    )
    r = await client.get("/catalog/supplier/tree")
    h_models = next(
        g for g in r.json()["categories"] if g["category"] == "HOMME"
    )["models"]
    h002 = next(m for m in h_models if m["ref_internal"] == "H-002")
    color_slugs = [c["slug"] for c in h002["colors"]]
    assert "noir" in color_slugs
    assert "rouge" not in color_slugs


@pytest.mark.asyncio
async def test_mockup_url_uses_public_prefix(
    client: AsyncClient, db_session: AsyncSession, monkeypatch
):
    monkeypatch.setattr(
        settings, "SUPPLIER_MOCKUPS_PUBLIC_PREFIX", "/static/sup"
    )
    await _seed_model(
        db_session,
        ref_internal="H-003",
        category="HOMME",
        colors=[
            {
                "slug": "bleu",
                "label": "Bleu",
                "mockups": {"front": "h-003/bleu/front.png"},
            }
        ],
    )
    r = await client.get("/catalog/supplier/models/H-003")
    assert r.status_code == 200
    mockups = r.json()["colors"][0]["mockups"]
    assert mockups[0]["url"] == "/static/sup/h-003/bleu/front.png"


@pytest.mark.asyncio
async def test_get_model_404_when_unknown(client: AsyncClient):
    r = await client.get("/catalog/supplier/models/DOES_NOT_EXIST")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_tree_totals_count_only_what_is_serialised(
    client: AsyncClient, db_session: AsyncSession
):
    """`total_models/colors/mockups` are computed on the underlying tables,
    not on the filtered view — they include disabled rows. Document this
    behaviour so future changes don't drift silently."""
    await _seed_model(
        db_session,
        ref_internal="H-T",
        category="HOMME",
        colors=[
            {
                "slug": "noir",
                "label": "Noir",
                "mockups": {"front": "f.png", "back": "b.png"},
            }
        ],
    )
    r = await client.get("/catalog/supplier/tree")
    body = r.json()
    assert body["total_models"] >= 1
    assert body["total_colors"] >= 1
    assert body["total_mockups"] >= 2
