// ============================================================
// New Order — polymorphic form domain types
// ============================================================

export type ClassicSecteur =
  | "DTF"
  | "Pressage"
  | "UV"
  | "Trotec"
  | "Goodies"
  | "Autres";

export type Secteur = ClassicSecteur | "Textiles";

export const ALL_SECTEURS: Secteur[] = [
  "DTF",
  "Textiles",
  "Pressage",
  "UV",
  "Trotec",
  "Goodies",
  "Autres",
];

export type OperatorValue = "L" | "C" | "M" | "A";
export type Target = "HOMME" | "FEMME" | "ENFANT";

// ───────── Header (stable across secteur switches) ─────────

export interface OrderHeader {
  clientId: string | null;
  clientNom: string;
  personneContact: string;
  telephone: string;
  assignedTo: OperatorValue | "";
  dateLivraison: string;
  isUrgent: boolean;
  notes: string;
}

// ───────── Classic line ─────────

export interface ClassicLine {
  kind: "classic";
  secteur: ClassicSecteur;
  produit: string;
  customProduit?: string;
  quantity: number;
  prixUnitaire: number;
  notes?: string;
  /** Sourcing spécial — article hors catalogue à sourcer auprès d'un
   *  fournisseur. Quand true, le prix unitaire est facultatif (renseigné
   *  ultérieurement par un manager) et la commande est créée en statut
   *  EN_ATTENTE_SOURCING. */
  isSourcingRequired?: boolean;
  /** Description détaillée des attentes du client (couleur, matière, taille,
   *  référence souhaitée, contraintes…). */
  sourcingDescription?: string;
  /** Budget indicatif côté client (TTC ou HT, à interpréter par l'équipe). */
  sourcingBudgetEstime?: number;
}

// ───────── Textile line ─────────

export type SupplierMockupView =
  | "front"
  | "back"
  | "sleeve_left"
  | "sleeve_right";

