import { useMemo } from "react";
import { getCurrentUser } from "@/lib/currentUser";
import type { AssignedTo } from "@/lib/types";
import { AssigneeAvatar } from "../AssigneeAvatar";

type Slot = AssignedTo | "unassigned";

const SLOTS: Array<{ id: Slot; label: string }> = [
  { id: "L", label: "Loïc" },
  { id: "C", label: "Charlie" },
  { id: "M", label: "Mélina" },
  { id: "unassigned", label: "Non assigné" },
];

interface Props {
  value: Slot[];
  onChange: (updater: (prev: Slot[]) => Slot[]) => void;
}

/**
 * Filtre Assigné — affiche les 3 avatars opérateurs + "Non assigné" + raccourci
 * "Toi" lorsqu'un opérateur est connu via `getCurrentUser()` (localStorage).
 */
export function AssigneeFilter({ value, onChange }: Props) {
  const me = useMemo(() => getCurrentUser(), []);
  const meActive = me ? value.length === 1 && value[0] === me : false;

  function toggle(slot: Slot) {
    onChange((prev) => (prev.includes(slot) ? prev.filter((x) => x !== slot) : [...prev, slot]));
  }

  function pickMe() {
    if (!me) return;
    onChange((prev) => (prev.length === 1 && prev[0] === me ? [] : [me]));
  }

  return (
    <div
      role="group"
      aria-label="Assigné"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 32,
        padding: "0 4px 0 6px",
        borderRadius: 999,
        background: "var(--brand-paper-hi)",
        border: "1px solid var(--brand-sage-100)",
      }}
    >
      <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--fg-3)" }}>
        Assigné
      </span>
      {me && (
        <button
          type="button"
          onClick={pickMe}
          aria-pressed={meActive}
          title={`Toi — ${me}`}
          style={{
            height: 24,
            padding: "0 8px",
            borderRadius: 999,
            background: meActive ? "var(--brand-duck-500)" : "var(--brand-sage-50)",
            color: meActive ? "var(--fg-on-primary)" : "var(--fg-2)",
            border: "none",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            marginLeft: 2,
          }}
        >
          Toi
        </button>
      )}
      <span style={{ width: 1, height: 16, background: "var(--brand-sage-100)", margin: "0 2px" }} />
      {SLOTS.map((slot) => {
        const active = value.includes(slot.id);
        if (slot.id === "unassigned") {
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => toggle(slot.id)}
              aria-pressed={active}
              title="Non assigné"
              style={{
                height: 24,
                padding: "0 8px",
                borderRadius: 999,
                background: active ? "var(--brand-duck-500)" : "transparent",
                color: active ? "var(--fg-on-primary)" : "var(--fg-3)",
                border: active ? "none" : "1px dashed var(--brand-sage-100)",
                fontSize: 10.5,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Non assigné
            </button>
          );
        }
        return (
          <button
            key={slot.id}
            type="button"
            onClick={() => toggle(slot.id)}
            aria-pressed={active}
            title={slot.label}
            style={{
              width: 26,
              height: 26,
              padding: 0,
              borderRadius: "50%",
              background: "transparent",
              border: active ? "2px solid var(--brand-duck-500)" : "2px solid transparent",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AssigneeAvatar value={slot.id} size={20} />
          </button>
        );
      })}
    </div>
  );
}
