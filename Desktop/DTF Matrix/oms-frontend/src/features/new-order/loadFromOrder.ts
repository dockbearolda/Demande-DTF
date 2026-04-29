import type {
  Order,
  OrderLine as ApiOrderLine,
  OrderLineVariant as ApiOrderLineVariant,
  Secteur as ApiSecteur,
} from "@/lib/types";
import { getTextileModel } from "./runtimeCatalog";
import type {
  BodyPlacement,
  ClassicLine,
  ClassicSecteur,
  OrderLineRecord,
  PlacementId,
  SleevePlacement,
  Target,
  TextileItem,
  TextileLine,
} from "./types";

const SECTEUR_API_TO_FORM: Record<ApiSecteur, ClassicSecteur> = {
  DTF: "DTF",
  PRESSAGE: "Pressage",
  UV: "UV",
  TROTEC: "Trotec",
  GOODIES: "Goodies",
  AUTRES: "Autres",
};

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function isTextileApiLine(line: ApiOrderLine): boolean {
  if (line.product_type === "TSHIRT" || line.product_type === "SWEAT" ||
      line.product_type === "HOODIE" || line.product_type === "POLO") {
    return true;
  }
  const opts = line.options ?? null;
  return !!opts && typeof opts === "object" && "model_id" in opts;
}

function buildTextileLine(line: ApiOrderLine): TextileLine | null {
  const opts = (line.options ?? {}) as Record<string, unknown>;
  const modelId = typeof opts.model_id === "string" ? opts.model_id : null;
  if (!modelId) return null;

  const target = (typeof opts.target === "string" ? opts.target : "HOMME") as Target;
  const bodyPlacements = Array.isArray(opts.body_placements)
    ? (opts.body_placements as BodyPlacement[])
    : ["front" as BodyPlacement];
  const sleevePlacements = Array.isArray(opts.sleeve_placements)
    ? (opts.sleeve_placements as SleevePlacement[])
    : [];

  const model = getTextileModel(modelId);
  const modelName = model?.name ?? line.produit ?? "Textile";

  const items: Record<string, TextileItem> = {};
  const variants = line.variants ?? [];
  variants.forEach((v: ApiOrderLineVariant) => {
    if (v.qty <= 0) return;
    const isPlaceholder = !v.color || !v.size;
    if (isPlaceholder) {
      const id = genId();
      items[id] = {
        id,
        size: v.size ?? "__ANY__",
        color: v.color ?? "__ANY__",
        qty: v.qty,
        isPlaceholder: true,
      };
    } else {
      const id = `${v.color}__${v.size}`;
      items[id] = {
        id,
        size: v.size as string,
        color: v.color as string,
        qty: v.qty,
      };
    }
  });

  let logoPlacement: PlacementId = "front-center";
  if (bodyPlacements.includes("back")) logoPlacement = "back-center";
  else if (sleevePlacements.includes("sleeve-left")) logoPlacement = "sleeve-left";
  else if (sleevePlacements.includes("sleeve-right")) logoPlacement = "sleeve-right";

  return {
    kind: "textile",
    target,
    modelId,
    modelName,
    items,
    design: { front: null, back: null, sleeves: null, skipped: false },
    logoPlacement,
    bodyPlacements,
    sleeveLogoPlacements: sleevePlacements,
    hasIdenticalLogoSetup: true,
  };
}

function buildClassicLine(line: ApiOrderLine): ClassicLine {
  const secteur = SECTEUR_API_TO_FORM[line.secteur] ?? "Autres";
  const quantity = line.quantite || 0;
  const prixUnitaire = Number.parseFloat(line.prix_unitaire ?? "0") || 0;
  const isSourcing = !!line.is_sourcing_required;
  const out: ClassicLine = {
    kind: "classic",
    secteur,
    produit: line.produit ?? "",
    quantity,
    prixUnitaire,
  };
  if (isSourcing) {
    out.isSourcingRequired = true;
    out.secteur = "Autres";
    if (line.sourcing_description) out.sourcingDescription = line.sourcing_description;
    if (line.sourcing_budget_estime) {
      const budget = Number.parseFloat(line.sourcing_budget_estime);
      if (!Number.isNaN(budget)) out.sourcingBudgetEstime = budget;
    }
  }
  return out;
}

/**
 * Reconstruct draft `OrderLineRecord[]` from a previously-saved order. The
 * shape of `Order.lines` matches the backend response (`OrderRead`) — variants
 * carry the (color × size × qty) breakdown, options carry the textile model
 * metadata. Lines that fail to round-trip (missing model id, no variants) are
 * skipped silently so the caller still gets a partial pre-fill.
 */
export function buildRecordsFromOrder(order: Order): OrderLineRecord[] {
  const lines = order.lines ?? [];
  const records: OrderLineRecord[] = [];
  for (const apiLine of lines) {
    if (isTextileApiLine(apiLine)) {
      const tl = buildTextileLine(apiLine);
      if (tl && Object.keys(tl.items).length > 0) {
        records.push({ id: genId(), line: tl });
      }
      continue;
    }
    const cl = buildClassicLine(apiLine);
    if (cl.produit && cl.quantity > 0) {
      records.push({ id: genId(), line: cl });
    } else if (cl.isSourcingRequired && cl.sourcingDescription) {
      records.push({ id: genId(), line: cl });
    }
  }
  return records;
}

/** Build a per-line summary "X réfs / Y articles" for the resume cards. */
export function summarizeOrderLines(order: Order): {
  refsCount: number;
  totalQty: number;
} {
  const lines = order.lines ?? [];
  let refsCount = 0;
  let totalQty = 0;
  for (const line of lines) {
    refsCount += 1;
    totalQty += line.quantite ?? 0;
  }
  return { refsCount, totalQty };
}
