import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { FlashQuoteClient, FlashQuoteLine, DiscountMode } from "../store";
import { computeTotals, PLACEMENT_LABELS } from "../store";

// Default brand info — can be overridden via window.__OMS_BRAND if needed.
export const DEFAULT_BRAND = {
  name: "DTF Matrix",
  baseline: "Impression textile · DTF · UV · Sérigraphie",
  address: "",
  phone: "",
  email: "",
  siret: "",
  iban: "",
  website: "",
};

export interface QuotePdfInput {
  quoteNumber: string;
  emittedAt: string;
  validUntil: string;
  client: FlashQuoteClient;
  lines: FlashQuoteLine[];
  discount: { mode: DiscountMode; value: number };
  vatRate: number;
  notes: string;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 48;
const ACCENT = rgb(0.29, 0.38, 0.45); // accent-500 #4A6274
const INK_900 = rgb(0.06, 0.08, 0.09);
const INK_700 = rgb(0.18, 0.23, 0.27);
const INK_500 = rgb(0.42, 0.5, 0.57);
const INK_200 = rgb(0.86, 0.89, 0.91);
const INK_100 = rgb(0.92, 0.92, 0.91);
const INK_50 = rgb(0.96, 0.96, 0.95);

interface DrawCtx {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  cursorY: number;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}

function newPage(ctx: DrawCtx): void {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.cursorY = PAGE_H - MARGIN_X;
}

function ensureSpace(ctx: DrawCtx, needed: number): void {
  if (ctx.cursorY - needed < MARGIN_X + 80) newPage(ctx);
}

function drawText(
  ctx: DrawCtx,
  text: string,
  x: number,
  y: number,
  size: number,
  opts?: { font?: PDFFont; color?: ReturnType<typeof rgb> },
): void {
  ctx.page.drawText(text, {
    x,
    y,
    size,
    font: opts?.font ?? ctx.font,
    color: opts?.color ?? INK_700,
  });
}

function drawHeader(ctx: DrawCtx, brand: typeof DEFAULT_BRAND, input: QuotePdfInput): void {
  const top = PAGE_H - MARGIN_X;

  // Brand block (left)
  drawText(ctx, brand.name, MARGIN_X, top, 18, { font: ctx.fontBold, color: INK_900 });
  drawText(ctx, brand.baseline, MARGIN_X, top - 18, 9, { color: INK_500 });
  let by = top - 38;
  for (const line of [brand.address, brand.phone, brand.email, brand.website].filter(Boolean)) {
    drawText(ctx, line, MARGIN_X, by, 8.5, { color: INK_500 });
    by -= 11;
  }

  // Quote meta (right) — outlined card
  const cardW = 200;
  const cardX = PAGE_W - MARGIN_X - cardW;
  const cardY = top - 90;
  const cardH = 90;
  ctx.page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    borderColor: INK_200,
    borderWidth: 0.6,
    color: INK_50,
  });
  drawText(ctx, "DEVIS", cardX + 14, cardY + cardH - 18, 11, {
    font: ctx.fontBold,
    color: ACCENT,
  });
  drawText(ctx, input.quoteNumber, cardX + 14, cardY + cardH - 36, 14, {
    font: ctx.fontBold,
    color: INK_900,
  });
  drawText(ctx, "Émis le", cardX + 14, cardY + cardH - 56, 8, { color: INK_500 });
  drawText(ctx, fmtDate(input.emittedAt), cardX + 14, cardY + cardH - 68, 9.5, {
    font: ctx.fontBold,
    color: INK_700,
  });
  drawText(ctx, "Validité", cardX + 110, cardY + cardH - 56, 8, { color: INK_500 });
  drawText(ctx, fmtDate(input.validUntil), cardX + 110, cardY + cardH - 68, 9.5, {
    font: ctx.fontBold,
    color: INK_700,
  });

  ctx.cursorY = top - 110;
}

function drawClientBlock(ctx: DrawCtx, client: FlashQuoteClient): void {
  ensureSpace(ctx, 90);
  const y = ctx.cursorY;
  drawText(ctx, "ADRESSÉ À", MARGIN_X, y, 8.5, { font: ctx.fontBold, color: INK_500 });
  let cy = y - 16;
  drawText(ctx, client.nom || "—", MARGIN_X, cy, 12, {
    font: ctx.fontBold,
    color: INK_900,
  });
  cy -= 16;
  for (const line of [client.adresse, client.email, client.telephone].filter(Boolean)) {
    drawText(ctx, line, MARGIN_X, cy, 9.5, { color: INK_700 });
    cy -= 12;
  }
  ctx.cursorY = cy - 18;
}

