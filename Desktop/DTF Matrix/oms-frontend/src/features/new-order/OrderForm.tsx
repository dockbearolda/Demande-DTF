import { useCallback, useMemo, useState } from "react";
import type { Order } from "@/lib/types";

type SessionEntry = { order: Order; productLabel: string; totalQty: number };
import { useCreateOrder } from "@/hooks/useOrders";
import { useSearchOrCreateClient } from "@/hooks/useCreateClientOrSearch";
import { generateReference } from "@/lib/utils";
import {
  selectHeader,
  selectLine,
  selectSecteur,
  selectStep,
  useNewOrderStore,
} from "./store";
import {
  isClassicLine,
  isTextileLine,
  type ClassicSecteur,
  type FieldErrorKey,
  type OrderLine,
  type ValidationResult,
} from "./types";
import { type ProductCategoryConfig, PRODUCT_CATEGORIES } from "./constants";
import { OrderHeaderFields } from "./components/OrderHeaderFields";
import { Section, SegmentedControl } from "./components/primitives";
import { StandardOrderFields } from "./components/StandardOrderFields";
import { TextileOrderFields } from "./components/TextileOrderFields";
import { LogoPlacementSelector } from "./components/LogoPlacementSelector";
import { LeadCaptureModal } from "./components/LeadCaptureModal";
import { ProductCategoryPicker } from "./components/ProductCategoryPicker";
import { OrderSummaryPanel } from "./components/OrderSummaryPanel";
import { OrderConfirmModal } from "./components/OrderConfirmModal";
import { FormWizard } from "./components/FormWizard";
import { SubmissionSummary } from "./components/SubmissionSummary";
import { computeTotals } from "./pricing";

export interface OrderFormProps {
  onCreated?: (orderId: string) => void;
  onStudioBat?: () => void;
  /** Called from the SubmissionSummary "Préparer le BAT maintenant" action. */
  onStudioBatForOrder?: (orderId: string) => void;
  onCancel?: () => void;
}

type FlowStep = "form" | "confirm" | "lead";
type PendingAction = "submit" | null;

