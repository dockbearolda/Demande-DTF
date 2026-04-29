import type { ReactNode } from "react";

interface Props {
  variant: "no-orders" | "no-results";
  /** Chips effaçables des filtres actifs — uniquement variant `no-results`. */
  activeFilterChips?: Array<{ label: string; onClear: () => void }>;
  onCreate?: () => void;
  onReset?: () => void;
}

function IconBox() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 14l16-8 16 8v20l-16 8-16-8V14z" />
      <path d="M8 14l16 8 16-8" />
      <path d="M24 22v20" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 44 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8h32M11 18h22M16 28h12M19 38h6" />
    </svg>
  );
}

function ChipX({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 26,
        padding: "0 10px",
        borderRadius: 999,
        background: "var(--brand-sage-50)",
        color: "var(--fg-2)",
        border: "1px solid var(--brand-sage-100)",
        fontSize: 11.5,
        fontWeight: 500,
      }}
    >
      <span>{label}</span>
      <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1, color: "var(--fg-4)" }}>
        ✕
      </span>
    </button>
  );
}

function Wrap({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px",
        textAlign: "center",
        color: "var(--fg-3)",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  variant,
  activeFilterChips,
  onCreate,
  onReset,
}: Props) {
  if (variant === "no-orders") {
    return (
      <Wrap>
        <span style={{ color: "var(--fg-4)" }}>
          <IconBox />
        </span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--fg-1)" }}>
          Aucune commande pour le moment
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)", maxWidth: 320 }}>
          Crée ta première commande pour la voir apparaître ici.
        </p>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            style={{
              marginTop: 8,
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              background: "var(--brand-duck-500)",
              color: "var(--fg-on-primary)",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            + Nouvelle demande
          </button>
        )}
      </Wrap>
    );
  }

  return (
    <Wrap>
      <span style={{ color: "var(--fg-4)" }}>
        <IconFilter />
      </span>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--fg-1)" }}>
        Aucune commande ne correspond à vos filtres
      </h3>
      {activeFilterChips && activeFilterChips.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 6,
            maxWidth: 460,
          }}
        >
          {activeFilterChips.map((c, i) => (
            <ChipX key={i} label={c.label} onClear={c.onClear} />
          ))}
        </div>
      )}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          style={{
            marginTop: 4,
            height: 32,
            padding: "0 14px",
            borderRadius: 8,
            background: "var(--brand-paper-hi)",
            color: "var(--fg-2)",
            border: "1px solid var(--brand-sage-100)",
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          Réinitialiser les filtres
        </button>
      )}
    </Wrap>
  );
}
