import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { embedAppFonts } from "./fonts";
import type { ViewId } from "./types";

export interface BatPdfView {
  id: ViewId;
  label: string;
  composedPng: Blob;
  sizePct: number;
  posXPct: number;
  posYPct: number;
  mockupFile: string;
  logoFile: string | null;
}

/** Fiche technique du produit injectée dans le BAT. */
export interface BatProductFiche {
  brand?: string;
  modelReference?: string;
  modelName?: string;
  skuSupplier?: string;
  fabricComposition?: string;
  fabricWeightGsm?: number;
  fitType?: string;
  availableSizes?: string;
  orderedSizes?: string;
  /** Nom commercial fabricant. */
  colorCommercialName?: string;
  colorLabel?: string;
  colorManufacturerCode?: string;
  pantone?: string;
  hex?: string;
  rgb?: { r: number; g: number; b: number };
}

/** Métadonnées d'impression. */
export interface BatPrintFiche {
  technique?: string;
  colorCount?: number;
  resolutionDpi?: number;
  colorProfile?: string;
}

export interface BatPdfInput {
  reference: string;
  /** Numéro de version (v1, v2…). 1 par défaut. */
  version?: number;
  clientName: string;
  date: Date;
  productLabel: string;
  color: string;
  sizesSummary: string;
  totalQuantity: number;
  views: BatPdfView[];
  fiche?: BatProductFiche;
  print?: BatPrintFiche;
  /** Liste de champs manquants — affichés dans une zone d'avertissement. */
  warnings?: string[];
}

const PAGE_W = 842; // A4 landscape (pt @ 72dpi)
const PAGE_H = 595;
const MARGIN = 24;
const HEADER_H = 92;
const FICHE_H = 96; // Fiche produit + couleur (cover page)
const FOOTER_H = 22;

const TEXT = rgb(0.118, 0.161, 0.231);
const MUTED = rgb(0.451, 0.494, 0.553);
const RULE = rgb(0.886, 0.91, 0.941);
const WARN = rgb(0.918, 0.498, 0.067);
const WARN_BG = rgb(1.0, 0.957, 0.882);
const ACCENT = rgb(0.043, 0.122, 0.318);

export function parseMockupSku(filename: string): { model: string; color: string } {
  const base = filename.replace(/\.[^.]+$/, "");
  const parts = base.split("_");
  if (parts.length >= 2) {
    return { color: parts[parts.length - 1], model: parts.slice(0, -1).join("_") };
  }
  return { model: base, color: "" };
}

export function formatBatFilename(reference: string, date: Date, version = 1, color?: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  const safe = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const safeRef = safe(reference) || "brouillon";
  const safeColor = color ? `_${safe(color)}` : "";
  return `BAT_${safeRef}${safeColor}_v${version}_${stamp}.pdf`;
}

/**
 * Convertit un PNG en JPEG qualité 0.85 et downscale à 1600 px max.
 * Objectif : tenir sous 3 Mo total pour un BAT 4 vues (envoi WhatsApp).
 * Un mockup textile ne perd pas de qualité visible à JPEG q=0.85 / 1600 px.
 */
async function optimizeMockupImage(
  png: Blob,
  maxDim = 1600,
  quality = 0.85,
): Promise<{ bytes: Uint8Array; type: "jpeg" }> {
  const bitmap = await createImageBitmap(png);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D indisponible");
  // Fond blanc explicite : JPEG ne supporte pas la transparence.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Échec conversion JPEG");
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: "jpeg" };
}

