import { hasActiveFilters } from "../state/useListFilters";
import type { ListFilters } from "../types";
import { StatusFilter } from "./filters/StatusFilter";
import { SecteurFilter } from "./filters/SecteurFilter";
import { AssigneeFilter } from "./filters/AssigneeFilter";
import { ClientFilter } from "./filters/ClientFilter";
import { DateRangeFilter } from "./filters/DateRangeFilter";
import { UrgentToggle } from "./filters/UrgentToggle";
import { MoreFilters } from "./filters/MoreFilters";

interface Props {
  filters: ListFilters;
  patch: (
    p:
      | Partial<ListFilters>
      | ((prev: ListFilters) => Partial<ListFilters>),
  ) => void;
  onReset: () => void;
}

export function FiltersBar({ filters, patch, onReset }: Props) {
  const active = hasActiveFilters(filters);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        background: "var(--brand-paper)",
        border: "1px solid var(--brand-sage-100)",
        borderRadius: 12,
        boxShadow: "var(--shadow-1)",
      }}
    >
      <StatusFilter
        value={filters.statuts}
        onChange={(updater) => patch((prev) => ({ statuts: updater(prev.statuts) }))}
      />
      <SecteurFilter
        value={filters.secteurs}
        onChange={(updater) => patch((prev) => ({ secteurs: updater(prev.secteurs) }))}
      />
      <AssigneeFilter
        value={filters.assignes}
        onChange={(updater) => patch((prev) => ({ assignes: updater(prev.assignes) }))}
      />
      <ClientFilter
        value={filters.client_id}
        onChange={(client_id) => patch({ client_id })}
      />
      <DateRangeFilter
        value={filters.date}
        onChange={(date) => patch({ date })}
      />
      <UrgentToggle
        value={filters.urgent}
        onChange={(urgent) => patch({ urgent })}
      />
      <MoreFilters filters={filters} onChange={patch} />

      {active && (
        <button
          type="button"
          onClick={onReset}
          style={{
            marginLeft: "auto",
            height: 32,
            padding: "0 12px",
            borderRadius: 999,
            background: "transparent",
            color: "var(--fg-2)",
            border: "1px solid var(--brand-sage-100)",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}
