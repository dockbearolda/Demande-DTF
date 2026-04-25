import { useCallback, useMemo, useState } from "react";
import { useCreateOrder } from "@/hooks/useOrders";
import { useSearchOrCreateClient } from "@/hooks/useCreateClientOrSearch";
import { generateReference } from "@/lib/utils";
import {
  selectHeader,
  selectLine,
  selectSecteur,
  useNewOrderStore,
} from "./store";
import {
  ALL_SECTEURS,
  isClassicLine,
  isTextileLine,
  type OrderLine,
  type Secteur,
  type ValidationResult,
} from "./types";
import { OrderHeaderFields } from "./components/OrderHeaderFields";
import { PillButton, Section } from "./components/primitives";
import { StandardOrderFields } from "./components/StandardOrderFields";
import { TextileOrderFields } from "./components/TextileOrderFields";
import { PriceBar } from "./components/PriceBar";
import { LeadCaptureModal } from "./components/LeadCaptureModal";
import { QuotePreviewModal } from "./components/QuotePreviewModal";
import { computeTotals } from "./pricing";

export interface OrderFormProps {
  onCreated?: (orderId: string) => void;
  onStudioBat?: () => void;
  onCancel?: () => void;
}

type FlowStep = "form" | "lead" | "preview";

export function OrderForm({ onCreated, onStudioBat, onCancel }: OrderFormProps) {
  const header = useNewOrderStore(selectHeader);
  const line = useNewOrderStore(selectLine);
  const secteur = useNewOrderStore(selectSecteur);
  const setNotes = useNewOrderStore((s) => s.setNotes);
  const setHeader = useNewOrderStore((s) => s.setHeader);
  const switchSecteur = useNewOrderStore((s) => s.switchSecteur);
  const validate = useNewOrderStore((s) => s.validate);
  const reset = useNewOrderStore((s) => s.reset);

  const createOrder = useCreateOrder();
  const searchClient = useSearchOrCreateClient();

  const [errors, setErrors] = useState<ValidationResult["fieldErrors"]>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("form");

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

  /** Validation allégée : items + opérateur uniquement (client différé au lead capture). */
  const validateForTextileFlow = useCallback(() => {
    if (!line || !isTextileLine(line))
      return { ok: false, fieldErrors: { line: "Aucune ligne" } as const };
    const fieldErrors: ValidationResult["fieldErrors"] = {};
    if (!header.assignedTo) fieldErrors.assignedTo = "Opérateur requis";
    if (!line.modelId) fieldErrors.line = "Modèle requis";
    else {
      const hasItems = Object.values(line.items).some(
        (it) => !it.isPlaceholder && it.qty > 0,
      );
      if (!hasItems) fieldErrors.line = "Ajouter au moins une taille";
    }
    return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
  }, [line, header.assignedTo]);

  const submitClassic = useCallback(async () => {
    const v = validate();
    setErrors(v.fieldErrors);
    if (!v.ok || !line) return;
    await doCreate();
  }, [validate, line]); // eslint-disable-line react-hooks/exhaustive-deps

  const doCreate = useCallback(async () => {
    if (!line) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const clientRes = await searchClient.mutateAsync(header.clientNom.trim());
      const payload = {
        client_id: clientRes.id,
        reference: generateReference(),
        assigned_to: header.assignedTo,
        personne_contact: header.personneContact.trim() || null,
        telephone: header.telephone.trim() || null,
        date_livraison_prevue: header.dateLivraison || null,
        is_urgent: header.isUrgent,
        notes_globales: header.notes.trim() || null,
        lines: buildLinesPayload(line),
      };
      const order = await createOrder.mutateAsync(payload);
      onCreated?.(order.id);
      setFlowStep("form");
      reset();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }, [
    line,
    header,
    buildLinesPayload,
    createOrder,
    searchClient,
    onCreated,
    reset,
  ]);

  /** Entry point du flow textile : décide de la prochaine étape. */
  const startQuoteFlow = useCallback(() => {
    const v = validateForTextileFlow();
    setErrors(v.fieldErrors);
    if (!v.ok) return;

    const phoneDigits = header.telephone.replace(/\D/g, "");
    const hasLead = !!header.clientNom.trim() && phoneDigits.length >= 8;
    setFlowStep(hasLead ? "preview" : "lead");
  }, [validateForTextileFlow, header.clientNom, header.telephone]);

  const submit = useCallback(() => {
    if (line && isTextileLine(line)) {
      startQuoteFlow();
    } else {
      void submitClassic();
    }
  }, [line, startQuoteFlow, submitClassic]);

  const handleLeadSubmit = useCallback(
    ({ name, phone }: { name: string; phone: string }) => {
      setHeader({ clientNom: name, clientId: null, telephone: phone });
      setFlowStep("preview");
    },
    [setHeader],
  );

  const handleStudioBat = useCallback(() => {
    const v = validate();
    setErrors(v.fieldErrors);
    if (!v.ok) return;
    onStudioBat?.();
  }, [validate, onStudioBat]);

  const lineError = useMemo(() => errors.line ?? undefined, [errors.line]);
  const isTextile = line && isTextileLine(line);
  const showStudioBatFooterBtn = !!isTextile;
  const submitLabel = isTextile ? "Générer le Devis" : "Créer";

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm sm:p-8"
      >
        <header className="mb-6 flex items-baseline justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Nouvelle commande</h2>
            <p className="mt-0.5 text-xs text-slate-500">Saisie rapide · point of sale</p>
          </div>
          {secteur && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                secteur === "Textiles"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {secteur === "Textiles" ? "Mode textile" : "Mode classique"}
            </span>
          )}
        </header>

        <div className="space-y-7">
          <OrderHeaderFields errors={errors} />

          <Section label="Secteur" required error={errors.secteur}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Secteur">
              {ALL_SECTEURS.map((sec: Secteur) => (
                <PillButton
                  key={sec}
                  selected={secteur === sec}
                  onClick={() => switchSecteur(sec)}
                  danger={sec === "Textiles" && secteur !== "Textiles"}
                >
                  {sec === "Textiles" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  )}
                  {sec}
                </PillButton>
              ))}
            </div>
          </Section>

          <div
            key={line?.kind ?? "empty"}
            className="animate-in fade-in slide-in-from-bottom-1 duration-200"
          >
            {line && isClassicLine(line) && (
              <StandardOrderFields error={lineError} />
            )}
            {line && isTextileLine(line) && (
              <TextileOrderFields error={lineError} onStudioBat={handleStudioBat} />
            )}
            {!line && (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-400">
                Sélectionnez un secteur pour commencer
              </p>
            )}
          </div>

          <Section label="Note additionnelle">
            <textarea
              value={header.notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Spécifications, contraintes de production…"
              rows={3}
              className="block w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </Section>
        </div>

        <PriceBar
          submitting={submitting}
          onSubmit={submit}
          onStudioBat={showStudioBatFooterBtn ? handleStudioBat : undefined}
          onCancel={onCancel}
          submitLabel={submitLabel}
        />

        {submitError && (
          <p className="mt-3 text-right text-xs text-rose-600">{submitError}</p>
        )}
      </form>

      {/* Lead Capture — textile flow only */}
      <LeadCaptureModal
        open={flowStep === "lead"}
        initialName={header.clientNom}
        initialPhone={header.telephone}
        onClose={() => setFlowStep("form")}
        onSubmit={handleLeadSubmit}
      />

      {/* Quote preview — textile flow only */}
      {line && isTextileLine(line) && (
        <QuotePreviewModal
          open={flowStep === "preview"}
          header={header}
          line={line}
          submitting={submitting}
          onClose={() => {
            if (submitting) return;
            setFlowStep("form");
          }}
          onConfirm={() => void doCreate()}
        />
      )}
    </>
  );
}