export function OrderForm({
  onCreated,
  onStudioBat,
  onStudioBatForOrder,
  onCancel,
}: OrderFormProps) {
  const header = useNewOrderStore(selectHeader);
  const line = useNewOrderStore(selectLine);
  const secteur = useNewOrderStore(selectSecteur);
  const currentStep = useNewOrderStore(selectStep);

  const setNotes = useNewOrderStore((s) => s.setNotes);
  const setHeader = useNewOrderStore((s) => s.setHeader);
  const switchSecteur = useNewOrderStore((s) => s.switchSecteur);
  const setLogoPlacement = useNewOrderStore((s) => s.setLogoPlacement);
  const setStep = useNewOrderStore((s) => s.setStep);
  const validateStep = useNewOrderStore((s) => s.validateStep);
  const reset = useNewOrderStore((s) => s.reset);
  const resetLine = useNewOrderStore((s) => s.resetLine);
  const clearLine = useNewOrderStore((s) => s.clearLine);

  const createOrder = useCreateOrder();
  const searchClient = useSearchOrCreateClient();

  // Derive selectedCategory from current line so it survives reload + step changes
  const selectedCategory = useMemo<ProductCategoryConfig | null>(() => {
    if (!line) return null;
    if (isTextileLine(line)) {
      return PRODUCT_CATEGORIES.find((c) => c.id === "textile") ?? null;
    }
    // classic — best-effort match by autoSecteur, fallback to "goodies"
    const exact = PRODUCT_CATEGORIES.find(
      (c) => c.autoSecteur === line.secteur && c.id !== "goodies",
    );
    if (exact) return exact;
    return PRODUCT_CATEGORIES.find((c) => c.id === "goodies") ?? null;
  }, [line]);

  const [errors, setErrors] = useState<ValidationResult["fieldErrors"]>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("form");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  /** Commandes créées durant cette session client (accumulées jusqu'au reset complet). */
  const [sessionEntries, setSessionEntries] = useState<SessionEntry[]>([]);
  /** Snapshot kept after successful creation to render the SubmissionSummary
   *  without redirecting. The store is reset, but we need stable values for the
   *  recap (client name, qty, category) to survive after reset. */
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [submissionSnapshot, setSubmissionSnapshot] = useState<{
    clientName: string;
    productLabel: string;
    totalQty: number;
    isUrgent: boolean;
    categoryId: ProductCategoryConfig["id"] | null;
  } | null>(null);

  /** Re-validate a single header field on blur — only the blurred field's
   *  error is updated, so untouched fields don't surface errors prematurely. */
  const handleHeaderBlur = useCallback(
    (field: "clientNom" | "assignedTo") => {
      const v = validateStep(3);
      setErrors((prev) => ({ ...prev, [field]: v.fieldErrors[field] }));
    },
    [validateStep],
  );

  const handleCategorySelect = useCallback(
    (cat: ProductCategoryConfig) => {
      if (cat.autoSecteur) {
        switchSecteur(cat.autoSecteur);
      } else {
        clearLine();
      }
    },
    [switchSecteur, clearLine],
  );

  const categoryProducts = useMemo(() => {
    if (!selectedCategory) return undefined;
    return selectedCategory.produits;
  }, [selectedCategory]);

  const buildLinesPayload = useCallback((l: OrderLine) => {
    if (isClassicLine(l)) {
      return [
        {
          ligne_numero: 1,
          secteur: l.secteur,
          produit: l.customProduit?.trim() || l.produit,
          quantite: l.quantity,
          prix_unitaire: l.prixUnitaire ?? 0,
          notes: l.notes ?? null,
        },
      ];
    }
    if (isTextileLine(l)) {
      const unitPrice = computeTotals(l).unitPrice;
      return Object.values(l.items)
        .filter((it) => it.qty > 0)
        .map((it, i) => ({
          ligne_numero: i + 1,
          secteur: "Textiles",
          produit: `${l.modelName} · ${it.color} · ${it.size}`,
          quantite: it.qty,
          prix_unitaire: unitPrice,
          notes: it.isPlaceholder ? "devis rapide (taille à préciser)" : null,
          textile: {
            model_id: l.modelId,
            target: l.target,
            size: it.size,
            color: it.color,
            is_placeholder: !!it.isPlaceholder,
          },
        }));
    }
    return [];
  }, []);

  /** Create order in DB. Reads fresh state from store to avoid stale closures. */
  const doCreate = useCallback(
    async (clientOverride?: { name: string; phone: string }) => {
      const currentLine = useNewOrderStore.getState().draft.line;
      if (!currentLine) return;

      setSubmitting(true);
      setSubmitError(null);
      try {
        const freshHeader = useNewOrderStore.getState().draft.header;
        const clientName = clientOverride?.name ?? freshHeader.clientNom;
        const usedHeader = clientOverride
          ? { ...freshHeader, clientNom: clientOverride.name, telephone: clientOverride.phone }
          : freshHeader;

        const clientRes = await searchClient.mutateAsync(clientName.trim());
        const payload = {
          client_id: clientRes.id,
          reference: generateReference(),
          assigned_to: usedHeader.assignedTo,
          personne_contact: usedHeader.personneContact.trim() || null,
          telephone: usedHeader.telephone.trim() || null,
          date_livraison_prevue: usedHeader.dateLivraison || null,
          is_urgent: usedHeader.isUrgent,
          notes_globales: usedHeader.notes.trim() || null,
          lines: buildLinesPayload(currentLine),
        };
        const order = await createOrder.mutateAsync(payload);

        // Snapshot needed to render SubmissionSummary after the store is reset.
        const totals = computeTotals(currentLine);
        const productLabel = isClassicLine(currentLine)
          ? currentLine.customProduit?.trim() || currentLine.produit
          : isTextileLine(currentLine)
            ? currentLine.modelName || "Textile"
            : "—";
        const categoryId = deriveCategoryId(currentLine);
        const snapshot = {
          clientName,
          productLabel,
          totalQty: totals.totalQty,
          isUrgent: usedHeader.isUrgent,
          categoryId,
        };
        setSubmissionSnapshot(snapshot);
        setCreatedOrder(order);
        setSessionEntries((prev) => [
          ...prev,
          { order, productLabel, totalQty: totals.totalQty },
        ]);

        setFlowStep("form");
        setPendingAction(null);
        // Keep header intact so the operator can add another article for the same client.
        resetLine();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Erreur");
      } finally {
        setSubmitting(false);
      }
    },
    [buildLinesPayload, createOrder, searchClient, onCreated, resetLine],
  );

  /** Step navigation: validate current step, then advance. */
  const handleRequestNext = useCallback((): boolean => {
    const v = validateStep(currentStep);
    setErrors(v.fieldErrors);
    if (!v.ok) {
      focusFirstError(
        v.fieldErrors,
        currentStep === 1 ? ["secteur", "line"] : [],
      );
      return false;
    }
    setStep(((currentStep + 1) as 1 | 2 | 3));
    setSubmitError(null);
    return true;
  }, [currentStep, validateStep, setStep]);

  /** Step 3 submit → open recap modal (after validation). */
  const handleSubmitFinal = useCallback(() => {
    const v3 = validateStep(3);
    setErrors(v3.fieldErrors);
    if (!v3.ok) {
      focusFirstError(v3.fieldErrors, ["clientNom", "assignedTo"]);
      return;
    }
    setFlowStep("confirm");
  }, [validateStep]);

  /** Confirm modal → actually create order. */
  const handleConfirmCreate = useCallback(() => {
    if (!header.clientNom.trim()) {
      setPendingAction("submit");
      setFlowStep("lead");
      return;
    }
    void doCreate();
  }, [header.clientNom, doCreate]);

  const handleLeadSubmit = useCallback(
    ({ name, phone }: { name: string; phone: string }) => {
      setHeader({ clientNom: name, clientId: null, telephone: phone });
      if (pendingAction === "submit") {
        void doCreate({ name, phone });
      }
      setPendingAction(null);
    },
    [pendingAction, setHeader, doCreate],
  );

  const handleStudioBat = useCallback(() => {
    // Studio BAT requires at least a textile model + items in step 1
    const v1 = validateStep(1);
    setErrors(v1.fieldErrors);
    if (!v1.ok) {
      focusFirstError(v1.fieldErrors, ["secteur", "line"]);
      return;
    }
    onStudioBat?.();
  }, [validateStep, onStudioBat]);

  const handleViewOrder = useCallback(() => {
    if (createdOrder) onCreated?.(createdOrder.id);
  }, [createdOrder, onCreated]);

  const handleStudioBatAfterCreate = useCallback(() => {
    if (!createdOrder) return;
    if (onStudioBatForOrder) onStudioBatForOrder(createdOrder.id);
    else onCreated?.(createdOrder.id);
  }, [createdOrder, onStudioBatForOrder, onCreated]);

  /** "Ajouter un autre article" — conserve le client, réinitialise uniquement la ligne. */
  const handleAddAnotherItem = useCallback(() => {
    setCreatedOrder(null);
    setSubmissionSnapshot(null);
    // The store is already at step 1 with line = null and header intact (set by resetLine in doCreate).
  }, []);

  /** "Nouvelle commande" — réinitialisation complète (client + ligne + session). */
  const handleCreateAnother = useCallback(() => {
    setCreatedOrder(null);
    setSubmissionSnapshot(null);
    setSessionEntries([]);
    reset();
  }, [reset]);

  const lineError = useMemo(() => errors.line ?? undefined, [errors.line]);
  const isTextile = !!line && isTextileLine(line);

  // ───────── Step content builders ─────────

  const step1Content = (
    <div className="space-y-7">
      <Section label="Catégorie de produit" required error={errors.secteur}>
        <ProductCategoryPicker
          selectedId={selectedCategory?.id ?? null}
          onSelect={handleCategorySelect}
        />
      </Section>

      {selectedCategory?.id === "goodies" && (
        <Section label="Machine de production" required>
          <SegmentedControl
            ariaLabel="Machine"
            size="lg"
            value={secteur ?? null}
            onChange={(v) => switchSecteur(v as ClassicSecteur)}
            options={(selectedCategory.secteurOptions ?? []).map((sec) => ({
              value: sec,
              label: sec,
            }))}
          />
        </Section>
      )}

      <div
        key={line?.kind ?? "empty"}
        className="animate-in fade-in slide-in-from-bottom-1 duration-200"
      >
        {line && isClassicLine(line) && (
          <StandardOrderFields error={lineError} products={categoryProducts} />
        )}
        {line && isTextileLine(line) && (
          <TextileOrderFields error={lineError} />
        )}
        {selectedCategory && !line && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-400">
            {selectedCategory.id === "goodies"
              ? "Choisissez la machine de production ci-dessus"
              : "Chargement…"}
          </p>
        )}
        {!selectedCategory && !line && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-400">
            Sélectionnez une catégorie de produit pour commencer
          </p>
        )}
      </div>
    </div>
  );

  const step2Content = isTextile && line && isTextileLine(line) ? (
    <div className="space-y-6">
      <Section
        label="Placement du logo"
        hint='Sélectionne ou laisse "Sans logo" par défaut'
      >
        <SansLogoToggle
          isNoLogo={line.logoPlacement === null}
          onSelectNoLogo={() => setLogoPlacement(null)}
        />
        <div className="mt-3">
          <LogoPlacementSelector
            selected={line.logoPlacement}
            onChange={setLogoPlacement}
            basePrice={computeTotals(line).unitPrice}
          />
        </div>
      </Section>

      <Section
        label="Studio BAT"
        hint="Le BAT sera envoyé au client pour validation — aucune modification possible après accord"
      >
        <StudioBatButton
          hasDesign={
            !!line.design.front || !!line.design.back || !!line.design.sleeves || line.design.skipped
          }
          designSidesCount={
            [line.design.front, line.design.back, line.design.sleeves].filter(Boolean).length
          }
          onClick={handleStudioBat}
        />
      </Section>
    </div>
  ) : null;

  const step3Totals = useMemo(() => computeTotals(line), [line]);

  const step3Content = (
    <div
      className="space-y-7"
      onKeyDown={(e) => {
        // Enter from any input/select in step 3 → submit. Excludes textarea
        // (multi-line) and buttons (default activate behaviour).
        if (e.key !== "Enter" || e.defaultPrevented) return;
        const t = e.target as HTMLElement;
        if (
          t.tagName === "TEXTAREA" ||
          t.tagName === "BUTTON" ||
          t.getAttribute("role") === "combobox" ||
          t.getAttribute("role") === "option"
        )
          return;
        e.preventDefault();
        handleSubmitFinal();
      }}
    >
      <OrderHeaderFields
        errors={errors}
        onFieldBlur={handleHeaderBlur}
        categoryId={selectedCategory?.id ?? null}
        totalQty={step3Totals.totalQty}
      />

      <Section label="Note additionnelle">
        <textarea
          value={header.notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Spécifications, contraintes de production…"
          rows={3}
          className="block w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
        />
      </Section>
    </div>
  );

  if (createdOrder && submissionSnapshot) {
    return (
      <SubmissionSummary
        order={createdOrder}
        categoryId={submissionSnapshot.categoryId}
        totalQty={submissionSnapshot.totalQty}
        clientName={submissionSnapshot.clientName}
        productLabel={submissionSnapshot.productLabel}
        isUrgent={submissionSnapshot.isUrgent}
        sessionEntries={sessionEntries}
        onViewOrder={handleViewOrder}
        onAddAnotherItem={handleAddAnotherItem}
        onCreateAnother={handleCreateAnother}
        onStudioBat={
          submissionSnapshot.categoryId === "textile"
            ? handleStudioBatAfterCreate
            : undefined
        }
      />
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-5xl items-start gap-6 px-4">
        <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm sm:p-8">
          <header className="mb-6 flex items-baseline justify-between">
            <div>
              <h2 className="text-[18px] font-bold text-slate-800">Nouvelle commande</h2>
              <p className="mt-0.5 text-xs text-slate-500">Saisie rapide · point of sale</p>
            </div>
            <div className="flex items-center gap-2">
              {selectedCategory && (
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {selectedCategory.label}
                </span>
              )}
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  Annuler
                </button>
              )}
            </div>
          </header>

          {sessionEntries.length > 0 && (
            <SessionCartBanner entries={sessionEntries} />
          )}

          <FormWizard
            step1={step1Content}
            step2={step2Content}
            step3={step3Content}
            onRequestNext={handleRequestNext}
            onSubmitFinal={handleSubmitFinal}
            submitting={submitting}
          />

          {submitError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 p-3"
            >
              <svg
                viewBox="0 0 24 24"
                className="mt-0.5 h-5 w-5 flex-none text-rose-700"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold leading-snug text-rose-900">
                  Échec de la création — la saisie est conservée
                </div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-rose-800">
                  {submitError}
                </div>
              </div>
              <button
                type="button"
                onClick={handleConfirmCreate}
                disabled={submitting}
                className="inline-flex h-9 flex-none items-center gap-1.5 rounded-md bg-rose-700 px-3 text-[12px] font-semibold text-white transition hover:bg-rose-800 disabled:opacity-60"
              >
                {submitting ? "Envoi…" : "Réessayer"}
              </button>
            </div>
          )}
        </div>

        <OrderSummaryPanel selectedCategory={selectedCategory} />
      </div>

      {/* Lead capture (when client missing at submit time) */}
      <LeadCaptureModal
        open={flowStep === "lead"}
        title="Renseigner le client"
        subtitle="Renseignez le nom et téléphone du client pour finaliser la commande."
        initialName={header.clientNom}
        initialPhone={header.telephone}
        onClose={() => {
          setFlowStep("confirm");
          setPendingAction(null);
        }}
        onSubmit={handleLeadSubmit}
      />

      {/* Final recap modal */}
      <OrderConfirmModal
        open={flowStep === "confirm"}
        header={header}
        line={line}
        categoryId={selectedCategory?.id ?? null}
        submitting={submitting}
        onClose={() => {
          if (submitting) return;
          setFlowStep("form");
        }}
        onConfirm={handleConfirmCreate}
      />
    </>
  );
}

