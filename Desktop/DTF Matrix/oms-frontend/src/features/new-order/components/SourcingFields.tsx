import { useEffect, useState } from "react";
import { Sparkles, Search } from "lucide-react";
import { QUANTITES_PRESET } from "../constants";
import { selectLine, useNewOrderStore } from "../store";
import { isClassicLine, type ClassicLine } from "../types";
import { Input, PillButton, Section } from "./primitives";

/**
 * Formulaire dédié aux articles "Hors catalogue" — alternative à
 * `StandardOrderFields` quand l'employé déclare un produit que nous ne vendons
 * pas habituellement (ex: chapeaux à sourcer auprès d'un fournisseur).
 *
 * Différences UX :
 * - Bandeau ambré "Sourcing requis" qui rend visible le statut spécial.
 * - Nom libre obligatoire (pas de presets restrictifs) + presets discrets pour
 *   accélérer la saisie des cas courants.
 * - Description riche obligatoire — c'est la valeur ajoutée pour l'équipe
 *   d'achat ; sans elle, le sourcing est impossible à exécuter.
 * - Budget estimatif facultatif côté client, pour cadrer la recherche.
 * - Prix d'achat masqué (renseigné a posteriori par un manager).
 */

interface Props {
  error?: string;
  /** Suggestions rapides (depuis ProductCategoryConfig.produits). */
  products?: string[];
}

export function SourcingFields({ error, products }: Props) {
  const line = useNewOrderStore(selectLine);
  const setProduit = useNewOrderStore((s) => s.setClassicProduit);
  const setQty = useNewOrderStore((s) => s.setClassicQty);
  const setSourcingDescription = useNewOrderStore(
    (s) => s.setClassicSourcingDescription,
  );
  const setSourcingBudget = useNewOrderStore((s) => s.setClassicSourcingBudget);

  if (!line || !isClassicLine(line)) return null;

  return (
    <Inner
      line={line}
      setProduit={setProduit}
      setQty={setQty}
      setSourcingDescription={setSourcingDescription}
      setSourcingBudget={setSourcingBudget}
      error={error}
      products={products}
    />
  );
}

