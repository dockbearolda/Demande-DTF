/**
 * Catalog data adapter — 3 sources par ordre de priorité :
 *
 * 1. Strapi CMS      (si NEXT_PUBLIC_STRAPI_URL est défini)
 * 2. PostgreSQL DB   (si DATABASE_URL est défini — géré via admin /admin/catalogue)
 * 3. Catalogue statique (src/data/catalog.ts — fallback)
 */

import type { CatalogFamily, CatalogProduct, CatalogSubfamily } from "@/data/catalog";
import {
  getCatalogFamilyById,
  getCatalogSubfamilyBySlug,
  orderedCatalogFamilies,
  slugifyLabel,
} from "@/data/catalog";
import {
  getStrapiFamilies,
  getStrapiFamilyBySlug,
  getStrapiSubfamily,
  isStrapiConfigured,
  type PrixContext,
} from "./strapi";
import { isDBConfigured, prisma } from "./prisma";

export { slugifyLabel };
export type { PrixContext };

// ── DB → CatalogFamily mappers ────────────────────────────────────

type PrismaFamille = {
  id: number;
  slug: string;
  nom: string;
  strapline: string;
  resume: string;
  accent: string;
  surface: string;
  signauxBusiness: string[];
  ordre: number;
  categories: Array<{
    id: number;
    slug: string;
    nom: string;
    ordre: number;
    produits: Array<{
      id: number;
      reference: string;
      designation: string;
      note1: string | null;
      note2: string | null;
      moq: number | null;
      stock: number | null;
      prixPublic: number | null;
      prixRevendeur: number | null;
      imageUrl: string | null;
      enLigne: boolean;
    }>;
  }>;
};

function mapProduitDB(p: PrismaFamille["categories"][0]["produits"][0]): CatalogProduct {
  return {
    ref: p.reference,
    label: p.designation,
    ...(p.note1 ? { note1: p.note1 } : {}),
    ...(p.note2 ? { note2: p.note2 } : {}),
    ...(p.moq !== null ? { moq: p.moq } : {}),
    ...(p.stock !== null ? { stock: p.stock } : {}),
    ...(p.prixRevendeur !== null ? { resellerPrice: String(p.prixRevendeur) } : {}),
    ...(p.prixPublic !== null ? { retailPrice: String(p.prixPublic) } : {}),
    ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
  };
}

function mapFamilleDB(raw: PrismaFamille): CatalogFamily {
  const subfamilies: CatalogSubfamily[] = raw.categories
    .sort((a, b) => a.ordre - b.ordre)
    .map((cat) => {
      const products = cat.produits
        .filter((p) => p.enLigne)
        .map(mapProduitDB);
      return {
        name: cat.nom,
        products,
        itemCount: products.length,
        examples: products.slice(0, 4).map((p) => p.label),
      };
    });

  return {
    id: raw.slug,
    name: raw.nom,
    strapline: raw.strapline,
    summary: raw.resume,
    accent: raw.accent,
    surface: raw.surface,
    businessSignals: raw.signauxBusiness,
    subfamilies,
    referenceCount: subfamilies.reduce((s, f) => s + f.itemCount, 0),
  };
}

async function getDBFamilies(): Promise<CatalogFamily[]> {
  const familles = await prisma.famille.findMany({
    orderBy: { ordre: "asc" },
    include: {
      categories: {
        orderBy: { ordre: "asc" },
        include: { produits: { where: { enLigne: true }, orderBy: { reference: "asc" } } },
      },
    },
  });
  return (familles as PrismaFamille[]).map(mapFamilleDB);
}

async function getDBFamilyBySlug(slug: string): Promise<CatalogFamily | null> {
  const famille = await prisma.famille.findUnique({
    where: { slug },
    include: {
      categories: {
        orderBy: { ordre: "asc" },
        include: { produits: { where: { enLigne: true }, orderBy: { reference: "asc" } } },
      },
    },
  });
  if (!famille) return null;
  return mapFamilleDB(famille as PrismaFamille);
}

async function getDBSubfamily(
  familySlug: string,
  subfamilySlug: string,
): Promise<{ family: CatalogFamily; subfamily: CatalogSubfamily } | null> {
  const family = await getDBFamilyBySlug(familySlug);
  if (!family) return null;
  const subfamily = family.subfamilies.find(
    (s) => slugifyLabel(s.name) === subfamilySlug,
  );
  if (!subfamily) return null;
  return { family, subfamily };
}

// ── Public API — Families ─────────────────────────────────────────

export async function getCatalogFamiliesData(): Promise<CatalogFamily[]> {
  if (isStrapiConfigured()) {
    try {
      return await getStrapiFamilies();
    } catch (err) {
      console.warn("[catalog-source] Strapi unreachable, trying DB.", err);
    }
  }
  if (isDBConfigured()) {
    try {
      return await getDBFamilies();
    } catch (err) {
      console.warn("[catalog-source] DB unreachable, using static data.", err);
    }
  }
  return [...orderedCatalogFamilies];
}

export async function getCatalogFamilyData(
  familyId: string,
): Promise<CatalogFamily | null> {
  if (isStrapiConfigured()) {
    try {
      return await getStrapiFamilyBySlug(familyId);
    } catch (err) {
      console.warn("[catalog-source] Strapi unreachable, trying DB.", err);
    }
  }
  if (isDBConfigured()) {
    try {
      return await getDBFamilyBySlug(familyId);
    } catch (err) {
      console.warn("[catalog-source] DB unreachable, using static data.", err);
    }
  }
  return getCatalogFamilyById(familyId) ?? null;
}

export async function getCatalogSubfamilyData(
  familyId: string,
  subfamilySlug: string,
  ctx?: PrixContext,
): Promise<{ family: CatalogFamily; subfamily: CatalogSubfamily } | null> {
  if (isStrapiConfigured()) {
    try {
      return await getStrapiSubfamily(familyId, subfamilySlug, ctx);
    } catch (err) {
      console.warn("[catalog-source] Strapi unreachable, trying DB.", err);
    }
  }
  if (isDBConfigured()) {
    try {
      return await getDBSubfamily(familyId, subfamilySlug);
    } catch (err) {
      console.warn("[catalog-source] DB unreachable, using static data.", err);
    }
  }
  return getCatalogSubfamilyBySlug(familyId, subfamilySlug) ?? null;
}

// ── Static params for generateStaticParams ───────────────────────

export async function getAllCatalogStaticParams(): Promise<
  Array<{ family: string; subfamily: string }>
> {
  const families = await getCatalogFamiliesData();
  return families.flatMap((family) =>
    family.subfamilies.map((subfamily) => ({
      family: family.id,
      subfamily: slugifyLabel(subfamily.name),
    })),
  );
}