// ───────── Session cart banner ─────────

function SessionCartBanner({ entries }: { entries: SessionEntry[] }) {
  return (
    <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
          {entries.length}
        </span>
        <span className="text-[12px] font-semibold text-emerald-900">
          {entries.length === 1
            ? "1 article déjà commandé pour ce client"
            : `${entries.length} articles déjà commandés pour ce client`}
        </span>
      </div>
      <ul className="mt-2 space-y-1 pl-7">
        {entries.map((e) => (
          <li key={e.order.id} className="text-[11px] text-emerald-800">
            <span className="font-mono font-semibold">{e.order.reference}</span>
            {" · "}
            {e.productLabel}
            {e.totalQty > 0 && <> · {e.totalQty} pcs</>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────── Local helpers ─────────

function SansLogoToggle({
  isNoLogo,
  onSelectNoLogo,
}: {
  isNoLogo: boolean;
  onSelectNoLogo: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelectNoLogo}
      aria-pressed={isNoLogo}
      className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition ${
        isNoLogo
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      <div>
        <div className="text-sm font-semibold">Sans logo</div>
        <div
          className={`text-[12px] leading-relaxed ${isNoLogo ? "text-slate-300" : "text-slate-600"}`}
        >
          Aucun marquage — produit livré tel quel
        </div>
      </div>
      <span
        className={`inline-flex h-7 items-center rounded-full px-2.5 text-[12px] font-bold ${
          isNoLogo ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"
        }`}
      >
        +0,00 €
      </span>
    </button>
  );
}

function StudioBatButton({
  hasDesign,
  designSidesCount,
  onClick,
}: {
  hasDesign: boolean;
  designSidesCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between rounded-xl border-2 p-4 text-left transition ${
        hasDesign
          ? "border-emerald-300 bg-emerald-50/50"
          : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            hasDesign ? "bg-emerald-500 text-white" : "bg-white/10 text-white"
          }`}
        >
          <BatIcon className="h-5 w-5" />
        </div>
        <div>
          <div
            className={`text-sm font-semibold ${
              hasDesign ? "text-slate-800" : "text-white"
            }`}
          >
            {hasDesign ? "Design prêt" : "Créer le BAT"}
          </div>
          <div
            className={`text-xs ${
              hasDesign ? "text-slate-500" : "text-white/70"
            }`}
          >
            {hasDesign
              ? `${designSidesCount} face(s) · Modifier dans le Studio BAT`
              : "Face · Dos · Manches — ouvre le Studio BAT"}
          </div>
        </div>
      </div>
      <span
        className={`text-xs font-medium ${
          hasDesign
            ? "text-slate-500 group-hover:text-slate-700"
            : "text-white/80 group-hover:text-white"
        }`}
      >
        {hasDesign ? "Modifier →" : "Créer →"}
      </span>
    </button>
  );
}

// ───────── Focus-first-error helpers ─────────

/**
 * Scrolls the first errored field into view and moves focus to it.
 * Falls back, in order: matching `id`, the element described-by the error,
 * then the first non-empty `[role="alert"]` in the document.
 */
function focusFirstError(
  fieldErrors: ValidationResult["fieldErrors"],
  priority: ReadonlyArray<FieldErrorKey>,
) {
  if (typeof document === "undefined") return;
  for (const key of priority) {
    const msg = fieldErrors[key];
    if (!msg) continue;
    if (focusFieldByKey(key, msg)) return;
  }
  // Final fallback: any visible inline alert in the form area.
  const alerts = document.querySelectorAll<HTMLElement>('[role="alert"]');
  for (const a of alerts) {
    if (a.textContent && a.textContent.trim().length > 0) {
      a.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
  }
}

function focusFieldByKey(key: string, message?: string): boolean {
  // The generic "line" key covers several Step 1 fields — pick by message.
  if (key === "line" && message) {
    const sub = lineErrorToFieldName(message);
    if (sub && focusFieldByKey(sub)) return true;
  }
  // 1) Direct id (used by Input/textarea-style fields, e.g. clientNom).
  const direct = document.getElementById(`field-${key}`);
  if (direct && isFocusable(direct)) {
    scrollAndFocus(direct);
    return true;
  }
  // 2) An owner element described-by the field's error (radiogroups etc.).
  const owner = document.querySelector<HTMLElement>(
    `[aria-describedby~="field-${key}-error"]`,
  );
  if (owner) {
    const target = isFocusable(owner)
      ? owner
      : owner.querySelector<HTMLElement>(
          'input, button, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
    if (target) scrollAndFocus(target);
    else owner.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }
  // 3) Scroll the error message itself into view.
  const errEl = document.getElementById(`field-${key}-error`);
  if (errEl) {
    errEl.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }
  return false;
}

function lineErrorToFieldName(msg: string): string | null {
  if (msg.includes("Produit")) return "produit";
  if (msg.includes("Quantité")) return "quantite";
  if (msg.includes("Modèle")) return "modele";
  return null;
}

function isFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled")) return false;
  if (["INPUT", "BUTTON", "SELECT", "TEXTAREA", "A"].includes(el.tagName)) return true;
  return el.tabIndex >= 0;
}

function scrollAndFocus(el: HTMLElement) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  // Defer focus until smooth scroll begins — prevents an extra jump.
  window.setTimeout(() => el.focus({ preventScroll: true }), 60);
}

/** Mirror of the live `selectedCategory` derivation, but pure & callable
 *  outside React (used after store reset to populate the post-submit recap). */
function deriveCategoryId(line: OrderLine | null): ProductCategoryConfig["id"] | null {
  if (!line) return null;
  if (isTextileLine(line)) return "textile";
  const exact = PRODUCT_CATEGORIES.find(
    (c) => c.autoSecteur === line.secteur && c.id !== "goodies",
  );
  if (exact) return exact.id;
  return "goodies";
}

function BatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}
