import { useEffect, useMemo, useRef, useState } from "react";
import { useClients } from "@/hooks/useClients";
import { useFlashQuoteStore } from "../store";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export function ClientFields() {
  const client = useFlashQuoteStore((s) => s.client);
  const setClient = useFlashQuoteStore((s) => s.setClient);
  const emittedAt = useFlashQuoteStore((s) => s.emittedAt);
  const validUntil = useFlashQuoteStore((s) => s.validUntil);
  const setEmittedAt = useFlashQuoteStore((s) => s.setEmittedAt);
  const setValidUntil = useFlashQuoteStore((s) => s.setValidUntil);

  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 200);
  const { data: clients = [] } = useClients(debounced || undefined);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => clients.slice(0, 8), [clients]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div ref={wrapRef} style={{ position: "relative" }}>
        <Label>Client</Label>
        <input
          value={client.nom || search}
          onChange={(e) => {
            setSearch(e.target.value);
            setClient({ nom: e.target.value });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Nom du client (rechercher dans la base)"
          style={fieldStyle}
        />
        {open && filtered.length > 0 && (
          <ul
            role="listbox"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 30,
              background: "#fff",
              border: "1px solid var(--ink-200)",
              borderRadius: 8,
              boxShadow: "var(--shadow-2)",
              padding: 4,
              margin: 0,
              listStyle: "none",
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {filtered.map((c) => (
              <li
                key={c.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setClient({
                    nom: c.nom,
                    email: c.email ?? "",
                    telephone: c.telephone ?? "",
                    adresse: c.adresse ?? "",
                  });
                  setSearch("");
                  setOpen(false);
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(74,98,116,0.08)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ fontWeight: 600, color: "var(--ink-900)" }}>{c.nom}</div>
                {c.email && (
                  <div style={{ fontSize: 11, color: "var(--ink-500)" }}>
                    {c.email}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <Label>Email</Label>
          <input
            type="email"
            value={client.email}
            onChange={(e) => setClient({ email: e.target.value })}
            placeholder="client@exemple.fr"
            style={fieldStyle}
          />
        </div>
        <div>
          <Label>Téléphone</Label>
          <input
            type="tel"
            value={client.telephone}
            onChange={(e) => setClient({ telephone: e.target.value })}
            placeholder="+33 …"
            style={fieldStyle}
          />
        </div>
      </div>

      <div>
        <Label>Adresse</Label>
        <input
          value={client.adresse}
          onChange={(e) => setClient({ adresse: e.target.value })}
          placeholder="Rue, code postal, ville"
          style={fieldStyle}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <Label>Date d'émission</Label>
          <input
            type="date"
            value={emittedAt}
            onChange={(e) => setEmittedAt(e.target.value)}
            style={fieldStyle}
          />
        </div>
        <div>
          <Label>Date de validité</Label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            style={fieldStyle}
          />
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--ink-500)",
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  border: "1px solid var(--ink-200)",
  borderRadius: 8,
  background: "#fff",
  fontSize: 13,
  fontFamily: "var(--font-text)",
  color: "var(--ink-900)",
  outline: "none",
};