function formatDateFr(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fmt(value: string | number | undefined | null, fallback = "À compléter"): string {
  if (value === undefined || value === null) return fallback;
  const s = String(value).trim();
  return s.length === 0 ? fallback : s;
}

function isMissing(value: string | number | undefined | null): boolean {
  if (value === undefined || value === null) return true;
  return String(value).trim().length === 0;
}

interface PageContext {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Draw a wrapped line of text constrained to maxWidth. Returns y after drawing. */
function drawText(
  ctx: PageContext,
  text: string,
  opts: {
    x: number;
    y: number;
    size: number;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  },
): void {
  const f = opts.bold ? ctx.fontBold : ctx.font;
  let str = text;
  if (opts.maxWidth) {
    while (str.length > 0 && f.widthOfTextAtSize(str, opts.size) > opts.maxWidth) {
      str = str.slice(0, -1);
    }
    if (str.length < text.length) str = `${str.slice(0, -1)}…`;
  }
  ctx.page.drawText(str, {
    x: opts.x,
    y: opts.y,
    size: opts.size,
    font: f,
    color: opts.color ?? TEXT,
  });
}

function drawRule(page: PDFPage, x1: number, y: number, x2: number) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 0.5,
    color: RULE,
  });
}

function drawHeader(ctx: PageContext, input: BatPdfInput) {
  const { page } = ctx;
  const top = PAGE_H - MARGIN;
  const version = input.version ?? 1;

  // Title row
  drawText(ctx, "BAT — Bon À Tirer", { x: MARGIN, y: top - 12, size: 14, bold: true });
  drawText(ctx, `Version ${version}`, {
    x: MARGIN + 130,
    y: top - 12,
    size: 9,
    bold: true,
    color: ACCENT,
  });

  const colW = (PAGE_W - MARGIN * 2) / 4;
  const rowY = top - 32;
  const rowY2 = top - 60;

  const cells: Array<[string, string]> = [
    ["Référence", input.reference],
    ["Client", input.clientName],
    ["Date", formatDateFr(input.date)],
    ["Quantité totale", `${input.totalQuantity} pcs`],
  ];
  cells.forEach(([label, value], i) => {
    const x = MARGIN + colW * i;
    drawText(ctx, label.toUpperCase(), { x, y: rowY, size: 7, color: MUTED });
    drawText(ctx, fmt(value), { x, y: rowY - 12, size: 10, bold: true, maxWidth: colW - 8 });
  });

  const cells2: Array<[string, string]> = [
    ["Modèle", input.fiche?.modelName ?? input.productLabel],
    ["Couleur", input.fiche?.colorLabel ?? input.color],
    ["Tailles commandées", input.sizesSummary || "—"],
    ["BAT N°", `${version}`],
  ];
  cells2.forEach(([label, value], i) => {
    const x = MARGIN + colW * i;
    drawText(ctx, label.toUpperCase(), { x, y: rowY2, size: 7, color: MUTED });
    drawText(ctx, truncate(fmt(value), 40), {
      x,
      y: rowY2 - 12,
      size: 10,
      bold: true,
      maxWidth: colW - 8,
    });
  });

  drawRule(page, MARGIN, PAGE_H - MARGIN - HEADER_H, PAGE_W - MARGIN);
}

/** Draws an entire two-column "Fiche produit / Fiche couleur" block.
 *  Returns the y coordinate just below the block. */
