import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Search, ChevronRight } from "lucide-react";
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
  return h === "#ffffff" || h === "#fff" || h === "#ffffffff";
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

// ─── ColorCard ───────────────────────────────────────────────────────────────

function ColorCard({ color }: { color: SupplierColorDTO }) {
  const hex = resolveHex(color);
  const hasBorder = isNearWhite(hex);
  const frontMockup = color.mockups.find((m) => m.view === "front" && !m.is_lifestyle);
  const mockupUrl = frontMockup ? absoluteMockupUrl(frontMockup.url) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 10,
          overflow: "hidden",
          background: hex,
          border: hasBorder ? "1px solid var(--ink-200)" : "1px solid rgba(0,0,0,0.07)",
          flexShrink: 0,
        }}
      >
        {mockupUrl && (
          <img
            src={mockupUrl}
            alt={color.label}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            loading="lazy"
          />
        )}
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--ink-600)",
          textAlign: "center",
          lineHeight: 1.3,
          width: 72,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {color.label}
      </span>
    </div>
  );
}

// ─── ModelRow ────────────────────────────────────────────────────────────────

function ModelRow({
  model,
  isOpen,
  onToggle,
}: {
  model: SupplierModelDTO;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const enabledColors = useMemo(
    () => model.colors.filter((c) => c.enabled).sort((a, b) => a.position - b.position),
    [model.colors],
  );
  const previewColors = enabledColors.slice(0, 9);
  const extra = enabledColors.length - previewColors.length;

  return (
    <div style={{ borderBottom: "1px solid var(--ink-100)" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          width: "100%",
          padding: "15px 24px",
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
        {/* Ref code */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--ink-400)",
            letterSpacing: "0.04em",
            minWidth: 68,
            flexShrink: 0,
          }}
        >
          {model.ref_internal}
        </span>

        {/* Name block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink-800)",
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.01em",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {model.brand && (
              <span style={{ color: "var(--ink-400)", fontWeight: 500 }}>
                {model.brand}
                {" · "}
              </span>
            )}
            {model.name ?? model.ref_label}
          </div>
          {(model.fabric_weight_gsm || model.fabric_composition || model.fit_type) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 3,
              }}
            >
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
              {model.fit_type && (
                <span style={{ fontSize: 11, color: "var(--ink-400)" }}>
                  {model.fit_type}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Swatch preview */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            flexShrink: 0,
          }}
        >
          {previewColors.map((c) => {
            const hex = resolveHex(c);
            const border = isNearWhite(hex);
            return (
              <span
                key={c.id}
                title={c.label}
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: hex,
                  border: border ? "1px solid var(--ink-200)" : "1px solid transparent",
                  flexShrink: 0,
                }}
              />
            );
          })}
          {extra > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--ink-400)",
                fontFamily: "var(--font-mono)",
                marginLeft: 3,
              }}
            >
              +{extra}
            </span>
          )}
          <span
            style={{
              fontSize: 11,
              color: "var(--ink-300)",
              fontFamily: "var(--font-mono)",
              marginLeft: 6,
              minWidth: 40,
            }}
          >
            {enabledColors.length} col.
          </span>
        </div>

        {/* Chevron */}
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
        <div
          style={{
            padding: "4px 24px 28px",
            background: "var(--ink-25)",
          }}
        >
          <div
            style={{
              height: 1,
              background: "var(--ink-100)",
              marginBottom: 24,
            }}
          />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            {enabledColors.map((color) => (
              <ColorCard key={color.id} color={color} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category section (used when searching across all) ────────────────────────

function CategorySection({
  label,
  models,
  openModelId,
  onToggle,
}: {
  label: string;
  models: SupplierModelDTO[];
  openModelId: string | null;
  onToggle: (id: string) => void;
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
        />
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function SupplierCatalogPage() {
  const { data, isLoading } = useSupplierCatalog();
  const [activeCategory, setActiveCategory] = useState<Category>("HOMME");
  const [search, setSearch] = useState("");
  const [openModelId, setOpenModelId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" shortcut focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const isSearching = search.trim().length > 0;

  // When not searching → single category
  const singleCategoryModels = useMemo(() => {
    if (!data) return [];
    const cat = data.categories.find((c) => c.category === activeCategory);
    if (!cat) return [];
    return cat.models
      .filter((m) => m.enabled)
      .sort((a, b) => a.position - b.position);
  }, [data, activeCategory]);

  // When searching → all categories, filtered
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

  const totalSearchResults = searchResults.reduce((n, g) => n + g.models.length, 0);

  const handleToggle = useCallback((id: string) => {
    setOpenModelId((prev) => (prev === id ? null : id));
  }, []);

  const categoryCounts = useMemo(() => {
    if (!data) return {} as Record<string, number>;
    return Object.fromEntries(
      data.categories.map((c) => [c.category, c.models.filter((m) => m.enabled).length]),
    );
  }, [data]);

  return (
    <div
      style={{
        maxWidth: 920,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        paddingBottom: 48,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--ink-900)",
            letterSpacing: "-0.02em",
            marginBottom: 14,
          }}
        >
          Catalogue fournisseur
        </h1>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 480 }}>
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
      </div>

      {/* ── Category tabs ───────────────────────────────────────── */}
      {!isSearching && (
        <div
          style={{
            display: "flex",
            gap: 2,
            marginBottom: 16,
          }}
        >
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
                  height: 34,
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
                      color: isActive ? "rgba(255,255,255,0.55)" : "var(--ink-400)",
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

      {/* ── Content ─────────────────────────────────────────────── */}
      <div
        style={{
          background: "white",
          borderRadius: "var(--r-4)",
          border: "1px solid var(--ink-100)",
          overflow: "hidden",
          boxShadow: "var(--shadow-1)",
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
            <>
              {searchResults.map((group) => (
                <CategorySection
                  key={group.category}
                  label={group.label}
                  models={group.models}
                  openModelId={openModelId}
                  onToggle={handleToggle}
                />
              ))}
              <div
                style={{
                  padding: "12px 24px",
                  fontSize: 11,
                  color: "var(--ink-300)",
                  fontFamily: "var(--font-mono)",
                  borderTop: "1px solid var(--ink-100)",
                  background: "var(--ink-25)",
                }}
              >
                {totalSearchResults} référence{totalSearchResults > 1 ? "s" : ""} trouvée{totalSearchResults > 1 ? "s" : ""}
              </div>
            </>
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
            />
          ))
        )}
      </div>

      {/* Stats footer */}
      {!isLoading && data && !isSearching && (
        <div
          style={{
            display: "flex",
            gap: 20,
            paddingTop: 12,
          }}
        >
          {[
            { label: "modèles", value: data.total_models },
            { label: "coloris", value: data.total_colors },
            { label: "visuels", value: data.total_mockups },
          ].map(({ label, value }) => (
            <span
              key={label}
              style={{
                fontSize: 11,
                color: "var(--ink-300)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {value} {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
