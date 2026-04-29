/**
 * Table de correspondance centralisée nom de couleur → code hexadécimal.
 *
 * Source de vérité pour le rendu visuel des swatches dans toute l'application.
 * Utilisée comme fallback quand un fournisseur ne livre pas le `hex` dans son
 * DTO (cf. `supplierAdapter.adaptColor`) — évite l'affichage d'un gris générique
 * qui ne correspond pas à la couleur réelle.
 *
 * Les clés sont normalisées (lowercase, sans accents) ; on accepte aussi bien
 * les libellés français que les slugs/codes fournisseur courants.
 *
 * Compléter cette table au fil des nouveaux fournisseurs catalogués.
 */

export const COLOR_HEX_MAP: Record<string, string> = {
  // ── Neutres ─────────────────────────────────────────────────
  blanc: "#FFFFFF",
  white: "#FFFFFF",
  ecru: "#F5EBDD",
  ivoire: "#FFFFF0",
  ivory: "#FFFFF0",
  sable: "#D6CFC4",
  sand: "#D6CFC4",
  beige: "#E5D9C3",
  creme: "#F5F0E1",
  cream: "#F5F0E1",
  noir: "#0F172A",
  black: "#0F172A",
  charbon: "#1F2937",
  charcoal: "#1F2937",
  anthracite: "#374151",
  graphite: "#404754",
  "gris fonce": "#4B5563",
  "dark grey": "#4B5563",
  "dark gray": "#4B5563",
  gris: "#9CA3AF",
  grey: "#9CA3AF",
  gray: "#9CA3AF",
  "gris chine": "#9CA3AF",
  "heather grey": "#A0A6AD",
  "heather gray": "#A0A6AD",
  "gris clair": "#D1D5DB",
  "light grey": "#D1D5DB",
  "light gray": "#D1D5DB",
  argent: "#C0C0C0",
  silver: "#C0C0C0",

  // ── Bleus ───────────────────────────────────────────────────
  marine: "#1E3A8A",
  navy: "#1E3A8A",
  "bleu marine": "#1E3A8A",
  bleu: "#2563EB",
  blue: "#2563EB",
  royal: "#2563EB",
  "bleu royal": "#2563EB",
  "bright royal": "#1E40AF",
  "bleu roi": "#1D4ED8",
  azur: "#3B82F6",
  ciel: "#7DD3FC",
  "bleu ciel": "#7DD3FC",
  "sky blue": "#7DD3FC",
  turquoise: "#14B8A6",
  cyan: "#06B6D4",
  petrole: "#0E7490",
  teal: "#0F766E",
  denim: "#3B5577",
  "denim blue": "#3B5577",
  indigo: "#4338CA",

  // ── Verts ───────────────────────────────────────────────────
  vert: "#16A34A",
  green: "#16A34A",
  foret: "#166534",
  forest: "#166534",
  bouteille: "#14532D",
  "bottle green": "#14532D",
  emeraude: "#10B981",
  emerald: "#10B981",
  kaki: "#65803F",
  khaki: "#65803F",
  olive: "#556B2F",
  menthe: "#6EE7B7",
  mint: "#6EE7B7",
  "vert clair": "#86EFAC",
  "light green": "#86EFAC",
  lime: "#A3E635",

  // ── Rouges / orangés ───────────────────────────────────────
  rouge: "#DC2626",
  red: "#DC2626",
  bordeaux: "#7F1D1D",
  burgundy: "#7F1D1D",
  cerise: "#BE123C",
  cherry: "#BE123C",
  corail: "#FB7185",
  coral: "#FB7185",
  rose: "#F472B6",
  pink: "#F472B6",
  fuchsia: "#D946EF",
  magenta: "#C026D3",
  saumon: "#FCA5A5",
  salmon: "#FCA5A5",
  orange: "#F97316",
  abricot: "#FDBA74",
  apricot: "#FDBA74",
  peche: "#FED7AA",
  peach: "#FED7AA",
  brique: "#B91C1C",
  brick: "#B91C1C",
  terracotta: "#C2410C",

  // ── Jaunes ──────────────────────────────────────────────────
  jaune: "#FACC15",
  yellow: "#FACC15",
  citron: "#FDE047",
  lemon: "#FDE047",
  moutarde: "#CA8A04",
  mustard: "#CA8A04",
  or: "#D4A017",
  gold: "#D4A017",

  // ── Violets / parmes ───────────────────────────────────────
  violet: "#7C3AED",
  purple: "#7C3AED",
  pourpre: "#6B21A8",
  parme: "#A78BFA",
  lavande: "#C4B5FD",
  lavender: "#C4B5FD",
  lilas: "#DDD6FE",
  lilac: "#DDD6FE",

  // ── Marrons ─────────────────────────────────────────────────
  marron: "#78350F",
  brown: "#78350F",
  chocolat: "#5C3317",
  chocolate: "#5C3317",
  caramel: "#A77043",
  cafe: "#6F4E37",
  coffee: "#6F4E37",
  taupe: "#8B7E6E",
};

const ACCENTS_REGEX = /[̀-ͯ]/g;

function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(ACCENTS_REGEX, "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Résout le code hex correspondant à un libellé / slug / nom commercial de
 * couleur. Renvoie `undefined` si aucune entrée n'est connue — le caller
 * décide alors de la stratégie (placeholder, exception, etc.).
 *
 * Stratégie de résolution (premier match gagne) :
 *   1. Match exact sur la clé normalisée.
 *   2. Match « le label contient une clé » (ex: "Marine foncé" → "marine").
 *   3. Match « une clé contient le label » (cas inverse, fallback large).
 */
export function resolveColorHex(...candidates: Array<string | null | undefined>): string | undefined {
  for (const raw of candidates) {
    if (!raw) continue;
    const key = normalizeKey(raw);
    if (!key) continue;
    if (COLOR_HEX_MAP[key]) return COLOR_HEX_MAP[key];
    for (const k of Object.keys(COLOR_HEX_MAP)) {
      if (key.includes(k) || k.includes(key)) return COLOR_HEX_MAP[k];
    }
  }
  return undefined;
}

/** Placeholder neutre quand aucun hex n'a pu être déterminé. */
export const COLOR_FALLBACK_HEX = "#CCCCCC";