function drawFicheBlock(ctx: PageContext, input: BatPdfInput, top: number): number {
  const fiche = input.fiche ?? {};
  const colW = (PAGE_W - MARGIN * 2 - 16) / 2;
  const colA = MARGIN;
  const colB = MARGIN + colW + 16;
  const lineH = 11;

  // Column A — Fiche produit
  drawText(ctx, "FICHE PRODUIT", { x: colA, y: top, size: 8, bold: true, color: MUTED });
  let yA = top - 14;
  const rowsA: Array<[string, string | number | undefined]> = [
    ["Marque", fiche.brand],
    ["Modèle", fiche.modelName ?? input.productLabel],
    ["Référence", fiche.modelReference],
    ["SKU fournisseur", fiche.skuSupplier],
    ["Composition", fiche.fabricComposition],
    ["Grammage", fiche.fabricWeightGsm ? `${fiche.fabricWeightGsm} g/m²` : undefined],
    ["Coupe", fiche.fitType],
    ["Tailles dispo.", fiche.availableSizes],
  ];
  for (const [label, value] of rowsA) {
    drawText(ctx, label, { x: colA, y: yA, size: 8, color: MUTED });
    const missing = isMissing(value);
    drawText(ctx, fmt(value), {
      x: colA + 80,
      y: yA,
      size: 9,
      bold: !missing,
      color: missing ? WARN : TEXT,
      maxWidth: colW - 80,
    });
    yA -= lineH;
  }

  // Column B — Fiche couleur
  drawText(ctx, "FICHE COULEUR", { x: colB, y: top, size: 8, bold: true, color: MUTED });
  let yB = top - 14;

  // Color swatch
  if (fiche.hex) {
    try {
      const r = parseInt(fiche.hex.slice(1, 3), 16) / 255;
      const g = parseInt(fiche.hex.slice(3, 5), 16) / 255;
      const b = parseInt(fiche.hex.slice(5, 7), 16) / 255;
      ctx.page.drawRectangle({
        x: colB,
        y: yB - 18,
        width: 22,
        height: 22,
        color: rgb(r, g, b),
        borderColor: RULE,
        borderWidth: 0.5,
      });
    } catch {
      /* invalid hex — skip swatch */
    }
  }

  const rowsB: Array<[string, string | number | undefined]> = [
    ["Nom commercial", fiche.colorCommercialName],
    ["Libellé", fiche.colorLabel],
    ["Code fabricant", fiche.colorManufacturerCode],
    ["Pantone", fiche.pantone],
    ["HEX", fiche.hex],
    [
      "RGB",
      fiche.rgb ? `${fiche.rgb.r}, ${fiche.rgb.g}, ${fiche.rgb.b}` : undefined,
    ],
  ];
  // Offset to clear swatch
  yB -= 0;
  for (const [label, value] of rowsB) {
    drawText(ctx, label, { x: colB + 30, y: yB, size: 8, color: MUTED });
    const missing = isMissing(value);
    drawText(ctx, fmt(value), {
      x: colB + 110,
      y: yB,
      size: 9,
      bold: !missing,
      color: missing ? WARN : TEXT,
      maxWidth: colW - 110,
    });
    yB -= lineH;
  }

  const blockBottom = Math.min(yA, yB) - 4;
  drawRule(ctx.page, MARGIN, blockBottom, PAGE_W - MARGIN);
  return blockBottom - 6;
}

function drawWarnings(ctx: PageContext, warnings: string[], top: number): number {
  if (warnings.length === 0) return top;
  const padding = 8;
  const lineH = 10;
  const blockH = warnings.length * lineH + padding * 2 + 8;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: top - blockH,
    width: PAGE_W - MARGIN * 2,
    height: blockH,
    color: WARN_BG,
    borderColor: WARN,
    borderWidth: 0.5,
  });
  drawText(ctx, "⚠  Données fiche produit incomplètes", {
    x: MARGIN + padding,
    y: top - padding - 8,
    size: 9,
    bold: true,
    color: WARN,
  });
  let y = top - padding - 22;
  for (const w of warnings) {
    drawText(ctx, `· ${w}`, { x: MARGIN + padding + 4, y, size: 8, color: TEXT });
    y -= lineH;
  }
  return top - blockH - 6;
}

