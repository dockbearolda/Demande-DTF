"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useSession, type Gender } from "@/lib/session-store";
import type { ProductCard } from "@/lib/products";
import { getProductMeta, type ProductMeta } from "./product-meta";
import "./styles.css";

type Tab = "tous" | "femme";

interface CatalogueViewProps {
  unisexProducts: ProductCard[];
  womenProducts: ProductCard[];
}

interface ProductWithMeta extends ProductCard {
  meta: ProductMeta;
}

const STEPS = ["Modèle", "Couleur", "Taille", "Logo"] as const;

function formatPrice(cents: number): string {
  const eur = cents / 100;
  return Number.isInteger(eur) ? `${eur} €` : `${eur.toFixed(2).replace(".", ",")} €`;
}

function formatPriceValue(cents: number): string {
  const eur = cents / 100;
  return Number.isInteger(eur) ? `${eur}` : eur.toFixed(2).replace(".", ",");
}

export function CatalogueView({ unisexProducts, womenProducts }: CatalogueViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setGender = useSession((s) => s.setGender);

  const initialTab: Tab = searchParams.get("gender") === "WOMEN" ? "femme" : "tous";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allProducts = useMemo<ProductWithMeta[]>(() => {
    const enriched = (gender: Gender, products: ProductCard[]) =>
      products.map((p) => ({
        ...p,
        gender,
        meta: getProductMeta(p.ref),
      }));
    return [
      ...enriched("UNISEX", unisexProducts),
      ...enriched("WOMEN", womenProducts),
    ];
  }, [unisexProducts, womenProducts]);

  const counts = useMemo(
    () => ({
      tous: allProducts.length,
      femme: allProducts.filter((p) => p.gender === "WOMEN").length,
    }),
    [allProducts],
  );

  const visibleProducts = useMemo(() => {
    if (tab === "femme") return allProducts.filter((p) => p.gender === "WOMEN");
    return allProducts;
  }, [allProducts, tab]);

  const selectedProduct = useMemo(
    () => allProducts.find((p) => p.id === selectedId) ?? null,
    [allProducts, selectedId],
  );

  const handleSelect = (product: ProductWithMeta) => {
    if (product.totalStock === 0) return;
    setSelectedId(product.id);
    setGender(product.gender);
  };

  const handleConfirm = (product: ProductWithMeta) => {
    setGender(product.gender);
    router.push(`/catalogue/${product.id}/options`);
  };

  const womenProduct = allProducts.find((p) => p.gender === "WOMEN");

  const gridItems = useMemo(() => {
    if (tab === "femme" || visibleProducts.length === 0) return [];
    return visibleProducts;
  }, [visibleProducts, tab]);

  return (
    <div className="olda-modeles">
      <TopBar onBack={() => router.push("/")} />
      <ProgressBar
        selectedModelName={selectedProduct?.name ?? null}
        onResetModel={() => setSelectedId(null)}
      />

      <Tabs active={tab} onChange={setTab} counts={counts} />

      {tab === "femme" ? (
        <FemmeBlock
          product={womenProduct ?? null}
          isSelected={selectedId === womenProduct?.id}
          onSelect={womenProduct ? () => handleSelect(womenProduct) : () => {}}
          onConfirm={womenProduct ? () => handleConfirm(womenProduct) : () => {}}
        />
      ) : (
        gridItems.length > 0 && (
          <>
            <p className="olda-modeles__count" aria-live="polite">
              {gridItems.length} modèle{gridItems.length > 1 ? "s" : ""} disponible{gridItems.length > 1 ? "s" : ""}
            </p>
            <div className="olda-modeles__grid">
              {gridItems.map((item) => (
                <ProductCardItem
                  key={item.id}
                  product={item}
                  isSelected={selectedId === item.id}
                  onSelect={() => handleSelect(item)}
                  onConfirm={() => handleConfirm(item)}
                />
              ))}
            </div>
          </>
        )
      )}

      {selectedProduct && (
        <StickyCTA
          product={selectedProduct}
          onConfirm={() => handleConfirm(selectedProduct)}
        />
      )}
    </div>
  );
}

