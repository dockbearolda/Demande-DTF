import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { useOrder } from "@/hooks/useOrders";
import { useUploadBat } from "@/hooks/useBats";
import { useToast } from "@/components/Toast";
import {
  getTextileModel,
  isTextileLine,
  selectHeader,
  selectLine,
  useNewOrderStore,
  type BatDraft,
  type BatDraftViewMeta,
  type TextileColor,
  type TextileModel,
} from "@/features/new-order";
import { CanvasStage } from "./components/CanvasStage";
import { TopBar } from "./components/TopBar";
import { ViewTabs } from "./components/ViewTabs";
import { useStudioStore } from "./store";
import {
  VIEW_LABELS,
  VIEW_ORDER,
  type MockupAsset,
  type ViewId,
  type ViewState,
} from "./types";
import { urlToMockupAsset } from "./urlToMockupAsset";
import {
  buildBatPdf,
  computeFicheWarnings,
  formatBatFilename,
  parseMockupSku,
  type BatPdfView,
  type BatProductFiche,
  type BatPrintFiche,
} from "./pdf";

interface StudioBatStudioProps {
  orderId: string | undefined;
  backTo: string;
  preview?: {
    reference: string;
    clientName: string;
  };
  /** Identifiant de la couleur ciblée — utilisé en mode preview pour générer un BAT par couleur. */
  colorId?: string;
  /**
   * Callback appelé après une validation réussie en mode preview.
   * Si fourni, remplace le navigate(backTo) par défaut (utilisé par le drawer).
   */
  onAfterValidate?: () => void;
  /** Notifie le parent que l'éditeur a été modifié depuis la dernière validation. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Si fourni, le studio assigne sa fonction de validation à ref.current — utile pour les raccourcis externes. */
  validateRef?: { current: (() => void) | null };
  /** Si fourni, le studio expose des actions internes (duplication multi-cible…)
   *  utilisables par le wrapper drawer. */
  actionsRef?: {
    current: {
      /** Capture le state courant du studio et crée un BatDraft v(N+1) pour
       *  chaque couleur cible. Retourne le nombre de cibles traitées avec succès. */
      duplicateToColors: (targetColorIds: string[]) => Promise<number>;
    } | null;
  };
  /** Masque la TopBar interne (utile en mode drawer où le wrapper a son propre header). */
  hideTopBar?: boolean;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | undefined {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Compose une vue (mockup t-shirt + logo) en PNG haute déf.
 *
 * `mockupOverride` permet de remplacer **uniquement** l'image du t-shirt
 * (la couleur cible) tout en conservant le logo, sa position et sa taille.
 * Utilisé par la fonction "Copier vers" qui doit dupliquer le visuel logo
 * sans écraser la couleur initiale du produit cible.
 */
async function renderView(
  view: ViewState,
  mockupOverride?: MockupAsset | null,
): Promise<Blob | null> {
  const mockupAsset = mockupOverride ?? view.mockup;
  if (!mockupAsset) return null;
  const mock = await loadImage(mockupAsset.dataUrl);
  const c = document.createElement("canvas");
  const targetW = 2480;
  c.width = targetW;
  c.height = Math.round(targetW * (mock.naturalHeight / mock.naturalWidth));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(mock, 0, 0, c.width, c.height);
  if (view.logo) {
    const logo = await loadImage(view.logo.dataUrl);
    const lw = (view.logoWidthPct / 100) * c.width;
    const lh = lw * (logo.naturalHeight / logo.naturalWidth);
    const cx = (view.positionXPct / 100) * c.width;
    const cy = (view.positionYPct / 100) * c.height;
    ctx.drawImage(logo, cx - lw / 2, cy - lh / 2, lw, lh);
  }
  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png", 0.95));
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function summarizeSizes(items: Record<string, { size: string; qty: number; isPlaceholder?: boolean }>): {
  summary: string;
  total: number;
} {
  const buckets = new Map<string, number>();
  let total = 0;
  for (const it of Object.values(items)) {
    if (it.qty <= 0) continue;
    total += it.qty;
    const key = it.isPlaceholder ? "?" : it.size;
    buckets.set(key, (buckets.get(key) ?? 0) + it.qty);
  }
  const summary = [...buckets.entries()].map(([s, q]) => `${s}×${q}`).join(", ");
  return { summary, total };
}

export function StudioBatStudio({
  orderId,
  backTo,
  preview,
  colorId,
  onAfterValidate,
  onDirtyChange,
  validateRef,
  actionsRef,
  hideTopBar,
}: StudioBatStudioProps) {
  const navigate = useNavigate();
  const { show } = useToast();
  const { data: order } = useOrder(preview ? undefined : orderId);
  const upload = useUploadBat();
  const views = useStudioStore((s) => s.views);
  const header = useNewOrderStore(selectHeader);
  const line = useNewOrderStore(selectLine);
  const addBatVersionForColor = useNewOrderStore((s) => s.addBatVersionForColor);
  const [isGenerating, setIsGenerating] = useState(false);
  /** Snapshot brut au mount/réhydratation — utilisé pour comparaison de "dirty". */
  const baselineRef = useRef<string | null>(null);

  /** Resolve the model + color descriptors for the active line. */
  const targetModel: TextileModel | null = useMemo(() => {
    if (!line || !isTextileLine(line)) return null;
    return getTextileModel(line.modelId) ?? null;
  }, [line]);

  const targetColor: TextileColor | null = useMemo(() => {
    if (!targetModel) return null;
    if (colorId) {
      return targetModel.colors.find((c) => c.id === colorId) ?? null;
    }
    // Fallback: first color used in the items, then first model color.
    if (line && isTextileLine(line)) {
      const used = Object.values(line.items).find((it) => !it.isPlaceholder);
      if (used) {
        return targetModel.colors.find((c) => c.id === used.color) ?? null;
      }
    }
    return targetModel.colors[0] ?? null;
  }, [targetModel, colorId, line]);

  // ─────────────────────────────────────────────────────────────────────────
  // P1 — Isolation par couleur : à chaque changement de colorId (et au mount),
  // reset complet du studio store puis réhydratation depuis la dernière version
  // existante pour cette couleur. Sans ça, les vues / sliders / uploads d'une
  // couleur fuitent sur l'édition de la suivante.
  // ─────────────────────────────────────────────────────────────────────────
  const isPreview = !!preview;
  useEffect(() => {
    if (!isPreview) return;
    let cancelled = false;
    const store = useStudioStore.getState();
    // 1. Reset complet — vide chaque ViewState (mockup, logo, sliders).
    store.resetAll();

    // 2. Tente la réhydratation depuis batDrafts[colorId].at(-1).
    const targetId = colorId ?? null;
    if (!targetId || !line || !isTextileLine(line)) {
      // Pas de draft à recharger — baseline = état post-reset (clean).
      baselineRef.current = JSON.stringify(useStudioStore.getState().views);
      return;
    }
    const versions = line.batDrafts?.[targetId] ?? [];
    const latest = versions[versions.length - 1];

    if (latest) {
      let firstViewId: ViewId | null = null;
      for (const v of latest.composition.views) {
        const id = v.id as ViewId;
        if (!firstViewId) firstViewId = id;
        // Réhydrate sliders / position quoi qu'il arrive.
        store.setPosition(id, v.posXPct, v.posYPct);
        store.setLogoWidth(id, v.sizePct);
        // Réhydrate les assets uniquement si dataUrls ont été persistés.
        if (
          v.mockupDataUrl &&
          v.mockupNaturalWidth &&
          v.mockupNaturalHeight &&
          v.mockupMime
        ) {
          store.setMockup(id, {
            dataUrl: v.mockupDataUrl,
            mime: v.mockupMime,
            name: v.mockupFile,
            naturalWidth: v.mockupNaturalWidth,
            naturalHeight: v.mockupNaturalHeight,
          });
        }
        if (
          v.logoDataUrl &&
          v.logoNaturalWidth &&
          v.logoNaturalHeight &&
          v.logoMime &&
          v.logoFile
        ) {
          store.setLogo(id, {
            dataUrl: v.logoDataUrl,
            mime: v.logoMime,
            name: v.logoFile,
            naturalWidth: v.logoNaturalWidth,
            naturalHeight: v.logoNaturalHeight,
          });
        } else if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn("[BAT rehydrate] logo skipped for view", v.id, {
            hasLogoDataUrl: !!v.logoDataUrl,
            logoNaturalWidth: v.logoNaturalWidth,
            logoNaturalHeight: v.logoNaturalHeight,
            logoMime: v.logoMime,
            logoFile: v.logoFile,
          });
        }
      }
      if (firstViewId) store.setActiveView(firstViewId);

      baselineRef.current = JSON.stringify(useStudioStore.getState().views);
      return;
    }

    // 3. Pas de version validée pour cette couleur → auto-load des mockups
    //    fournisseur si dispo dans le runtime catalog. Reste async ; un flag
    //    `cancelled` protège les races si l'utilisateur change de couleur en
    //    cours de fetch.
    const model = getTextileModel(line.modelId);
    const color = model?.colors.find((c) => c.id === targetId) ?? null;
    const refs = color?.supplierMockups ?? [];
    if (refs.length === 0) {
      baselineRef.current = JSON.stringify(useStudioStore.getState().views);
      return;
    }

    (async () => {
      const loaded: ViewId[] = [];
      for (const ref of refs) {
        try {
          const asset = await urlToMockupAsset(
            ref.url,
            ref.naturalWidth,
            ref.naturalHeight,
          );
          if (cancelled) return;
          useStudioStore.getState().setMockup(ref.view, asset);
          loaded.push(ref.view);
        } catch {
          // On ignore silencieusement un mockup manquant — l'utilisateur peut
          // toujours uploader manuellement la vue correspondante.
        }
      }
      if (cancelled) return;
      if (loaded.length > 0) {
        useStudioStore.getState().setActiveView(loaded[0]);
      }
      // Le baseline doit refléter l'état après auto-load — l'éditeur est clean
      // tant que l'utilisateur n'a pas modifié les sliders.
      baselineRef.current = JSON.stringify(useStudioStore.getState().views);
      onDirtyChange?.(false);
    })();

    return () => {
      cancelled = true;
    };
    // Ne PAS dépendre de `line` (référence change à chaque mutation du store).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorId, isPreview]);

  // Détection "dirty" : compare l'état courant au baseline initial.
  useEffect(() => {
    if (!onDirtyChange) return;
    if (baselineRef.current === null) return;
    const current = JSON.stringify(views);
    onDirtyChange(current !== baselineRef.current);
  }, [views, onDirtyChange]);

  async function buildPdfFromViews(
    activeIds: ViewId[],
    version: number,
    overrideColor?: TextileColor | null,
    /**
     * Mockups à substituer **uniquement** pour le rendu et la persistance —
     * utilisé par "Copier vers" pour conserver la couleur du t-shirt cible
     * (l'utilisateur duplique le logo, pas la couleur source).
     * La clé est l'id de la vue ; les vues absentes utilisent le mockup courant.
     */
    mockupOverrides?: Partial<Record<ViewId, MockupAsset>>,
  ): Promise<{
    pdf: Blob;
    pngBlobs: Map<ViewId, Blob>;
    viewMetas: BatDraftViewMeta[];
    color: string;
    model: string;
    sizesSummary: string;
    totalQuantity: number;
    productLabel: string;
    fiche: BatProductFiche;
    print: BatPrintFiche;
    warnings: string[];
  } | null> {
    // Couleur effective utilisée pour la fiche PDF (peut différer de targetColor
    // quand on duplique vers une autre couleur).
    const effectiveColor: TextileColor | null = overrideColor ?? targetColor;
    const pngBlobs = new Map<ViewId, Blob>();
    const pdfViews: BatPdfView[] = [];
    const viewMetas: BatDraftViewMeta[] = [];
    let parsedColor = "";
    let parsedModel = "";

    for (const id of activeIds) {
      const view = views[id];
      const mockup = mockupOverrides?.[id] ?? view.mockup;
      if (!mockup) continue;
      const blob = await renderView(view, mockup);
      if (!blob) continue;
      pngBlobs.set(id, blob);
      const parsed = parseMockupSku(mockup.name);
      if (!parsedColor) parsedColor = parsed.color;
      if (!parsedModel) parsedModel = parsed.model;
      pdfViews.push({
        id,
        label: VIEW_LABELS[id],
        composedPng: blob,
        sizePct: Math.round(view.logoWidthPct),
        posXPct: Math.round(view.positionXPct),
        posYPct: Math.round(view.positionYPct),
        mockupFile: mockup.name,
        logoFile: view.logo?.name ?? null,
      });
      viewMetas.push({
        id,
        label: VIEW_LABELS[id],
        sizePct: Math.round(view.logoWidthPct),
        posXPct: Math.round(view.positionXPct),
        posYPct: Math.round(view.positionYPct),
        mockupFile: mockup.name,
        logoFile: view.logo?.name ?? null,
        // Snapshots des assets — permet à "Modifier" de réhydrater l'éditeur
        // identiquement à la version sauvegardée (P1). Pour la duplication,
        // on enregistre le mockup CIBLE pour que la réhydratation montre la
        // bonne couleur de t-shirt et non celle de la source.
        mockupDataUrl: mockup.dataUrl,
        mockupMime: mockup.mime,
        mockupNaturalWidth: mockup.naturalWidth,
        mockupNaturalHeight: mockup.naturalHeight,
        logoDataUrl: view.logo?.dataUrl ?? null,
        logoMime: view.logo?.mime,
        logoNaturalWidth: view.logo?.naturalWidth,
        logoNaturalHeight: view.logo?.naturalHeight,
      });
    }
    if (pdfViews.length === 0) return null;

    const isTextile = !!line && isTextileLine(line);
    const items = isTextile ? line.items : {};
    const { summary, total } = summarizeSizes(items);
    const productLabel =
      isTextile && line.modelName ? line.modelName : parsedModel || "Textile";
    const reference = preview?.reference ?? order?.reference ?? "Brouillon";
    const clientName =
      preview?.clientName ?? order?.client?.nom ?? header.clientNom ?? "Client";

    // Build fiche from current model + targeted color (if known)
    const fiche: BatProductFiche = {
      brand: targetModel?.brand,
      modelReference: targetModel?.reference ?? parsedModel,
      modelName: targetModel?.name ?? productLabel,
      skuSupplier: targetModel?.skuSupplier,
      fabricComposition: targetModel?.fabricComposition,
      fabricWeightGsm: targetModel?.fabricWeightGsm,
      fitType: targetModel?.fitType,
      availableSizes: targetModel?.sizes.map((s) => s.label).join(" · "),
      orderedSizes: summary,
      colorCommercialName: effectiveColor?.commercialName,
      colorLabel: effectiveColor?.label ?? parsedColor,
      colorManufacturerCode: effectiveColor?.manufacturerCode,
      pantone: effectiveColor?.pantone,
      hex: effectiveColor?.hex,
      rgb: effectiveColor?.rgb ?? (effectiveColor?.hex ? hexToRgb(effectiveColor.hex) : undefined),
    };
    const print: BatPrintFiche = {
      technique: targetModel?.printTechniques?.[0],
      colorCount: undefined,
      resolutionDpi: undefined,
      colorProfile: undefined,
    };
    const warnings = computeFicheWarnings(fiche, print);

    const pdf = await buildBatPdf({
      reference,
      version,
      clientName,
      date: new Date(),
      productLabel,
      color: parsedColor,
      sizesSummary: summary,
      totalQuantity: total,
      views: pdfViews,
      fiche,
      print,
      warnings,
    });

    return {
      pdf,
      pngBlobs,
      viewMetas,
      color: parsedColor,
      model: parsedModel,
      sizesSummary: summary,
      totalQuantity: total,
      productLabel,
      fiche,
      print,
      warnings,
    };
  }

  /** Transforme un build PDF en `Omit<BatDraft, "version" | "colorId">` prêt à
   *  être passé à `addBatVersionForColor`. Utilisé par la validation et par la
   *  duplication multi-cible. */
  async function builtToDraftPayload(
    built: NonNullable<Awaited<ReturnType<typeof buildPdfFromViews>>>,
    fileName: string,
    date: Date,
  ): Promise<Omit<BatDraft, "version" | "colorId">> {
    const pdfBase64 = await blobToBase64(built.pdf);
    return {
      pdfBase64,
      pdfFileName: fileName,
      generatedAt: date.toISOString(),
      composition: {
        views: built.viewMetas,
        color: built.color,
        model: built.model,
        productLabel: built.productLabel,
        sizesSummary: built.sizesSummary,
        totalQuantity: built.totalQuantity,
        fiche: {
          brand: built.fiche.brand,
          skuSupplier: built.fiche.skuSupplier,
          fabricComposition: built.fiche.fabricComposition,
          fabricWeightGsm: built.fiche.fabricWeightGsm,
          fitType: built.fiche.fitType as
            | "regular"
            | "slim"
            | "oversized"
            | "femme"
            | "enfant"
            | undefined,
          colorCommercialName: built.fiche.colorCommercialName,
          colorManufacturerCode: built.fiche.colorManufacturerCode,
          pantone: built.fiche.pantone,
          hex: built.fiche.hex,
          rgb: built.fiche.rgb,
        },
        print: built.print.technique
          ? {
              technique: built.print.technique as
                | "DTF"
                | "Sérigraphie"
                | "Broderie"
                | "Flex"
                | "Sublimation",
              colorCount: built.print.colorCount,
              resolutionDpi: built.print.resolutionDpi,
              colorProfile: built.print.colorProfile,
            }
          : undefined,
        warnings: built.warnings,
      },
    };
  }

  async function handleValidatePreview() {
    const activeIds = VIEW_ORDER.filter((id) => views[id].mockup);
    if (activeIds.length === 0) {
      show("Ajoutez au moins un mockup", "error");
      return;
    }
    setIsGenerating(true);
    try {
      // Determine next version: count existing drafts for this color (if any).
      const targetColorId = targetColor?.id ?? colorId ?? "default";
      const existingForColor =
        line && isTextileLine(line)
          ? (line.batDrafts?.[targetColorId]?.length ?? 0)
          : 0;
      const nextVersion = existingForColor + 1;

      const built = await buildPdfFromViews(activeIds, nextVersion);
      if (!built) {
        show("Génération impossible", "error");
        return;
      }
      const date = new Date();
      const reference = preview?.reference ?? "brouillon";
      const fileName = formatBatFilename(
        reference,
        date,
        nextVersion,
        targetColor?.label ?? built.color,
      );

      // P2 — pas de téléchargement auto. Le PDF est persisté dans la commande,
      // téléchargeable explicitement depuis BatViewerDrawer.
      const draftPayload = await builtToDraftPayload(built, fileName, date);
      addBatVersionForColor(targetColorId, draftPayload);

      // Reset baseline pour que la couleur soit "clean" jusqu'à la prochaine édition.
      baselineRef.current = JSON.stringify(useStudioStore.getState().views);
      onDirtyChange?.(false);

      show(`BAT v${nextVersion} enregistré dans la commande`, "success");
      if (onAfterValidate) {
        onAfterValidate();
      } else {
        navigate(backTo);
      }
    } catch (err) {
      const e = err as Error;
      show(`Erreur : ${e.message ?? "génération impossible"}`, "error");
    } finally {
      setIsGenerating(false);
    }
  }

  /** Capture le state courant du studio et crée un BatDraft v(N+1) pour chaque
   *  couleur cible. Le **logo, sa position et sa taille** sont dupliqués
   *  intégralement ; en revanche, l'image du t-shirt est remplacée par les
   *  mockups fournisseur de la couleur cible afin de préserver la couleur
   *  initiale du produit cible (cf. fiche produit page 1).
   *
   *  Retourne le nombre de cibles pour lesquelles un BAT a été créé. */
  async function duplicateToColors(targetColorIds: string[]): Promise<number> {
    if (!targetModel) return 0;
    if (!line || !isTextileLine(line)) return 0;
    const activeIds = VIEW_ORDER.filter((id) => views[id].mockup);
    if (activeIds.length === 0) {
      show("Aucun mockup à dupliquer — ajoutez au moins une vue", "error");
      return 0;
    }
    setIsGenerating(true);
    let success = 0;
    let skippedNoMockup = 0;
    try {
      const date = new Date();
      const reference = preview?.reference ?? "brouillon";
      // Snapshot batDrafts une fois — chaque addBatVersionForColor mute le store
      // et `line.batDrafts` change de référence à chaque itération.
      const baseDrafts = line.batDrafts ?? {};
      for (const tid of targetColorIds) {
        if (tid === colorId) continue; // Ignore la couleur source.
        const tColor = targetModel.colors.find((c) => c.id === tid) ?? null;
        if (!tColor) continue;

        // Charge les mockups fournisseur de la couleur cible — ce sont les
        // images du t-shirt à la couleur du produit cible. Si aucun mockup
        // n'est exposé pour la couleur cible, on skippe : sans cette image
        // on retomberait sur le mockup de la source et la couleur cible serait
        // écrasée (= bug).
        const supplierRefs = tColor.supplierMockups ?? [];
        if (supplierRefs.length === 0) {
          skippedNoMockup += 1;
          continue;
        }
        const overrides: Partial<Record<ViewId, MockupAsset>> = {};
        for (const ref of supplierRefs) {
          if (!activeIds.includes(ref.view as ViewId)) continue;
          try {
            overrides[ref.view as ViewId] = await urlToMockupAsset(
              ref.url,
              ref.naturalWidth,
              ref.naturalHeight,
            );
          } catch {
            // Mockup individuel manquant — on continue sans ; les vues sans
            // override conservent le mockup courant (limitation acceptée :
            // au pire, l'utilisateur ré-uploadera la vue manquante).
          }
        }
        // Toutes les vues actives doivent avoir un mockup cible — sinon on
        // skippe la couleur entièrement pour ne pas mélanger sources et cibles.
        const missingView = activeIds.find((id) => !overrides[id]);
        if (missingView) {
          skippedNoMockup += 1;
          continue;
        }

        const existing = baseDrafts[tid]?.length ?? 0;
        const nextVersion = existing + 1;
        const built = await buildPdfFromViews(
          activeIds,
          nextVersion,
          tColor,
          overrides,
        );
        if (!built) continue;
        const fileName = formatBatFilename(
          reference,
          date,
          nextVersion,
          tColor.label ?? built.color,
        );
        const draftPayload = await builtToDraftPayload(built, fileName, date);
        addBatVersionForColor(tid, draftPayload);
        success += 1;
      }
      if (success > 0) {
        show(
          `BAT dupliqué vers ${success} couleur${success > 1 ? "s" : ""}`,
          "success",
        );
      }
      if (skippedNoMockup > 0) {
        show(
          `${skippedNoMockup} couleur${skippedNoMockup > 1 ? "s" : ""} sans mockup fournisseur — non dupliquée${skippedNoMockup > 1 ? "s" : ""}`,
          "error",
        );
      }
    } catch (err) {
      const e = err as Error;
      show(`Erreur duplication : ${e.message ?? "échec"}`, "error");
    } finally {
      setIsGenerating(false);
    }
    return success;
  }

  async function handleGenerateForOrder() {
    if (!orderId) {
      show("Commande introuvable", "error");
      return;
    }
    const activeIds = VIEW_ORDER.filter((id) => views[id].mockup);
    if (activeIds.length === 0) {
      show("Ajoutez au moins un mockup", "error");
      return;
    }
    setIsGenerating(true);
    try {
      const firstId = activeIds[0];
      const blob = await renderView(views[firstId]);
      if (!blob) {
        show("Génération impossible", "error");
        return;
      }
      const file = new File([blob], `bat-${orderId}.png`, { type: "image/png" });
      await upload.mutateAsync({ order_id: orderId, file });
      show("BAT envoyé au client", "success");
      navigate(backTo);
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>;
      show(`Erreur : ${e.response?.data?.detail ?? "envoi impossible"}`, "error");
    } finally {
      setIsGenerating(false);
    }
  }

  const handleGenerate = preview ? handleValidatePreview : handleGenerateForOrder;
  const generateLabel = preview ? "Valider le BAT" : "Générer + Envoyer le BAT";
  const generatePendingLabel = preview ? "Validation…" : "Envoi…";

  // Expose la fonction de validation au parent (drawer) pour les raccourcis clavier.
  useEffect(() => {
    if (!validateRef) return;
    validateRef.current = handleGenerate;
    return () => {
      if (validateRef) validateRef.current = null;
    };
  });

  // Expose les actions internes (duplication multi-cible…) au wrapper drawer.
  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = { duplicateToColors };
    return () => {
      if (actionsRef) actionsRef.current = null;
    };
  });

  return (
    <div
      className={`flex flex-col bg-slate-50 dark:bg-slate-950 ${hideTopBar ? "h-full" : "h-[calc(100vh-4rem)]"}`}
    >
      {!hideTopBar && (
      <TopBar
        order={order}
        reference={preview?.reference}
        clientName={preview?.clientName}
        backTo={backTo}
        backLabel={preview ? "Retour à la commande" : "Retour"}
        onSkip={() => navigate(backTo)}
        skipLabel={preview ? "Retour à la commande" : "Ignorer"}
        onGenerate={handleGenerate}
        isGenerating={isGenerating || upload.isPending}
        generateLabel={generateLabel}
        generatePendingLabel={generatePendingLabel}
        previewBadge={preview ? "Brouillon" : undefined}
      />
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 p-6">
          <CanvasStage />
        </div>
        <ViewTabs />
      </div>
    </div>
  );
}
