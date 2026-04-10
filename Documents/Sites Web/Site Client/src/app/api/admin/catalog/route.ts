/**
 * GET  /api/admin/catalog        — liste tout le catalogue (familles + catégories + produits)
 * POST /api/admin/catalog        — créer un produit
 * PUT  /api/admin/catalog        — mettre à jour un produit (body: { id, ...fields })
 * DELETE /api/admin/catalog?id=X — supprimer un produit
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
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

// ── POST — créer un produit ───────────────────────────────────────
export async function POST(req: Request) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json() as {
    reference: string;
    designation: string;
    categorieId: number;
    note1?: string;
    note2?: string;
    moq?: number;
    stock?: number;
    prixPublic?: number;
    prixRevendeur?: number;
    imageUrl?: string;
    enLigne?: boolean;
  };

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
      stock: body.stock ?? null,
      prixPublic: body.prixPublic ?? null,
      prixRevendeur: body.prixRevendeur ?? null,
      imageUrl: body.imageUrl?.trim() || null,
      enLigne: body.enLigne ?? true,
    },
  });

  return NextResponse.json({ produit });
}

// ── PUT — mettre à jour un produit ───────────────────────────────
export async function PUT(req: Request) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await req.json() as {
    id: number;
    reference?: string;
    designation?: string;
    categorieId?: number;
    note1?: string;
    note2?: string;
    moq?: number | null;
    stock?: number | null;
    prixPublic?: number | null;
    prixRevendeur?: number | null;
    imageUrl?: string;
    enLigne?: boolean;
    // Famille / Catégorie update
    type?: "famille" | "categorie";
    nom?: string;
    strapline?: string;
    resume?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "ID manquant." }, { status: 400 });
  }

  // Update famille
  if (body.type === "famille") {
    const updated = await prisma.famille.update({
      where: { id: body.id },
      data: {
        ...(body.nom !== undefined ? { nom: body.nom.trim() } : {}),
        ...(body.strapline !== undefined ? { strapline: body.strapline.trim() } : {}),
        ...(body.resume !== undefined ? { resume: body.resume.trim() } : {}),
      },
    });
    return NextResponse.json({ famille: updated });
  }

  // Update catégorie
  if (body.type === "categorie") {
    const updated = await prisma.categorie.update({
      where: { id: body.id },
      data: { ...(body.nom !== undefined ? { nom: body.nom.trim() } : {}) },
    });
    return NextResponse.json({ categorie: updated });
  }

  // Update produit (default)
  const produit = await prisma.produit.update({
    where: { id: body.id },
    data: {
      ...(body.reference !== undefined ? { reference: body.reference.trim() } : {}),
      ...(body.designation !== undefined ? { designation: body.designation.trim() } : {}),
      ...(body.categorieId !== undefined ? { categorieId: body.categorieId } : {}),
      ...(body.note1 !== undefined ? { note1: body.note1.trim() || null } : {}),
      ...(body.note2 !== undefined ? { note2: body.note2.trim() || null } : {}),
      ...(body.moq !== undefined ? { moq: body.moq } : {}),
      ...(body.stock !== undefined ? { stock: body.stock } : {}),
      ...(body.prixPublic !== undefined ? { prixPublic: body.prixPublic } : {}),
      ...(body.prixRevendeur !== undefined ? { prixRevendeur: body.prixRevendeur } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl.trim() || null } : {}),
      ...(body.enLigne !== undefined ? { enLigne: body.enLigne } : {}),
    },
  });

  return NextResponse.json({ produit });
}

// ── DELETE — supprimer un produit ────────────────────────────────
export async function DELETE(req: Request) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "");

  if (!id) {
    return NextResponse.json({ error: "ID manquant." }, { status: 400 });
  }

  await prisma.produit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