function drawSignatureZone(ctx: PageContext, input: BatPdfInput, bottomLimit: number): void {
  const blockH = 80;
  const top = bottomLimit + blockH;
  const w = PAGE_W - MARGIN * 2;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: bottomLimit,
    width: w,
    height: blockH,
    borderColor: ACCENT,
    borderWidth: 1.2,
  });
  drawText(ctx, "BON POUR ACCORD", {
    x: MARGIN + 12,
    y: top - 16,
    size: 11,
    bold: true,
    color: ACCENT,
  });
  drawText(
    ctx,
    "En signant ci-dessous, le client valide le visuel, les tailles, le placement et les caractéristiques techniques de cette commande.",
    { x: MARGIN + 12, y: top - 30, size: 7.5, color: MUTED, maxWidth: w - 24 },
  );

  // Two columns: client signature / DTF Matrix
  const colW = (w - 24) / 2;
  // Client column
  drawText(ctx, "Client — " + fmt(input.clientName), {
    x: MARGIN + 12,
    y: top - 50,
    size: 8,
    bold: true,
    maxWidth: colW,
  });
  drawText(ctx, "Date :", { x: MARGIN + 12, y: top - 64, size: 7.5, color: MUTED });
  drawText(ctx, "Signature :", { x: MARGIN + 12 + colW / 2, y: top - 64, size: 7.5, color: MUTED });

  // Producer column
  const colBx = MARGIN + 12 + colW;
  drawText(ctx, "DTF Matrix", { x: colBx, y: top - 50, size: 8, bold: true });
  drawText(ctx, `Référence : ${fmt(input.reference)}`, {
    x: colBx,
    y: top - 64,
    size: 7.5,
    color: MUTED,
  });
}

function drawFooter(ctx: PageContext, input: BatPdfInput, pageNum: number, total: number) {
  const { page } = ctx;
  drawRule(page, MARGIN, MARGIN + FOOTER_H, PAGE_W - MARGIN);
  const left = `${input.reference} · ${input.clientName} · v${input.version ?? 1}`;
  drawText(ctx, left, { x: MARGIN, y: MARGIN + 6, size: 8, color: MUTED });
  const right = `Page ${pageNum} / ${total}`;
  const w = ctx.font.widthOfTextAtSize(right, 8);
  drawText(ctx, right, { x: PAGE_W - MARGIN - w, y: MARGIN + 6, size: 8, color: MUTED });
}

/** Compute warnings from fiche fields that are blank. */
export function computeFicheWarnings(fiche: BatProductFiche, print?: BatPrintFiche): string[] {
  const w: string[] = [];
  if (isMissing(fiche.brand)) w.push("Marque fabricant à renseigner");
  if (isMissing(fiche.skuSupplier)) w.push("SKU fournisseur à renseigner");
  if (isMissing(fiche.fabricComposition)) w.push("Composition tissu à renseigner");
  if (isMissing(fiche.fabricWeightGsm)) w.push("Grammage (g/m²) à renseigner");
  if (isMissing(fiche.colorCommercialName)) w.push("Nom commercial couleur fabricant à renseigner");
  if (isMissing(fiche.colorManufacturerCode)) w.push("Code couleur fabricant à renseigner");
  if (isMissing(fiche.pantone)) w.push("Référence Pantone à renseigner");
  if (print) {
    if (isMissing(print.technique)) w.push("Technique d'impression à renseigner");
    if (isMissing(print.resolutionDpi)) w.push("Résolution du fichier source à renseigner");
  } else {
    w.push("Technique d'impression à renseigner");
  }
  return w;
}

