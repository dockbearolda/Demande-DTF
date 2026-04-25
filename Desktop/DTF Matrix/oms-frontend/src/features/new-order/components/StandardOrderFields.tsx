import { useEffect, useState } from "react";
import { PRODUITS_PAR_SECTEUR, QUANTITES_PRESET } from "../constants";
import { selectLine, useNewOrderStore } from "../store";
import { isClassicLine, type ClassicLine } from "../types";
import { Input, PillButton, Section } from "./primitives";

interface Props {
  error?: string;
  /** Override product list (from product category config) */
  products?: string[];
}

export function StandardOrderFields({ error, products }: Props) {
  const line = useNewOrderStore(selectLine);
  const setClassicProduit = useNewOrderStore((s) => s.setClassicProduit);
  const setClassicQty = useNewOrderStore((s) => s.setClassicQty);
  const setClassicPrixUnitaire = useNewOrderStore((s) => s.setClassicPrixUnitaire);

  if (!line || !isClassicLine(line)) return null;

  return (
    <Inner
      line={line}
      setProduit={setClassicProduit}
      setQty={setClassicQty}
      setPrixUnitaire={setClassicPrixUnitaire}
      error={error}
      products={products}
    />
  );
}

function Inner({
  line,
  setProduit,
  setQty,
  setPrixUnitaire,
  error,
  products: productsProp,
}: {
  line: ClassicLine;
  setProduit: (p: string, cp?: string) => void;
  setQty: (q: number) => void;
  setPrixUnitaire: (p: number) => void;
  error?: string;
  products?: string[];
}) {
  const produits = productsProp ?? PRODUITS_PAR_SECTEUR[line.secteur];
  const [showCustomProduit, setShowCustomProduit] = useState(
    !!line.customProduit && !line.produit,
  );
  const [showCustomQty, setShowCustomQty] = useState(
    !!line.quantity && !QUANTITES_PRESET.includes(line.quantity),
  );
  const [customQtyStr, setCustomQtyStr] = useState(
    line.quantity && showCustomQty ? String(line.quantity) : "",
  );

  // Reset "autre" quand on change de secteur
  useEffect(() => {
    setShowCustomProduit(false);
    setShowCustomQty(false);
    setCustomQtyStr("");
  }, [line.secteur]);

  const productErr = error && error.includes("Produit") ? error : undefined;
  const qtyErr = error && error.includes("Quantité") ? error : undefined;

  return (
    <div className="space-y-6">
      <Section label="Produit" name="produit" required error={productErr}>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Produit"
          aria-describedby={productErr ? "field-produit-error" : undefined}
        >
          {produits.map((p) => (
            <PillButton
              key={p}
              size="lg"
              selected={line.produit === p && !showCustomProduit}
              onClick={() => {
                setProduit(p, undefined);
                setShowCustomProduit(false);
              }}
            >
              {p}
            </PillButton>
          ))}
          <PillButton
            dashed
            size="lg"
            onClick={() => {
              setShowCustomProduit(true);
              setProduit("", line.customProduit ?? "");
            }}
          >
            + Autre…
          </PillButton>
        </div>
        {showCustomProduit && (
          <div className="mt-3 max-w-xs">
            <Input
              value={line.customProduit ?? ""}
              onChange={(v) => setProduit("", v)}
              placeholder="Nom du produit personnalisé"
              autoFocus
              ariaLabel="Nom du produit personnalisé"
            />
          </div>
        )}
      </Section>

      <Section label="Quantité" name="quantite" required error={qtyErr}>
        <div
          className="grid grid-cols-4 gap-2 sm:grid-cols-8"
          role="radiogroup"
          aria-label="Quantité"
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
                    ? "border-2 border-blue-700 bg-blue-50 text-blue-800 shadow-sm"
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
                ? "border-slate-500 bg-slate-100 text-slate-900"
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

      <Section label="Prix unitaire (€)" name="prixUnitaire" hint="HT par unité">
        <div className="max-w-[160px]">
          <Input
            value={line.prixUnitaire ? String(line.prixUnitaire) : ""}
            onChange={(v) => {
              const clean = v.replace(/[^0-9.,]/g, "").replace(",", ".");
              setPrixUnitaire(Number(clean) || 0);
            }}
            placeholder="0.00"
            inputMode="numeric"
            ariaLabel="Prix unitaire en euros, hors taxes"
          />
        </div>
      </Section>
    </div>
  );
}