export interface SupplierMockupRef {
  view: SupplierMockupView;
  url: string;
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface TextileColor {
  id: string;
  label: string;
  hex: string;
  swatchBorder?: boolean;
  /** Nom commercial du fabricant (ex: "Bright Royal", "Heather Grey"). */
  commercialName?: string;
  /** Code couleur fournisseur (ex: "11", "G3"). */
  manufacturerCode?: string;
  /** Référence Pantone (ex: "Pantone 286 C"). */
  pantone?: string;
  /** Représentation RGB (calculée depuis hex si absente). */
  rgb?: { r: number; g: number; b: number };
  /** URL d'un mockup haute résolution rendu dans cette couleur (face avant). */
  mockupUrl?: string;
  /** Mockups fournisseur disponibles (un par vue) — utilisés pour l'auto-load
   *  des canvas du studio BAT à l'ouverture d'une couleur sans BAT validé. */
  supplierMockups?: SupplierMockupRef[];
}

export interface TextileSize {
  id: string;
  label: string;
  order: number;
}

export type BodyPlacement = "front" | "back";
export type SleevePlacement = "sleeve-left" | "sleeve-right";
/** Placement précis du logo — identifiant utilisé par le nouveau sélecteur single-select. */
export type PlacementId =
  | "front-center"
  | "front-pocket"
  | "sleeve-left"
  | "sleeve-right"
  | "back-center"
  | "back-upper";
/** Tout placement de logo possible — utilisé par la sélection cumulative. */
export type Placement = BodyPlacement | SleevePlacement;

export type FitType = "regular" | "slim" | "oversized" | "femme" | "enfant";
export type PrintTechnique = "DTF" | "Sérigraphie" | "Broderie" | "Flex" | "Sublimation";

export interface TextileModel {
  id: string;
  reference: string;
  name: string;
  target: Target;
  colors: TextileColor[];
  sizes: TextileSize[];
  pricingKey: string;
  /** Marque fabricant (ex: "Gildan", "Stanley/Stella"). */
  brand?: string;
  /** SKU fournisseur (ex: "STSU755", "G64000"). */
  skuSupplier?: string;
  /** Composition tissu (ex: "100% coton bio peigné"). */
  fabricComposition?: string;
  /** Grammage en g/m². */
  fabricWeightGsm?: number;
  /** Type de coupe. */
  fitType?: FitType;
  /** Techniques d'impression compatibles. */
  printTechniques?: PrintTechnique[];
}

export interface TextileItem {
  id: string;
  size: string;
  color: string;
  qty: number;
  /** qty "au hasard" pour devis rapide sans tailles précises */
  isPlaceholder?: boolean;
}

export interface MockupSide {
  mockupDataUrl: string | null;
  logoDataUrl: string | null;
  positionXPct: number;
  positionYPct: number;
  logoWidthPct: number;
}

export interface TextileDesign {
  front: MockupSide | null;
  back: MockupSide | null;
  sleeves: MockupSide | null;
  skipped: boolean;
  studioBatId?: string;
}

export interface BatDraftViewMeta {
  id: "front" | "back" | "sleeve_left" | "sleeve_right";
  label: string;
  sizePct: number;
  posXPct: number;
  posYPct: number;
  mockupFile: string;
  logoFile: string | null;
  /** Snapshot du mockup (dataUrl) — permet la réhydratation de l'éditeur. Optionnel pour rétrocompat. */
  mockupDataUrl?: string;
  mockupMime?: string;
  mockupNaturalWidth?: number;
  mockupNaturalHeight?: number;
  /** Snapshot du logo (dataUrl) — optionnel. */
  logoDataUrl?: string | null;
  logoMime?: string;
  logoNaturalWidth?: number;
  logoNaturalHeight?: number;
}

/** Métadonnées du marquage (technique, couleurs, résolution). */
export interface PrintMetadata {
  technique: PrintTechnique;
  colorCount?: number;
  /** DPI de la source logo, ex. 300. */
  resolutionDpi?: number;
  /** Profil colorimétrique (ex: "sRGB", "CMYK FOGRA39"). */
  colorProfile?: string;
}

export interface BatDraft {
  pdfBase64: string;
  pdfFileName: string;
  generatedAt: string;
  /** Numéro de version (1, 2, 3…). */
  version: number;
  /** Identifiant de la couleur ciblée (clé de TextileColor.id). */
  colorId: string;
  composition: {
    views: BatDraftViewMeta[];
    color: string;
    model: string;
    productLabel: string;
    sizesSummary: string;
    totalQuantity: number;
    /** Snapshot enrichi de la fiche produit/couleur au moment de la génération. */
    fiche?: {
      brand?: string;
      skuSupplier?: string;
      fabricComposition?: string;
      fabricWeightGsm?: number;
      fitType?: FitType;
      colorCommercialName?: string;
      colorManufacturerCode?: string;
      pantone?: string;
      hex?: string;
      rgb?: { r: number; g: number; b: number };
    };
    print?: PrintMetadata;
    /** Champs détectés comme manquants — affichés en avertissement dans le PDF. */
    warnings?: string[];
  };
}

/** Versions de BAT pour une couleur donnée. La dernière est la version active. */
export type BatDraftMap = Record<string, BatDraft[]>;

/** Référence vers un BAT existant réutilisé pour une nouvelle commande. */
export interface LinkedBatRef {
  /** UUID du BAT source côté backend. */
  batId: string;
  /** Référence de la commande d'origine (affichée dans la carte). */
  sourceOrderReference: string;
  /** Nom du client d'origine. */
  sourceClientName: string;
  /** URL publique du fichier (preview / téléchargement). */
  fileUrl: string;
  /** Type MIME / extension (pdf, png, jpg). */
  fileType: string;
  /** Date de création du BAT source (ISO). */
  createdAt: string;
  /** Date de validation du BAT source si APPROVED, null sinon. */
  decidedAt: string | null;
  /** Statut du BAT source. */
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  /** Version du BAT source (1, 2, 3…). */
  version: number;
  /** Combien d'orders utilisent ce BAT (badge "popularité"). */
  usageCount: number;
}

/** Map couleur → BAT existant réutilisé. */
export type LinkedBatMap = Record<string, LinkedBatRef>;

/** Mode global de la section BAT — par couleur ou pour toute la commande. */
export type BatMode = "new" | "reuse";

export interface TextileLine {
  kind: "textile";
  target: Target;
  modelId: string;
  modelName: string;
  /** Record keyé par TextileItem.id — O(1) updates, stable React keys */
  items: Record<string, TextileItem>;
  design: TextileDesign;
  /** Placement précis sélectionné dans le sélecteur single-select (nouveau modèle). */
  logoPlacement?: PlacementId;
  /** Placements corps déduits de logoPlacement — maintenus pour la tarification et l'API. */
  bodyPlacements: BodyPlacement[];
  sleeveLogoPlacements?: SleevePlacement[];
  notes?: string;
  /** PDF BAT principal (rétrocompatibilité — = dernière version de la 1ère couleur si batDrafts présent). */
  batDraft?: BatDraft | null;
  /** Versions de BAT par couleur. Chaque tableau est ordonné v1 → vN. */
  batDrafts?: BatDraftMap;
  /** Mode de gestion des BATs : "new" (créer) ou "reuse" (réutiliser un existant). */
  batMode?: BatMode;
  /** BATs existants réutilisés, mappés par couleur. */
  linkedBats?: LinkedBatMap;
  /** Si true, la commande est créée sans BAT validé (statut EN_ATTENTE_BAT). */
  deferBat?: boolean;
  /** Décision explicite de l'utilisateur sur la personnalisation de la
   *  référence : "with" = à personnaliser (BAT requis), "without" = sans
   *  perso (textile blanc, aucun marquage). `undefined` = pas encore tranché.
   *  Cette décision est ce qui débloque le passage à l'étape Livraison. */
  personalizationMode?: "with" | "without";
  /** Prix unitaire saisi manuellement par l'utilisateur sur l'étape « Demande »
   *  (devis rapide). S'il est défini, il prend le pas sur le prix calculé via
   *  les paliers + suppléments placements. Champ laissé vide = prix calculé. */
  prixUnitaireOverride?: number;
  /** Indique si la configuration du marquage (couleurs d'encres / fils) est
   *  identique pour toutes les couleurs d'articles. Quand `true` (défaut), le
   *  même calage machine couvre toute la production : on conserve le prix
   *  dégressif sur la quantité totale, sans frais additionnel. Quand `false`,
   *  chaque couleur d'article supplémentaire implique un arrêt machine, un
   *  nettoyage des cadres et un nouveau calage : un frais fixe de changement
   *  de couleur est ajouté par couleur additionnelle (et par placement). Sans
   *  effet quand une seule couleur est active. */
  hasIdenticalLogoSetup?: boolean;
}

// ───────── Union + draft ─────────

export type OrderLine = ClassicLine | TextileLine;

/** A line in the multi-reference draft. The id is a stable UUID generated
 *  client-side so React keys, drag & drop and BAT keying remain stable
 *  across edits. */
export interface OrderLineRecord {
  id: string;
  line: OrderLine;
}

export interface OrderDraft {
  header: OrderHeader;
  /** All references in the order. May be empty (the user hasn't picked any
   *  category yet). */
  lines: OrderLineRecord[];
  /** Id of the line currently expanded in the accordion. `null` means every
   *  line is collapsed (or the list is empty). */
  expandedLineId: string | null;
}

export const isTextileLine = (l: OrderLine): l is TextileLine =>
  l.kind === "textile";
export const isClassicLine = (l: OrderLine): l is ClassicLine =>
  l.kind === "classic";

// ───────── Pricing normalization ─────────

export interface NormalizedLine {
  pricingKey: string;
  totalQty: number;
  breakdown?: Array<{ label: string; qty: number }>;
}

export interface PricingTier {
  minQty: number;
  unitPrice: number;
}

export interface LineTotals {
  totalQty: number;
  unitPrice: number;
  /** Total final affiché à l'utilisateur = (unitPrice × totalQty) + colorChangeFee. */
  subtotal: number;
  /** Frais de calage appliqués lorsque le logo doit être adapté à chaque
   *  couleur d'article (= `hasIdenticalLogoSetup` à false avec ≥ 2 couleurs).
   *  Vaut 0 dans tous les autres cas. Permet d'afficher un breakdown propre. */
  colorChangeFee: number;
  /** Nombre de couleurs distinctes ayant au moins une pièce — utilisé pour
   *  expliquer le calcul du frais de changement de couleur dans l'UI. */
  distinctColorCount: number;
  appliedTier: PricingTier | null;
  nextTier: PricingTier | null;
  unitsToNextTier: number | null;
}

// ───────── Validation ─────────

export type FieldErrorKey =
  | keyof OrderHeader
  | "secteur"
  | "line"
  | "personalizationMode";

export interface ValidationResult {
  ok: boolean;
  fieldErrors: Partial<Record<FieldErrorKey, string>>;
}
