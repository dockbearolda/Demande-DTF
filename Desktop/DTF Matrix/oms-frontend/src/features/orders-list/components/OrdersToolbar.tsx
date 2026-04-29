import type { ColumnId, Density, ListFilters, SavedView, SortRule } from "../types";
import type { ListSummary } from "../state/filterOrders";
import { ColumnsMenu } from "./ColumnsMenu";
import { SaveViewMenu } from "./SaveViewMenu";

interface Props {
  summary: ListSummary;
  density: Density;
  onDensityChange: (d: Density) => void;
  columns: ColumnId[];
  onColumnsChange: (next: ColumnId[]) => void;
  views: SavedView[];
  snapshot: { filters: ListFilters; sort: SortRule[]; columns: ColumnId[] };
  onSaveView: (
    name: string,
    snapshot: { filters: ListFilters; sort: SortRule[]; columns: ColumnId[] },
  ) => SavedView;
  onApplyView: (view: SavedView) => void;
  onDeleteView: (id: string) => void;
  onCreateOrder: () => void;
}

const FORMAT_EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function OrdersToolbar({
  summary,
  density,
  onDensityChange,
  columns,
  onColumnsChange,
  views,
  snapshot,
  onSaveView,
  onApplyView,
  onDeleteView,
  onCreateOrder,
}: Props) {
  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        rowGap: 10,
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 280px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.015em",
            color: "var(--fg-1)",
          }}
        >
          Commandes
        </h1>
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 12.5,
            color: "var(--fg-3)",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            <strong style={{ color: "var(--fg-1)", fontWeight: 700 }}>{summary.count}</strong>{" "}
            commande{summary.count > 1 ? "s" : ""}
          </span>
          <Sep />
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              color: summary.urgent > 0 ? "var(--color-urgent-ink)" : "var(--fg-3)",
              fontWeight: summary.urgent > 0 ? 600 : 500,
            }}
          >
            <strong style={{ fontWeight: 700 }}>{summary.urgent}</strong>{" "}
            urgente{summary.urgent > 1 ? "s" : ""}
          </span>
          <Sep />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            <strong style={{ color: "var(--fg-1)", fontWeight: 700 }}>
              {FORMAT_EUR.format(summary.totalAmount)}
            </strong>{" "}
            TTC en cours
          </span>
        </p>
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <DensityToggle value={density} onChange={onDensityChange} />
        <ColumnsMenu visible={columns} onChange={onColumnsChange} />
        <SaveViewMenu
          views={views}
          snapshot={snapshot}
          onSave={onSaveView}
          onApply={onApplyView}
          onDelete={onDeleteView}
        />
        <button
          type="button"
          onClick={onCreateOrder}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 36,
            padding: "0 14px 0 14px",
            borderRadius: 8,
            background: "var(--brand-duck-500)",
            color: "var(--fg-on-primary)",
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "-0.005em",
            boxShadow: "var(--shadow-1)",
          }}
        >
          + Nouvelle demande
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "1px 6px",
              borderRadius: 5,
              background: "rgba(255,255,255,0.18)",
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.04em",
              fontFamily: '-apple-system, "SF Mono", ui-monospace, monospace',
            }}
          >
            ⌘N
          </span>
        </button>
      </div>
    </header>
  );
}

function Sep() {
  return <span aria-hidden="true" style={{ opacity: 0.4 }}>·</span>;
}

function DensityToggle({
  value,
  onChange,
}: {
  value: Density;
  onChange: (d: Density) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Densité"
      style={{
        display: "inline-flex",
        height: 32,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--brand-sage-100)",
        background: "var(--brand-paper-hi)",
      }}
    >
      {(["compact", "comfort"] as const).map((d) => {
        const sel = value === d;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            aria-pressed={sel}
            style={{
              padding: "0 12px",
              border: "none",
              background: sel ? "var(--brand-duck-500)" : "transparent",
              color: sel ? "var(--fg-on-primary)" : "var(--fg-2)",
              fontSize: 12,
              fontWeight: sel ? 600 : 500,
              minWidth: 64,
            }}
          >
            {d === "compact" ? "Compact" : "Confort"}
          </button>
        );
      })}
    </div>
  );
}