function drawTable(ctx: DrawCtx, lines: FlashQuoteLine[]): void {
  const x0 = MARGIN_X;
  const xRight = PAGE_W - MARGIN_X;
  const colRefW = 80;
  const colDesigW = 240;
  const colQtyW = 50;

  ensureSpace(ctx, 60);
  // Table header band
  const headY = ctx.cursorY;
  ctx.page.drawRectangle({
    x: x0,
    y: headY - 22,
    width: xRight - x0,
    height: 22,
    color: INK_900,
  });
  const hcy = headY - 16;
  drawText(ctx, "RÉFÉRENCE", x0 + 10, hcy, 8.5, {
    font: ctx.fontBold,
    color: rgb(1, 1, 1),
  });
  drawText(ctx, "DÉSIGNATION", x0 + colRefW + 10, hcy, 8.5, {
    font: ctx.fontBold,
    color: rgb(1, 1, 1),
  });
  drawText(ctx, "QTÉ", x0 + colRefW + colDesigW + 10, hcy, 8.5, {
    font: ctx.fontBold,
    color: rgb(1, 1, 1),
  });
  drawText(ctx, "PU HT", x0 + colRefW + colDesigW + colQtyW + 10, hcy, 8.5, {
    font: ctx.fontBold,
    color: rgb(1, 1, 1),
  });
  // Right-aligned "TOTAL HT" header
  const totalLabel = "TOTAL HT";
  const totalLabelW = ctx.fontBold.widthOfTextAtSize(totalLabel, 8.5);
  drawText(ctx, totalLabel, xRight - totalLabelW - 10, hcy, 8.5, {
    font: ctx.fontBold,
    color: rgb(1, 1, 1),
  });

  ctx.cursorY = headY - 22;

  // Rows
  lines.forEach((l, idx) => {
    const hasPlacement = !!l.placement;
    const rowH = hasPlacement ? 32 : 22;
    ensureSpace(ctx, rowH);
    const ry = ctx.cursorY;
    if (idx % 2 === 0) {
      ctx.page.drawRectangle({
        x: x0,
        y: ry - rowH,
        width: xRight - x0,
        height: rowH,
        color: INK_50,
      });
    }
    const cy = hasPlacement ? ry - 11 : ry - 15;
    drawText(ctx, l.reference, x0 + 10, cy, 9, { color: INK_900, font: ctx.fontBold });
    const maxDesigChars = 48;
    const designation =
      l.designation.length > maxDesigChars
        ? l.designation.slice(0, maxDesigChars - 1) + "…"
        : l.designation;
    drawText(ctx, designation, x0 + colRefW + 10, cy, 9, { color: INK_700 });
    drawText(ctx, String(l.quantite), x0 + colRefW + colDesigW + 10, cy, 9, {
      color: INK_700,
    });
    drawText(ctx, fmtMoney(l.prixUnitaire), x0 + colRefW + colDesigW + colQtyW + 10, cy, 9, {
      color: INK_700,
    });
    const total = fmtMoney(l.prixUnitaire * l.quantite);
    const totalW = ctx.fontBold.widthOfTextAtSize(total, 9);
    drawText(ctx, total, xRight - totalW - 10, cy, 9, {
      font: ctx.fontBold,
      color: INK_900,
    });
    if (hasPlacement) {
      const placementLabel = PLACEMENT_LABELS[l.placement!];
      drawText(ctx, `Placement : ${placementLabel}`, x0 + colRefW + 10, cy - 12, 7.5, {
        color: INK_500,
      });
    }
    ctx.cursorY = ry - rowH;
  });

  // Bottom border
  ctx.page.drawLine({
    start: { x: x0, y: ctx.cursorY },
    end: { x: xRight, y: ctx.cursorY },
    thickness: 0.6,
    color: INK_200,
  });
  ctx.cursorY -= 16;
}