/* ─────────────────── Sous-composants ─────────────────── */

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="olda-modeles__topbar">
      <button type="button" className="olda-modeles__back" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden />
        Accueil
      </button>
      <nav className="olda-modeles__nav" aria-label="Navigation principale">
        <a href="/infos">Atelier</a>
        <a href="/contact">Contact</a>
        <a href="/panier">Panier</a>
      </nav>
    </div>
  );
}

function ProgressBar({
  selectedModelName,
  onResetModel,
}: {
  selectedModelName: string | null;
  onResetModel: () => void;
}) {
  const currentStep = 1;
  return (
    <div className="olda-modeles__progress" aria-label="Étapes du configurateur">
      <div className="olda-modeles__progress-overline">
        <span>Compose ton t-shirt</span>
        <span className="olda-modeles__progress-step-count">
          Étape {currentStep} / {STEPS.length}
        </span>
      </div>
      <ol className="olda-modeles__progress-bars">
        {STEPS.map((label, i) => {
          const idx = i + 1;
          const isModele = idx === 1;
          const isDone = isModele && Boolean(selectedModelName);
          const isCurrent = idx === currentStep && !isDone;
          const state: "done" | "current" | "todo" = isDone
            ? "done"
            : isCurrent
              ? "current"
              : "todo";
          const isInteractive = state === "done";
          const className =
            "olda-modeles__progress-bar olda-modeles__progress-bar--" + state;
          const value = isDone ? selectedModelName : null;
          const ariaLabel = value
            ? `${label} sélectionné : ${value}. Cliquer pour modifier.`
            : isCurrent
              ? `${label}, étape en cours`
              : `${label}, étape à venir`;
          return (
            <li
              key={label}
              className={className}
              aria-current={isCurrent ? "step" : undefined}
            >
              <button
                type="button"
                className="olda-modeles__progress-btn"
                onClick={isInteractive ? onResetModel : undefined}
                disabled={!isInteractive}
                aria-label={ariaLabel}
              >
                <div className="olda-modeles__progress-track">
                  <div className="olda-modeles__progress-fill" />
                </div>
                <div className="olda-modeles__progress-text">
                  <span className="olda-modeles__progress-label-row">
                    {state === "done" && (
                      <svg
                        className="olda-modeles__progress-check"
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        aria-hidden
                      >
                        <path
                          d="M 1.5 5.2 L 4 7.5 L 8.5 2.5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    <span className="olda-modeles__progress-label">{label}</span>
                  </span>
                  {value && (
                    <span className="olda-modeles__progress-value" title={value}>
                      {value}
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Tabs({
  active,
  onChange,
  counts,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  counts: { tous: number; femme: number };
}) {
  return (
    <div className="olda-modeles__tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={active === "tous"}
        className={
          "olda-modeles__tab" +
          (active === "tous" ? " olda-modeles__tab--active" : "")
        }
        onClick={() => onChange("tous")}
      >
        Tous
        <span className="olda-modeles__tab-count">{counts.tous}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "femme"}
        className={
          "olda-modeles__tab" +
          (active === "femme" ? " olda-modeles__tab--active" : "")
        }
        onClick={() => onChange("femme")}
      >
        Femme
        <span className="olda-modeles__tab-count">{counts.femme}</span>
      </button>
    </div>
  );
}

interface ProductCardItemProps {
  product: ProductWithMeta;
  isSelected: boolean;
  onSelect: () => void;
  onConfirm: () => void;
}

function ProductCardItem({
  product,
  isSelected,
  onSelect,
  onConfirm,
}: ProductCardItemProps) {
  const soldOut = product.totalStock === 0;

  const handleClick = () => {
    if (soldOut) return;
    if (isSelected) {
      onConfirm();
      return;
    }
    onSelect();
  };

  return (
    <article
      className={
        "olda-modeles__card" +
        (isSelected ? " olda-modeles__card--selected" : "")
      }
      onClick={handleClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onConfirm();
        } else if (e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="olda-modeles__card-media">
        {soldOut ? <span className="olda-modeles__card-soldout">Rupture</span> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="olda-modeles__card-img"
          src={`/assets/models/${product.ref}.webp`}
          alt={product.name}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </div>

      <div className="olda-modeles__card-body">
        <h3 className="olda-modeles__card-name">{product.name}</h3>
        <div className="olda-modeles__card-meta">
          <span>{product.meta.weight}</span>
          <span className="olda-modeles__card-sep">·</span>
          <span>{product.meta.fabric}</span>
        </div>

        <div className="olda-modeles__card-specs">
          <div className="olda-modeles__spec">
            <span className="olda-modeles__spec-label">Coupe</span>
            <span className="olda-modeles__spec-value">{product.meta.fit}</span>
          </div>
        </div>

        <div className="olda-modeles__card-price-row">
          <div>
            <span className="olda-modeles__card-price-value">
              {formatPriceValue(product.basePriceCents)} €
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="olda-modeles__card-cta"
        onClick={(e) => {
          e.stopPropagation();
          onConfirm();
        }}
        tabIndex={-1}
      >
        Choisir ce modèle
        <svg width="11" height="9" viewBox="0 0 11 9" aria-hidden>
          <path
            d="M 1 4.5 L 9.5 4.5 M 7 2 L 9.5 4.5 L 7 7"
            stroke="currentColor"
            fill="none"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </article>
  );
}

function FemmeBlock({
  product,
  isSelected,
  onSelect,
  onConfirm,
}: {
  product: ProductWithMeta | null;
  isSelected: boolean;
  onSelect: () => void;
  onConfirm: () => void;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes("@")) setSubmitted(true);
  };

  return (
    <div className="olda-modeles__femme">
      <div className="olda-modeles__femme-overline">
        Vestiaire femme · en cours
      </div>
      <div className="olda-modeles__femme-layout">
        <div className="olda-modeles__femme-card-wrap">
          {product ? (
            <ProductCardItem
              product={product}
              isSelected={isSelected}
              onSelect={onSelect}
              onConfirm={onConfirm}
            />
          ) : (
            <div
              style={{
                padding: 24,
                color: "var(--m-ink-60)",
                fontSize: 13,
              }}
            >
              Aucun modèle femme disponible.
            </div>
          )}
        </div>
        <div className="olda-modeles__femme-editorial">
          <div className="olda-modeles__femme-rule" />
          <h2 className="olda-modeles__femme-title">
            Le vestiaire femme arrive.
          </h2>
          <p className="olda-modeles__femme-body">
            Une seule pièce pour l’instant — pas par manque d’envie, par
            exigence. Les prochaines coupes arrivent : tee oversize femme,
            débardeur côtelé, crop manches longues.
          </p>
          <p className="olda-modeles__femme-list">
            Laissez votre email, vous serez les premières informées.
          </p>
          {!submitted ? (
            <form className="olda-modeles__femme-form" onSubmit={handleSubmit}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                className="olda-modeles__femme-input"
                placeholder="prenom@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Adresse email"
                required
              />
              <button type="submit" className="olda-modeles__femme-btn">
                Me prévenir
              </button>
            </form>
          ) : (
            <p className="olda-modeles__femme-thanks">
              Merci. On revient vers vous quand la prochaine coupe est prête.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StickyCTA({
  product,
  onConfirm,
}: {
  product: ProductWithMeta;
  onConfirm: () => void;
}) {
  return (
    <div className="olda-modeles__sticky-cta olda-modeles__sticky-cta--visible">
      <div className="olda-modeles__sticky-info">
        <span className="olda-modeles__sticky-name">{product.name}</span>
        <span className="olda-modeles__sticky-price">
          À partir de {formatPrice(product.basePriceCents)} · perso +6 €/face
        </span>
      </div>
      <button
        type="button"
        className="olda-modeles__sticky-btn"
        onClick={onConfirm}
      >
        Couleur
        <svg width="11" height="9" viewBox="0 0 11 9" aria-hidden>
          <path
            d="M 1 4.5 L 9.5 4.5 M 7 2 L 9.5 4.5 L 7 7"
            stroke="currentColor"
            fill="none"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
