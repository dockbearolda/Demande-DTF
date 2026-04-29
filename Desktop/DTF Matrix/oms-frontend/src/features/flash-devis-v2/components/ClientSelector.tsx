/**
 * Sélecteur de client minimaliste pour Devis Flash v2.
 *
 * Combobox avec recherche locale (filtre nom + email), liste filtrée
 * sous l'input. Pas d'option « créer un client » ici — la consigne est
 * d'attacher un client *existant*.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import type { Client } from "@/lib/types";

interface Props {
  value: string | null;
  onChange: (clientId: string | null) => void;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function ClientSelector({ value, onChange }: Props) {
  const { data: clients = [] } = useClients();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimerRef = useRef<number | null>(null);

  // Cancel any pending blur close-timer when this component unmounts.
  useEffect(() => {
    return () => {
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  const selected = useMemo<Client | null>(
    () => clients.find((c) => c.id === value) ?? null,
    [clients, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return clients.slice(0, 50);
    const q = normalize(query);
    return clients
      .filter(
        (c) =>
          normalize(c.nom).includes(q) ||
          (c.email != null && normalize(c.email).includes(q)),
      )
      .slice(0, 50);
  }, [clients, query]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {selected && !open ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid rgba(74,98,116,0.18)",
            background: "#fff",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-1)" }}>
              {selected.nom}
            </div>
            {selected.email && (
              <div style={{ fontSize: 11.5, color: "var(--fg-3)" }}>
                {selected.email}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
              setOpen(true);
            }}
            aria-label="Changer de client"
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid rgba(74,98,116,0.18)",
              background: "#fff",
              fontSize: 11.5,
              color: "var(--fg-2)",
              cursor: "pointer",
            }}
          >
            Changer
          </button>
        </div>
      ) : (
        <>
          <div style={{ position: "relative" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--fg-3)",
                pointerEvents: "none",
              }}
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                // Délai pour permettre le click dans la liste — le timer est
                // annulé si le composant est démonté avant.
                if (blurTimerRef.current !== null) {
                  window.clearTimeout(blurTimerRef.current);
                }
                blurTimerRef.current = window.setTimeout(() => {
                  setOpen(false);
                  blurTimerRef.current = null;
                }, 150);
              }}
              placeholder="Rechercher un client (nom, email)…"
              aria-label="Rechercher un client"
              style={{
                width: "100%",
                padding: "8px 32px 8px 30px",
                borderRadius: 8,
                border: "1px solid rgba(74,98,116,0.18)",
                fontSize: 13,
                background: "#fff",
                outline: "none",
              }}
            />
            {query && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQuery("")}
                aria-label="Effacer la recherche"
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  padding: 4,
                  border: "none",
                  background: "transparent",
                  color: "var(--fg-3)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          {open && (
            <ul
              role="listbox"
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                zIndex: 20,
                margin: 0,
                padding: 4,
                listStyle: "none",
                maxHeight: 240,
                overflowY: "auto",
                background: "#fff",
                border: "1px solid rgba(74,98,116,0.16)",
                borderRadius: 8,
                boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
              }}
            >
              {filtered.length === 0 ? (
                <li
                  style={{
                    padding: "10px 12px",
                    fontSize: 12.5,
                    color: "var(--fg-3)",
                  }}
                >
                  Aucun client trouvé.
                </li>
              ) : (
                filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(c.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        background: "transparent",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12.5,
                        color: "var(--fg-1)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "rgba(74,98,116,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "transparent";
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{c.nom}</div>
                      {c.email && (
                        <div style={{ fontSize: 11, color: "var(--fg-3)" }}>
                          {c.email}
                        </div>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
