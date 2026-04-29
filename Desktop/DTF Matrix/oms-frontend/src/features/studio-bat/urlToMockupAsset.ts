import type { MockupAsset } from "./types";

/**
 * Cache mémoire URL → MockupAsset. Le studio rouvre fréquemment la même
 * couleur (navigation [/]) ; convertir une seule fois suffit pour la durée de
 * la session. La carte est volontairement non bornée — un mockup haute-déf
 * pèse ~1-3 Mo en dataUrl, et l'utilisateur travaille rarement sur plus de
 * 10-20 couleurs par session.
 */
const cache = new Map<string, MockupAsset>();

function fileNameFromUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    const last = u.pathname.split("/").pop();
    return last && last.length > 0 ? last : "mockup";
  } catch {
    return "mockup";
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

function imageDimensions(
  dataUrl: string,
): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = dataUrl;
  });
}

/**
 * Fetch une URL de mockup fournisseur et la convertit en `MockupAsset` prêt à
 * être injecté dans le studio store. Memoïsé en mémoire process-wide.
 *
 * `hintWidth/hintHeight` (issus du DTO) évitent un decode sync supplémentaire
 * quand le backend les a déjà.
 */
export async function urlToMockupAsset(
  url: string,
  hintWidth?: number,
  hintHeight?: number,
): Promise<MockupAsset> {
  const cached = cache.get(url);
  if (cached) return cached;
  // `cache: "reload"` contourne un piège classique : si la même URL a été
  // chargée auparavant par un `<img>` sans `crossOrigin="anonymous"` (typique
  // d'une vignette dans un picker), l'entrée HTTP est cachée sans les en-têtes
  // CORS et un `fetch()` ultérieur échoue avec "TypeError: Failed to fetch".
  // Forcer un revalidation skip le cache opaque.
  const res = await fetch(url, { credentials: "omit", cache: "reload" });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  const blob = await res.blob();
  const dataUrl = await blobToDataUrl(blob);
  const dims =
    hintWidth && hintHeight
      ? { naturalWidth: hintWidth, naturalHeight: hintHeight }
      : await imageDimensions(dataUrl);
  const asset: MockupAsset = {
    dataUrl,
    mime: blob.type || "image/png",
    name: fileNameFromUrl(url),
    naturalWidth: dims.naturalWidth,
    naturalHeight: dims.naturalHeight,
  };
  cache.set(url, asset);
  return asset;
}
