/**
 * GET  /api/admin/catalog              — liste tout le catalogue
 * POST /api/admin/catalog              — créer produit / famille / catégorie
 * PUT  /api/admin/catalog              — mettre à jour produit / famille / catégorie
 * DELETE /api/admin/catalog?id=X&type= — supprimer produit / famille / catégorie
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── GET — tout le catalogue ───────────────────────────────────────
export async function GET() {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const familles = await prisma.famille.findMany({
    orderBy: { ordre: "asc" },
    include: {
      categories: {
        orderBy: { ordre: "asc" },
        include: {
          produits: { orderBy: { reference: "asc" } },
        },
      },
    },
  });

  return NextResponse.json({ familles });
}

// ── POST — créer produit / famille / catégorie ────────────────────
export async function POST(req: Request) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json() as {
    type?: "famille" | "categorie";
    // Famille
    nom?: string;
    strapline?: string;
    resume?: string;
    accent?: string;
    surface?: string;
    // Catégorie
    familleId?: number;
    // Produit
    reference?: string;
    designation?: string;
    categorieId?: number;
    note1?: string;
    note2?: string;
    moq?: number;
    step?: number;
    stock?: number;
    prixPublic?: number;
    prixRevendeur?: number;
    imageUrl?: string;
    enLigne?: boolean;
  };

  // Créer une famille
  if (body.type === "famille") {
    if (!body.nom) return NextResponse.json({ error: "Nom obligatoire." }, { status: 400 });
    const maxOrdre = await prisma.famille.aggregate({ _max: { ordre: true } });
    const famille = await prisma.famille.create({
      data: {
        nom: body.nom.trim(),
        slug: slugify(body.nom),
        strapline: body.strapline?.trim() ?? "",
        resume: body.resume?.trim() ?? "",
        accent: body.accent ?? "#dbe7ff",
        surface: body.surface ?? "rgba(219, 231, 255, 0.68)",
        ordre: (maxOrdre._max.ordre ?? 0) + 1,
      },
    });
    return NextResponse.json({ famille });
  }

  // Créer une catégorie
  if (body.type === "categorie") {
    if (!body.nom || !body.familleId) {
      return NextResponse.json({ error: "Nom et famille obligatoires." }, { status: 400 });
    }
    const maxOrdre = await prisma.categorie.aggregate({
      where: { familleId: body.familleId },
      _max: { ordre: true },
    });
    const categorie = await prisma.categorie.create({
      data: {
        nom: body.nom.trim(),
        slug: slugify(body.nom),
        familleId: body.familleId,
        ordre: (maxOrdre._max.ordre ?? 0) + 1,
      },
    });
    return NextResponse.json({ categorie });
  }

  // Créer un produit (défaut)
  if (!body.reference || !body.designation || !body.categorieId) {
    return NextResponse.json({ error: "Champs obligatoires manquants." }, { status: 400 });
  }

  const produit = await prisma.produit.create({
    data: {
      reference: body.reference.trim(),
      designation: body.designation.trim(),
      categorieId: body.categorieId,
      note1: body.note1?.trim() || null,
      note2: body.note2?.trim() || null,
      moq: body.moq ?? null,
      step: body.step ?? null,
      stock: body.stock ?? null,
      prixPublic: body.prixPublic ?? null,
      prixRevendeur: body.prixRevendeur ?? null,
      imageUrl: body.imageUrl?.trim() || null,
      enLigne: body.enLigne ?? true,
    },
  });

  return NextResponse.json({ produit });
}

// ── PUT — mettre à jour produit / famille / catégorie ────────────
export async function PUT(req: Request) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json() as {
    id: number;
    type?: "famille" | "categorie";
    nom?: string;
    strapline?: string;
    resume?: string;
    accent?: string;
    surface?: string;
    ordre?: number;
    reference?: string;
    designation?: string;
    categorieId?: number;
    note1?: string | null;
    note2?: string | null;
    moq?: number | null;
    step?: number | null;
    stock?: number | null;
    prixPublic?: number | null;
    prixRevendeur?: number | null;
    imageUrl?: string | null;
    enLigne?: boolean;
  };

  if (!body.id) return NextResponse.json({ error: "ID manquant." }, { status: 400 });

  if (body.type === "famille") {
    const updated = await prisma.famille.update({
      where: { id: body.id },
      data: {
        ...(body.nom !== undefined ? { nom: body.nom.trim(), slug: slugify(body.nom) } : {}),
        ...(body.strapline !== undefined ? { strapline: body.strapline.trim() } : {}),
        ...(body.resume !== undefined ? { resume: body.resume.trim() } : {}),
        ...(body.accent !== undefined ? { accent: body.accent } : {}),
        ...(body.surface !== undefined ? { surface: body.surface } : {}),
        ...(body.ordre !== undefined ? { ordre: body.ordre } : {}),
      },
    });
    return NextResponse.json({ famille: updated });
  }

  if (body.type === "categorie") {
    const updated = await prisma.categorie.update({
      where: { id: body.id },
      data: {
        ...(body.nom !== undefined ? { nom: body.nom.trim(), slug: slugify(body.nom) } : {}),
        ...(body.ordre !== undefined ? { ordre: body.ordre } : {}),
      },
    });
    return NextResponse.json({ categorie: updated });
  }

  const produit = await prisma.produit.update({
    where: { id: body.id },
    data: {
      ...(body.reference !== undefined ? { reference: body.reference.trim() } : {}),
      ...(body.designation !== undefined ? { designation: body.designation.trim() } : {}),
      ...(body.categorieId !== undefined ? { categorieId: body.categorieId } : {}),
      ...(body.note1 !== undefined ? { note1: body.note1?.trim() || null } : {}),
      ...(body.note2 !== undefined ? { note2: body.note2?.trim() || null } : {}),
      ...(body.moq !== undefined ? { moq: body.moq } : {}),
      ...(body.step !== undefined ? { step: body.step } : {}),
      ...(body.stock !== undefined ? { stock: body.stock } : {}),
      ...(body.prixPublic !== undefined ? { prixPublic: body.prixPublic } : {}),
      ...(body.prixRevendeur !== undefined ? { prixRevendeur: body.prixRevendeur } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl?.trim() || null } : {}),
      ...(body.enLigne !== undefined ? { enLigne: body.enLigne } : {}),
    },
  });

  return NextResponse.json({ produit });
}

// ── DELETE — supprimer produit / famille / catégorie ──────────────
export async function DELETE(req: Request) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "");
  const type = searchParams.get("type") ?? "produit";

  if (!id) return NextResponse.json({ error: "ID manquant." }, { status: 400 });

  if (type === "famille") {
    await prisma.famille.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (type === "categorie") {
    await prisma.categorie.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  await prisma.produit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
