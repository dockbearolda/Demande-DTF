/**
 * Catalogue fournisseur en modal : même UI que la page /catalogue
 * (tabs Homme/Femme/Enfant/Bébé + accordéon références + grille couleurs),
 * mais les couleurs sont cliquables et appellent `onSelect`.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronRight, X, Check } from "lucide-react";
import {
  useSupplierCatalog,
  absoluteMockupUrl,
  type SupplierModelDTO,
  type SupplierColorDTO,
} from "@/hooks/useSupplierCatalog";
import { resolveColorHex, COLOR_FALLBACK_HEX } from "@/lib/colors.config";

type Category = "HOMME" | "FEMME" | "ENFANT" | "BEBE";

const CATEGORY_LABELS: Record<Category, string> = {
  HOMME: "Homme",
  FEMME: "Femme",
  ENFANT: "Enfant",
  BEBE: "Bébé",
};
const CATEGORIES: Category[] = ["HOMME", "FEMME", "ENFANT", "BEBE"];

function resolveHex(color: SupplierColorDTO): string {
  return color.hex ?? resolveColorHex(color.slug, color.label) ?? COLOR_FALLBACK_HEX;
}
function isNearWhite(hex: string): boolean {
  const h = hex.toLowerCase();
  return h === "#ffffff" || h === "#fff";
}
function modelMatchesSearch(model: SupplierModelDTO, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  return [
    model.ref_internal,
    model.ref_supplier,
    model.ref_label,
    model.brand,
    model.name,
    model.fit_type,
    ...model.colors.map((c) => c.label),
  ].some((f) => f && f.toLowerCase().includes(q));
}

// ─── SelectableColorCard ─────────────────────────────────────────────────────

function SelectableColorCard({
  color,
  onSelect,
}: {
  color: SupplierColorDTO;
  onSelect: (color: SupplierColorDTO) => void;
}) {
  const hex = resolveHex(color);
  const hasBorder = isNearWhite(hex);
  const frontMockup = color.mockups.find((m) => m.view === "front" && !m.is_lifestyle);
  const mockupUrl = frontMockup ? absoluteMockupUrl(frontMockup.url) : null;
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(color)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 72,
          height: 72,
          borderRadius: 10,
          overflow: "hidden",
          background: hex,
          border: hasBorder ? "1px solid var(--ink-200)" : "1px solid rgba(0,0,0,0.07)",
          outline: hovered ? "2px solid var(--accent-500)" : "2px solid transparent",
          outlineOffset: 2,
          transition: "outline-color 120ms",
          flexShrink: 0,
        }}
      >
        {mockupUrl && (
          <img
            src={mockupUrl}
            alt={color.label}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transform: hovered ? "scale(1.05)" : "scale(1)",
              transition: "transform 180ms var(--ease-out)",
            }}
            loading="lazy"
          />
        )}
        {hovered && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(74, 98, 116, 0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "var(--accent-500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={14} strokeWidth={2.5} color="white" />
            </div>
          </div>
        )}
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: hovered ? "var(--ink-800)" : "var(--ink-600)",
          textAlign: "center",
          lineHeight: 1.3,
          width: 72,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          transition: "color 120ms",
        }}
      >
        {color.label}
      </span>
    </button>
  );
}

// ─── ModelRow ────────────────────────────────────────────────────────────────

function ModelRow({
  model,
  isOpen,
  onToggle,
  onSelectColor,
}: {
  model: SupplierModelDTO;
  isOpen: boolean;
  onToggle: () => void;
  onSelectColor: (model: SupplierModelDTO, color: SupplierColorDTO) => void;
}) {
  const enabledColors = useMemo(
    () => model.colors.filter((c) => c.enabled).sort((a, b) => a.position - b.position),
    [model.colors],
  );

  // Thumbnail : première image front de la première couleur activée.
  const thumbUrl = useMemo(() => {
    for (const c of enabledColors) {
      const front = c.mockups.find((m) => m.view === "front" && !m.is_lifestyle);
      if (front) return absoluteMockupUrl(front.url);
    }
    return undefined;
  }, [enabledColors]);

  const commercialName = model.name ?? model.ref_label ?? "";

  return (
    <div style={{ borderBottom: "1px solid var(--ink-100)" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          width: "100%",
          padding: "12px 24px",
          background: isOpen ? "var(--ink-25)" : "transparent",
          border: "none",
          textAlign: "left",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.background = "var(--ink-25)";
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Thumbnail 32×32 au repos */}
        <div
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: 6,
            overflow: "hidden",
            background: "#F4F4F2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt=""
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: enabledColors[0] ? (enabledColors[0].hex ?? "#F4F4F2") : "#F4F4F2",
              }}
            />
          )}
        </div>

        {/* Ref · Nom commercial */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--ink-400)",
                letterSpacing: "0.04em",
                flexShrink: 0,
              }}
            >
              {model.ref_internal}
            </span>
            {commercialName && (
              <>
                <span style={{ color: "var(--ink-300)", flexShrink: 0, fontSize: 11 }}>·</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#3a4e5d",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {commercialName}
                </span>
              </>
            )}
          </div>
          {(model.fabric_weight_gsm || model.fabric_composition) && (
            <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
              {model.fabric_weight_gsm && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-400)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {model.fabric_weight_gsm} g/m²
                </span>
              )}
              {model.fabric_composition && (
                <span style={{ fontSize: 11, color: "var(--ink-400)" }}>
                  {model.fabric_composition}
                </span>
              )}
            </div>
          )}
        </div>

        <ChevronRight
          size={15}
          strokeWidth={1.75}
          style={{
            color: "var(--ink-300)",
            flexShrink: 0,
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 180ms var(--ease-snap)",
          }}
        />
      </button>

      {/* Expanded color grid */}
      {isOpen && (
        <div style={{ padding: "4px 24px 28px", background: "var(--ink-25)" }}>
          <div
            style={{ height: 1, background: "var(--ink-100)", marginBottom: 24 }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {enabledColors.map((color) => (
              <SelectableColorCard
                key={color.id}
                color={color}
                onSelect={(c) => onSelectColor(model, c)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CategorySection ─────────────────────────────────────────────────────────

function CategorySection({
  label,
  models,
  openModelId,
  onToggle,
  onSelectColor,
}: {
  label: string;
  models: SupplierModelDTO[];
  openModelId: string | null;
  onToggle: (id: string) => void;
  onSelectColor: (model: SupplierModelDTO, color: SupplierColorDTO) => void;
}) {
  if (models.length === 0) return null;
  return (
    <div>
      <div
        style={{
          padding: "14px 24px 10px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-400)",
          borderBottom: "1px solid var(--ink-100)",
          background: "var(--ink-50)",
        }}
      >
        {label}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            marginLeft: 6,
            color: "var(--ink-300)",
          }}
        >
          {models.length}
        </span>
      </div>
      {models.map((m) => (
        <ModelRow
          key={m.id}
          model={m}
          isOpen={openModelId === m.id}
          onToggle={() => onToggle(m.id)}
          onSelectColor={onSelectColor}
        />
      ))}
    </div>
  );
}

// ─── SupplierCatalogModal ─────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: {
    refInternal: string;
    colorSlug: string;
    model: SupplierModelDTO;
    color: SupplierColorDTO;
  }) => void;
}

export function SupplierCatalogModal({ open, onClose, onSelect }: Props) {
  const { data, isLoading } = useSupplierCatalog();
  const [activeCategory, setActiveCategory] = useState<Category>("HOMME");
  const [search, setSearch] = useState("");
  const [openModelId, setOpenModelId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state on open
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setOpenModelId(null);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const isSearching = search.trim().length > 0;

  const singleCategoryModels = useMemo(() => {
    if (!data) return [];
    return (data.categories.find((c) => c.category === activeCategory)?.models ?? [])
      .filter((m) => m.enabled)
      .sort((a, b) => a.position - b.position);
  }, [data, activeCategory]);

  const searchResults = useMemo<{ category: Category; label: string; models: SupplierModelDTO[] }[]>(() => {
    if (!data || !isSearching) return [];
    return CATEGORIES.map((cat) => {
      const group = data.categories.find((c) => c.category === cat);
      const models = (group?.models ?? [])
        .filter((m) => m.enabled && modelMatchesSearch(m, search))
        .sort((a, b) => a.position - b.position);
      return { category: cat, label: CATEGORY_LABELS[cat], models };
    }).filter((g) => g.models.length > 0);
  }, [data, search, isSearching]);

  const categoryCounts = useMemo(() => {
    if (!data) return {} as Record<string, number>;
    return Object.fromEntries(
      data.categories.map((c) => [c.category, c.models.filter((m) => m.enabled).length]),
    );
  }, [data]);

  const handleToggle = useCallback((id: string) => {
    setOpenModelId((prev) => (prev === id ? null : id));
  }, []);

  const handleSelectColor = useCallback(
    (model: SupplierModelDTO, color: SupplierColorDTO) => {
      onSelect({ refInternal: model.ref_internal, colorSlug: color.slug, model, color });
      onClose();
    },
    [onSelect, onClose],
  );

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Catalogue fournisseur"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Fermer"
        tabIndex={-1}
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 20, 24, 0.45)",
          backdropFilter: "blur(3px)",
          border: "none",
          cursor: "default",
        }}
      />

      {/* Panel slide depuis la droite */}
      <div
        style={{
          position: "relative",
          marginLeft: "auto",
          width: "100%",
          maxWidth: 760,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--ink-50)",
          boxShadow: "var(--shadow-3)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            padding: "20px 24px 0",
            background: "var(--ink-50)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                fontWeight: 700,
                color: "var(--ink-900)",
                letterSpacing: "-0.02em",
              }}
            >
              Catalogue fournisseur
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "var(--r-2)",
                background: "transparent",
                border: "none",
                color: "var(--ink-500)",
                cursor: "pointer",
                marginTop: -4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--ink-100)";
                e.currentTarget.style.color = "var(--ink-800)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--ink-500)";
              }}
            >
              <X size={17} strokeWidth={2} />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Search
              size={15}
              strokeWidth={1.75}
              style={{
                position: "absolute",
                left: 13,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-400)",
                pointerEvents: "none",
              }}
            />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOpenModelId(null);
              }}
              placeholder="Référence, coloris, marque…"
              style={{
                width: "100%",
                height: 40,
                paddingLeft: 38,
                paddingRight: search ? 36 : 14,
                background: "white",
                border: "1px solid var(--ink-200)",
                borderRadius: "var(--r-3)",
                fontSize: 13,
                color: "var(--ink-800)",
                fontFamily: "var(--font-text)",
                outline: "none",
                transition: "border-color var(--dur-base), box-shadow var(--dur-base)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-500)";
                e.currentTarget.style.boxShadow = "var(--focus-ring)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--ink-200)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); inputRef.current?.focus(); }}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "var(--ink-200)",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink-600)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
                aria-label="Effacer"
              >
                ×
              </button>
            )}
          </div>

          {/* Category tabs */}
          {!isSearching && (
            <div style={{ display: "flex", gap: 2, paddingBottom: 16 }}>
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                const count = categoryCounts[cat] ?? 0;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat);
                      setOpenModelId(null);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      height: 32,
                      padding: "0 14px",
                      borderRadius: "var(--r-pill)",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      fontFamily: "var(--font-text)",
                      background: isActive ? "var(--ink-800)" : "transparent",
                      color: isActive ? "white" : "var(--ink-600)",
                      transition: "background var(--dur-fast), color var(--dur-fast)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = "var(--ink-100)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {CATEGORY_LABELS[cat]}
                    {count > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          color: isActive ? "rgba(255,255,255,0.5)" : "var(--ink-400)",
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {isSearching && (
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-400)",
                fontFamily: "var(--font-mono)",
                paddingBottom: 14,
              }}
            >
              {searchResults.reduce((n, g) => n + g.models.length, 0)} référence
              {searchResults.reduce((n, g) => n + g.models.length, 0) > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* ── Liste scrollable ─────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            background: "white",
            borderTop: "1px solid var(--ink-100)",
          }}
        >
          {isLoading ? (
            <div
              style={{
                padding: "64px 24px",
                textAlign: "center",
                color: "var(--ink-400)",
                fontSize: 13,
              }}
            >
              Chargement…
            </div>
          ) : isSearching ? (
            searchResults.length === 0 ? (
              <div
                style={{
                  padding: "64px 24px",
                  textAlign: "center",
                  color: "var(--ink-400)",
                  fontSize: 13,
                }}
              >
                Aucun résultat pour «&nbsp;{search}&nbsp;»
              </div>
            ) : (
              searchResults.map((group) => (
                <CategorySection
                  key={group.category}
                  label={group.label}
                  models={group.models}
                  openModelId={openModelId}
                  onToggle={handleToggle}
                  onSelectColor={handleSelectColor}
                />
              ))
            )
          ) : singleCategoryModels.length === 0 ? (
            <div
              style={{
                padding: "64px 24px",
                textAlign: "center",
                color: "var(--ink-400)",
                fontSize: 13,
              }}
            >
              Aucune référence dans cette catégorie.
            </div>
          ) : (
            singleCategoryModels.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                isOpen={openModelId === model.id}
                onToggle={() => handleToggle(model.id)}
                onSelectColor={handleSelectColor}
              />
            ))
          )}
        </div>

        {/* ── Hint footer ──────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            padding: "10px 24px",
            borderTop: "1px solid var(--ink-100)",
            background: "var(--ink-50)",
            fontSize: 11,
            color: "var(--ink-400)",
          }}
        >
          Sélectionne un coloris pour ajouter cette référence à la commande
        </div>
      </div>
    </div>,
    document.body,
  );
}