function drawTotals(ctx: DrawCtx, input: QuotePdfInput): void {
  const totals = computeTotals({
    lines: input.lines,
    discount: input.discount,
    vatRate: input.vatRate,
  });

  ensureSpace(ctx, 140);
  const xRight = PAGE_W - MARGIN_X;
  const boxW = 240;
  const boxX = xRight - boxW;
  let y = ctx.cursorY;

  const drawRow = (label: string, value: string, opts?: { bold?: boolean }) => {
    drawText(ctx, label, boxX + 10, y - 14, 9.5, {
      color: opts?.bold ? INK_900 : INK_500,
      font: opts?.bold ? ctx.fontBold : ctx.font,
    });
    const valW = ctx.fontBold.widthOfTextAtSize(value, 9.5);
    drawText(ctx, value, boxX + boxW - valW - 10, y - 14, 9.5, {
      font: ctx.fontBold,
      color: INK_900,
    });
    y -= 22;
  };

  drawRow("Sous-total HT", fmtMoney(totals.subtotalHT));
  if (totals.discountAmount > 0) {
    const label =
      input.discount.mode === "percent"
        ? `Remise (${input.discount.value}%)`
        : "Remise";
    drawRow(label, "- " + fmtMoney(totals.discountAmount));
  }
  drawRow("Total HT", fmtMoney(totals.totalHT), { bold: true });
  drawRow(`TGCA (${input.vatRate}%)`, fmtMoney(totals.vatAmount));

  // TTC band
  const bandH = 36;
  ctx.page.drawRectangle({
    x: boxX,
    y: y - bandH + 8,
    width: boxW,
    height: bandH,
    color: ACCENT,
  });
  drawText(ctx, "TOTAL TTC", boxX + 12, y - 12, 11, {
    font: ctx.fontBold,
    color: rgb(1, 1, 1),
  });
  const ttcStr = fmtMoney(totals.totalTTC);
  const ttcW = ctx.fontBold.widthOfTextAtSize(ttcStr, 13);
  drawText(ctx, ttcStr, boxX + boxW - ttcW - 12, y - 14, 13, {
    font: ctx.fontBold,
    color: rgb(1, 1, 1),
  });
  y -= bandH + 4;

  ctx.cursorY = y - 8;
}

function drawNotesAndSignature(ctx: DrawCtx, notes: string): void {
  ensureSpace(ctx, 140);
  const xRight = PAGE_W - MARGIN_X;
  const x0 = MARGIN_X;

  if (notes.trim()) {
    drawText(ctx, "NOTES", x0, ctx.cursorY, 8.5, {
      font: ctx.fontBold,
      color: INK_500,
    });
    ctx.cursorY -= 14;
    // Naive line wrap
    const maxW = xRight - x0;
    const words = notes.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.font.widthOfTextAtSize(test, 9) > maxW) {
        drawText(ctx, line, x0, ctx.cursorY, 9, { color: INK_700 });
        ctx.cursorY -= 12;
        line = w;
      } else {
        line = test;
      }
    }
    if (line) {
      drawText(ctx, line, x0, ctx.cursorY, 9, { color: INK_700 });
      ctx.cursorY -= 14;
    }
  }

  // Signature card "Bon pour accord"
  ensureSpace(ctx, 110);
  const cardY = ctx.cursorY - 90;
  ctx.page.drawRectangle({
    x: x0,
    y: cardY,
    width: 240,
    height: 90,
    borderColor: INK_200,
    borderWidth: 0.6,
    color: INK_50,
  });
  drawText(ctx, "BON POUR ACCORD", x0 + 12, cardY + 90 - 16, 8.5, {
    font: ctx.fontBold,
    color: ACCENT,
  });
  drawText(ctx, "Date · Signature précédée de la mention", x0 + 12, cardY + 90 - 30, 8, {
    color: INK_500,
  });
  drawText(ctx, "« Bon pour accord »", x0 + 12, cardY + 90 - 42, 8, { color: INK_500 });

  ctx.cursorY = cardY - 16;
}

function drawFooter(ctx: DrawCtx, brand: typeof DEFAULT_BRAND): void {
  const pages = ctx.doc.getPages();
  pages.forEach((p, idx) => {
    const footerY = MARGIN_X - 8;
    p.drawLine({
      start: { x: MARGIN_X, y: footerY + 16 },
      end: { x: PAGE_W - MARGIN_X, y: footerY + 16 },
      thickness: 0.4,
      color: INK_100,
    });
    const footerLine = [
      brand.name,
      brand.siret ? `SIRET ${brand.siret}` : null,
      brand.iban ? `IBAN ${brand.iban}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    p.drawText(
      footerLine ||
        "Devis non contractuel — sous réserve de validation finale et de disponibilité des produits.",
      {
        x: MARGIN_X,
        y: footerY,
        size: 7.5,
        font: ctx.font,
        color: INK_500,
      },
    );
    const pn = `Page ${idx + 1} / ${pages.length}`;
    const pnW = ctx.font.widthOfTextAtSize(pn, 7.5);
    p.drawText(pn, {
      x: PAGE_W - MARGIN_X - pnW,
      y: footerY,
      size: 7.5,
      font: ctx.font,
      color: INK_500,
    });
  });
}

export async function generateQuotePdf(
  input: QuotePdfInput,
  brand: typeof DEFAULT_BRAND = DEFAULT_BRAND,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);

  const ctx: DrawCtx = { doc, page, font, fontBold, cursorY: PAGE_H - MARGIN_X };

  drawHeader(ctx, brand, input);
  drawClientBlock(ctx, input.client);
  drawTable(ctx, input.lines);
  drawTotals(ctx, input);
  drawNotesAndSignature(ctx, input.notes);
  drawFooter(ctx, brand);

  return doc.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([ab], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
