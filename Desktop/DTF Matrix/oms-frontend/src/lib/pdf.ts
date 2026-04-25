import * as pdfjsLib from "pdfjs-dist";
// Vite URL-import: bundler rewrites to a served asset path at build time.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Rasterizes the first page of a PDF into a PNG data-URL suitable for
 * <img>/canvas pipelines. Scaled so output width ≈ targetWidth px (≥ native).
 */
export async function pdfFirstPageToDataURL(
  file: File | Blob,
  targetWidth = 2000,
): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(1, targetWidth / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return canvas.toDataURL("image/png");
  } finally {
    await pdf.destroy();
  }
}
