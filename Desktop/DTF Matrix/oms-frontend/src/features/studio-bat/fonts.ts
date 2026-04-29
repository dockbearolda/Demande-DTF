import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

import interRegularUrl from "../../assets/fonts/Inter-Regular.ttf?url";
import interBoldUrl from "../../assets/fonts/Inter-Bold.ttf?url";

let bytesCache: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function loadBytes(): Promise<NonNullable<typeof bytesCache>> {
  if (bytesCache) return bytesCache;
  const [r, b] = await Promise.all([
    fetch(interRegularUrl).then((res) => res.arrayBuffer()),
    fetch(interBoldUrl).then((res) => res.arrayBuffer()),
  ]);
  bytesCache = { regular: new Uint8Array(r), bold: new Uint8Array(b) };
  return bytesCache;
}

/**
 * Embarque Inter Regular + Bold en Identity-H avec subsetting.
 * Identity-H : support Unicode complet (résout le bug WinAnsi sur ⚠, →, etc.).
 * subset:true : seuls les glyphes utilisés sont inclus dans le PDF final.
 */
export async function embedAppFonts(pdf: PDFDocument): Promise<{
  font: PDFFont;
  fontBold: PDFFont;
}> {
  pdf.registerFontkit(fontkit);
  const { regular, bold } = await loadBytes();
  const [font, fontBold] = await Promise.all([
    pdf.embedFont(regular, { subset: true }),
    pdf.embedFont(bold, { subset: true }),
  ]);
  return { font, fontBold };
}