function Inner({
  line,
  setProduit,
  setQty,
  setSourcingDescription,
  setSourcingBudget,
  error,
  products: productsProp,
}: {
  line: ClassicLine;
  setProduit: (p: string, cp?: string) => void;
  setQty: (q: number) => void;
  setSourcingDescription: (d: string) => void;
  setSourcingBudget: (b: number | null) => void;
  error?: string;
  products?: string[];
}) {
  const products = productsProp ?? [];
  const [showCustomQty, setShowCustomQty] = useState(
    !!line.quantity && !QUANTITES_PRESET.includes(line.quantity),
  );
  const [customQtyStr, setCustomQtyStr] = useState(
    line.quantity && showCustomQty ? String(line.quantity) : "",
  );
  const [budgetStr, setBudgetStr] = useState(
    line.sourcingBudgetEstime ? String(line.sourcingBudgetEstime) : "",
  );

  // Synchronise budgetStr quand le store est réhydraté (reload navigateur).
  useEffect(() => {
    setBudgetStr(
      line.sourcingBudgetEstime ? String(line.sourcingBudgetEstime) : "",
    );
  }, [line.sourcingBudgetEstime]);

  const productErr = error && error.includes("Produit") ? error : undefined;
  const qtyErr = error && error.includes("Quantité") ? error : undefined;
  const descErr = error && error.includes("Description") ? error : undefined;
  const isCustomProduct =
    !!line.customProduit && !products.includes(line.customProduit);
  const productValue = line.customProduit ?? line.produit;

  return (
    <div className="space-y-6">
      {/* Bandeau "Sourcing requis" — ambre/orange chaleureux pour signaler
          un workflow spécial sans dramatiser. Le ton "ludique-pro" passe par
          l'icône Sparkles + un message clair sur ce qui se passera ensuite. */}
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-amber-100 text-amber-700"
        >
          <Sparkles size={18} strokeWidth={2.25} />
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-bold uppercase tracking-wider text-amber-900">
            Sourcing requis · Hors catalogue
          </span>
          <span className="text-[13px] leading-snug text-amber-900/80">
            Cette ligne sera créée en statut <strong>« En attente sourcing »</strong>.
            L'équipe achat recevra l'alerte pour trouver le fournisseur, et un
            manager renseignera le prix unitaire avant validation.
          </span>
        </div>
      </div>

      {/* Nom de l'article — saisie libre + raccourcis rapides issus de la
          config catégorie. On affiche d'abord le champ libre (focus
          d'attention) puis les pills en dessous comme "remplir avec…". */}
      <Section
        label="Nom de l'article"
        name="produit"
        required
        error={productErr}
        hint="Ce que le client souhaite (ex: « Casquettes 5-panel marine »)"
      >
        <Input
          value={productValue}
          onChange={(v) => setProduit("", v)}
          placeholder="Décrivez l'article en quelques mots"
          ariaLabel="Nom de l'article hors catalogue"
        />
        {products.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="self-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Suggestions
            </span>
            {products.map((p) => (
              <PillButton
                key={p}
                size="sm"
                selected={line.customProduit === p || line.produit === p}
                onClick={() => setProduit("", p)}
              >
                {p}
              </PillButton>
            ))}
          </div>
        )}
        {isCustomProduct && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-amber-800">
            <Search size={12} strokeWidth={2.25} aria-hidden="true" />
            <span>Référence libre — sera transmise telle quelle à l'achat.</span>
          </p>
        )}
      </Section>

      {/* Description détaillée — c'est LE champ qui donne sa valeur au
          sourcing. Obligatoire visuellement (badge required) mais validé
          uniquement par le bouton de soumission pour ne pas bloquer la
          saisie en plein flow. */}
      <Section
        label="Détails de la demande client"
        name="sourcing-description"
        required
        error={descErr}
        hint="Couleurs, matières, tailles, marque préférée, contraintes… Plus c'est précis, plus le sourcing est rapide."
      >
        <textarea
          id="field-sourcing-description"
          value={line.sourcingDescription ?? ""}
          onChange={(e) => setSourcingDescription(e.target.value)}
          rows={4}
          placeholder="Ex: Le client veut des casquettes 5-panel pour son équipe (~25 personnes), idéalement marine ou noir mat, avec broderie possible sur le devant. Budget serré, doit être livré sous 3 semaines."
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          aria-label="Détails de la demande de sourcing"
        />
      </Section>

      {/* Quantité — même UX que le formulaire standard, indispensable pour
          dimensionner la recherche fournisseur (palier MOQ, frais de port…). */}
      <Section label="Quantité estimée" name="quantite" required error={qtyErr}>
        <div
          className="grid grid-cols-4 gap-2 sm:grid-cols-8"
          role="radiogroup"
          aria-label="Quantité estimée"
          aria-describedby={qtyErr ? "field-quantite-error" : undefined}
        >
          {QUANTITES_PRESET.map((q) => {
            const sel = line.quantity === q && !showCustomQty;
            return (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={sel}
                aria-label={`Quantité ${q}`}
                onClick={() => {
                  setQty(q);
                  setShowCustomQty(false);
                  setCustomQtyStr("");
                }}
                className={`flex h-14 items-center justify-center rounded-xl text-base font-semibold transition-all duration-150 active:scale-[0.96] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  sel
                    ? "border-2 border-amber-600 bg-amber-50 text-amber-900 shadow-sm"
                    : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 hover:shadow-sm"
                }`}
              >
                {q}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setShowCustomQty(true);
              setQty(0);
            }}
            aria-label="Saisir une quantité personnalisée"
            className={`flex h-14 items-center justify-center rounded-xl border border-dashed text-sm font-semibold transition-all duration-150 active:scale-[0.96] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              showCustomQty
                ? "border-amber-500 bg-amber-50 text-amber-900"
                : "border-slate-400 bg-white text-slate-700 hover:border-slate-600 hover:text-slate-900"
            }`}
          >
            + Autre…
          </button>
        </div>
        {showCustomQty && (
          <div className="mt-3 max-w-[160px]">
            <Input
              value={customQtyStr}
              onChange={(v) => {
                const clean = v.replace(/[^0-9]/g, "");
                setCustomQtyStr(clean);
                setQty(Number(clean) || 0);
              }}
              placeholder="Qté libre"
              inputMode="numeric"
              autoFocus
              ariaLabel="Quantité personnalisée"
            />
          </div>
        )}
      </Section>

      {/* Budget estimatif client — facultatif mais très utile pour cadrer
          le sourcing et anticiper le devis final. Pas de prix unitaire ici :
          il sera saisi par un manager une fois le fournisseur trouvé. */}
      <Section
        label="Budget indicatif client (€)"
        name="sourcing-budget"
        hint="Optionnel — total ou par unité, à interpréter par l'équipe achat."
      >
        <div className="max-w-[200px]">
          <Input
            value={budgetStr}
            onChange={(v) => {
              const clean = v.replace(/[^0-9.,]/g, "").replace(",", ".");
              setBudgetStr(clean);
              if (clean === "") setSourcingBudget(null);
              else setSourcingBudget(Number(clean) || 0);
            }}
            placeholder="0.00"
            inputMode="numeric"
            ariaLabel="Budget indicatif en euros"
          />
        </div>
      </Section>
    </div>
  );
}
