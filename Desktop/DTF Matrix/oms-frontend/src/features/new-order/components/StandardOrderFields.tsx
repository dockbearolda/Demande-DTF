import { useEffect, useState } from "react";
import { PRODUITS_PAR_SECTEUR, QUANTITES_PRESET } from "../constants";
import { selectLine, useNewOrderStore } from "../store";
import { isClassicLine, type ClassicLine } from "../types";
import { Input, PillButton, Section } from "./primitives";

interface Props {
  error?: string;
}

export function StandardOrderFields({ error }: Props) {
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
    />
  );
}

function Inner({
  line,
  setProduit,
  setQty,
  setPrixUnitaire,
  error,
}: {
  line: ClassicLine;
  setProduit: (p: string, cp?: string) => void;
  setQty: (q: number) => void;
  setPrixUnitaire: (p: number) => void;
  error?: string;
}) {
  const produits = PRODUITS_PAR_SECTEUR[line.secteur];
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

  return (
    <div className="space-y-6">
      <Section label="Produit" required error={error && error.includes("Produit") ? error : undefined}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Produit">
          {produits.map((p) => (
            <PillButton
              key={p}
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
            />
          </div>
        )}
      </Section>

      <Section label="Quantité" required error={error && error.includes("Quantité") ? error : undefined}>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {QUANTITES_PRESET.map((q) => {
            const sel = line.quantity === q && !showCustomQty;
            return (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setQty(q);
                  setShowCustomQty(false);
                  setCustomQtyStr("");
                }}
                className={`flex h-14 items-center justify-center rounded-lg text-base font-semibold transition ${
                  sel
                    ? "bg-slate-800 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
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
            className={`flex h-14 items-center justify-center rounded-lg border border-dashed text-sm font-medium transition ${
              showCustomQty
                ? "border-slate-400 bg-slate-100 text-slate-700"
                : "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700"
            }`}
          >
            + Autre…
          </button>
        </div>
        {showCustomQty && (
          <div className="mt-3 max-w-[140px]">
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
            />
          </div>
        )}
      </Section>

      <Section label="Prix unitaire (€)" hint="HT par unité">
        <div className="max-w-[160px]">
          <Input
            value={line.prixUnitaire ? String(line.prixUnitaire) : ""}
            onChange={(v) => {
              const clean = v.replace(/[^0-9.,]/g, "").replace(",", ".");
              setPrixUnitaire(Number(clean) || 0);
            }}
            placeholder="0.00"
            inputMode="numeric"
          />
        </div>
      </Section>
    </div>
  );
}