export async function buildBatPdf(input: BatPdfInput): Promise<Blob> {
  if (input.views.length === 0) {
    throw new Error("Aucune vue à exporter");
  }
  const pdf = await PDFDocument.create();
  pdf.setTitle(`BAT ${input.reference} v${input.version ?? 1}`);
  pdf.setAuthor("DTF Matrix");
  pdf.setSubject(`Bon à Tirer — ${input.fiche?.modelName ?? input.productLabel} · ${input.fiche?.colorLabel ?? input.color}`);
  pdf.setCreationDate(input.date);

  const { font, fontBold } = await embedAppFonts(pdf);

  // ─── Cover page : fiche complète + signature ───
  const cover = pdf.addPage([PAGE_W, PAGE_H]);
  const coverCtx: PageContext = { page: cover, font, fontBold };
  drawHeader(coverCtx, input);

  let y = PAGE_H - MARGIN - HEADER_H - 8;
  y = drawFicheBlock(coverCtx, input, y);

  // Print metadata strip
  if (input.print) {
    const cells: Array<[string, string | number | undefined]> = [
      ["Technique", input.print.technique],
      ["Couleurs visuel", input.print.colorCount],
      ["Résolution", input.print.resolutionDpi ? `${input.print.resolutionDpi} dpi` : undefined],
      ["Profil colorimétrique", input.print.colorProfile],
    ];
    drawText(coverCtx, "FICHE IMPRESSION", { x: MARGIN, y, size: 8, bold: true, color: MUTED });
    y -= 14;
    const colW = (PAGE_W - MARGIN * 2) / 4;
    cells.forEach(([label, value], i) => {
      const x = MARGIN + colW * i;
      drawText(coverCtx, label, { x, y, size: 7, color: MUTED });
      const missing = isMissing(value);
      drawText(coverCtx, fmt(value), {
        x,
        y: y - 11,
        size: 9,
        bold: !missing,
        color: missing ? WARN : TEXT,
        maxWidth: colW - 8,
      });
    });
    y -= 28;
    drawRule(cover, MARGIN, y + 6, PAGE_W - MARGIN);
  }

  if (input.warnings && input.warnings.length > 0) {
    y = drawWarnings(coverCtx, input.warnings, y - 4);
  }

  // Signature zone anchored at bottom of cover page
  drawSignatureZone(coverCtx, input, MARGIN + FOOTER_H + 8);
  drawFooter(coverCtx, input, 1, input.views.length + 1);

  // ─── Visual pages : one per view ───
  const total = input.views.length + 1;
  for (let i = 0; i < input.views.length; i++) {
    const view = input.views[i];
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const ctx: PageContext = { page, font, fontBold };

    drawHeader(ctx, input);

    // View label + placement strip
    drawText(ctx, view.label.toUpperCase(), {
      x: MARGIN,
      y: PAGE_H - MARGIN - HEADER_H - 14,
      size: 9,
      bold: true,
      color: ACCENT,
    });
    const placementInfo = `Taille logo ${view.sizePct}%  ·  X ${view.posXPct}%  ·  Y ${view.posYPct}%`;
    const widthInfo = ctx.font.widthOfTextAtSize(placementInfo, 8);
    drawText(ctx, placementInfo, {
      x: PAGE_W - MARGIN - widthInfo,
      y: PAGE_H - MARGIN - HEADER_H - 14,
      size: 8,
      color: MUTED,
    });

    // Optimisation : PNG → JPEG q=0.85 + downscale à 1600 px max.
    // Réduit le poids du BAT par ~5x sans perte visible (cible WhatsApp < 3 Mo).
    const optimized = await optimizeMockupImage(view.composedPng);
    const img = await pdf.embedJpg(optimized.bytes);
    const areaTop = PAGE_H - MARGIN - HEADER_H - 28;
    const areaBottom = MARGIN + FOOTER_H + 8;
    const areaH = areaTop - areaBottom;
    const areaW = PAGE_W - MARGIN * 2;
    const aspect = img.width / img.height;
    let w = areaW;
    let h = w / aspect;
    if (h > areaH) {
      h = areaH;
      w = h * aspect;
    }
    const x = (PAGE_W - w) / 2;
    const yImg = areaBottom + (areaH - h) / 2;
    page.drawImage(img, { x, y: yImg, width: w, height: h });

    drawFooter(ctx, input, i + 2, total);
  }

  // Reflect total page count in cover footer (re-stamp via overpaint not needed —
  // the original `total` already accounts for cover + views).

  const bytes = await pdf.save({ useObjectStreams: true });
  // Copy into a fresh ArrayBuffer to satisfy strict Blob TS typings.
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return new Blob([buf], { type: "application/pdf" });
}

/** Use FICHE_H constant outside header to silence unused-import warnings. */
export const _PDF_LAYOUT = { PAGE_W, PAGE_H, HEADER_H, FICHE_H };
