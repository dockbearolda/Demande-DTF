import { useMemo, useRef, useState } from "react";
import { useClients } from "@/hooks/useClients";
import type { Client } from "@/lib/types";
import { PillButton } from "../PillButton";
import { Popover } from "../Popover";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
}

const DIACRITICS = /[̀-ͯ]/g;
function norm(s: string) {
  return s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

/**
 * Variante "filtre" du combobox client — recherche par nom, sélection unique,
 * pas de création (la création vit dans le tunnel commande). Reprend la même
 * mécanique de scoring/normalisation pour rester familière à l'opérateur.
 */
export function ClientFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { data: clients = [] } = useClients();

  const selected: Client | null = useMemo(() => {
    if (!value) return null;
    return clients.find((c) => c.id === value) ?? null;
  }, [value, clients]);

  const matches = useMemo(() => {
    if (!q.trim()) return clients.slice(0, 30);
    const nq = norm(q);
    return clients
      .filter((c) => norm(c.nom).includes(nq))
      .sort((a, b) => {
        const ai = norm(a.nom).indexOf(nq);
        const bi = norm(b.nom).indexOf(nq);
        return ai - bi || a.nom.localeCompare(b.nom);
      })
      .slice(0, 30);
  }, [q, clients]);

  const label = selected ? `Client · ${selected.nom}` : "Client";

  return (
    <div style={{ position: "relative" }}>
      <PillButton
        ref={anchorRef}
        active={!!selected}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </PillButton>
      <Popover open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} minWidth={300}>
        <div style={{ padding: 4 }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tape un nom de client…"
            autoFocus
            style={{
              width: "100%",
              height: 34,
              padding: "0 10px",
              borderRadius: 7,
              border: "1px solid var(--brand-sage-100)",
              background: "white",
              fontSize: 12.5,
              color: "var(--fg-1)",
            }}
          />
          {selected && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "6px 10px",
                borderRadius: 6,
                background: "transparent",
                border: "none",
                color: "var(--brand-duck-500)",
                fontSize: 11.5,
                fontWeight: 600,
                textAlign: "left",
              }}
            >
              Effacer la sélection
            </button>
          )}
          <ul
            role="listbox"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              maxHeight: 280,
              overflowY: "auto",
              marginTop: 4,
            }}
          >
            {matches.length === 0 && (
              <li style={{ padding: "8px 10px", fontSize: 12, color: "var(--fg-3)" }}>
                Aucun client.
              </li>
            )}
            {matches.map((c) => {
              const active = c.id === value;
              return (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  style={{
                    cursor: "default",
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: active ? "rgba(107,129,145,0.10)" : "transparent",
                    color: "var(--fg-1)",
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "rgba(107,129,145,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {c.nom}
                </li>
              );
            })}
          </ul>
        </div>
      </Popover>
    </div>
  );
}
