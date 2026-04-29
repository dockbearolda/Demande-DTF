import { useEffect, useState, type ReactNode } from "react";
import { OPERATEURS } from "@/features/new-order/constants";
import {
  getCurrentUser,
  setCurrentUser,
  subscribeCurrentUser,
} from "@/lib/currentUser";
import type { OperatorValue } from "@/features/new-order/types";

interface Props {
  children: ReactNode;
}

export function SessionGate({ children }: Props) {
  const [user, setUser] = useState<OperatorValue | null>(() => getCurrentUser());

  // Re-sync when current user changes (logout / switch from another component).
  useEffect(() => subscribeCurrentUser(() => setUser(getCurrentUser())), []);

  if (user) {
    return <>{children}</>;
  }

  function handlePick(v: OperatorValue) {
    setCurrentUser(v);
    setUser(v);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sélection de l'opérateur"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at top, rgba(74,98,116,0.10), rgba(244,244,242,1) 70%)",
      }}
    >
      <div
        style={{
          width: "min(420px, 92vw)",
          padding: "32px 28px",
          borderRadius: 18,
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(74,98,116,0.14)",
          boxShadow:
            "0 28px 80px -24px rgba(15,23,42,0.32), 0 8px 24px -12px rgba(15,23,42,0.16)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "var(--fg-1)",
            letterSpacing: "-0.01em",
          }}
        >
          Qui ouvre la session ?
        </h1>
        <p
          style={{
            marginTop: 8,
            marginBottom: 22,
            fontSize: 13,
            color: "var(--fg-3)",
            lineHeight: 1.45,
          }}
        >
          Toutes les commandes créées sur ce poste seront automatiquement
          assignées à cette personne.
        </p>

        <div
          role="radiogroup"
          aria-label="Opérateur"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {OPERATEURS.map((op) => (
            <button
              key={op.value}
              type="button"
              role="radio"
              aria-checked={user === op.value}
              onClick={() => handlePick(op.value)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                height: 56,
                padding: "0 14px",
                borderRadius: 12,
                border: "2px solid rgba(148,163,184,0.35)",
                background: "white",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--fg-1)",
                textAlign: "left",
                transition:
                  "border-color 150ms, background 150ms, transform 80ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(74,98,116,0.55)";
                e.currentTarget.style.background = "rgba(248,250,252,1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(148,163,184,0.35)";
                e.currentTarget.style.background = "white";
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.98)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, var(--brand-duck-300), var(--brand-duck-500))",
                  color: "var(--fg-on-primary)",
                  fontSize: 13,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {op.initial}
              </span>
              <span>{op.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
