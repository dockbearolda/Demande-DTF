import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useCatalogTree } from "@/hooks/useCatalog";
import {
  buildFuseIndex,
  flattenCatalog,
  type FlatCatalogProduct,
} from "../lib/catalogIndex";

interface Props {
  onPick: (product: FlatCatalogProduct) => void;
  onUnknownReference?: (raw: string) => void;
}

export function RefSearchInput({ onPick, onUnknownReference }: Props) {
  const { data: tree } = useCatalogTree();
  const products = useMemo(() => flattenCatalog(tree), [tree]);
  const fuse = useMemo(() => buildFuseIndex(products), [products]);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query.trim(), { limit: 8 }).map((r) => r.item);
  }, [fuse, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => setActiveIdx(0), [query]);

  const commit = (p: FlatCatalogProduct) => {
    onPick(p);
    setQuery("");
    setOpen(false);
    setError(null);
    inputRef.current?.focus();
  };

  const tryCommitFromText = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (results.length > 0) {
      commit(results[activeIdx] ?? results[0]);
      return;
    }
    // Exact reference match (case-insensitive) as a fallback
    const exact = products.find(
      (p) => p.reference.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exact) {
      commit(exact);
      return;
    }
    setError(`Référence « ${trimmed} » introuvable au catalogue`);
    onUnknownReference?.(trimmed);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 12px",
          height: 44,
          background: "#fff",
          border: `1px solid ${error ? "var(--danger-500)" : "var(--ink-200)"}`,
          borderRadius: 10,
          boxShadow: open ? "var(--focus-ring)" : "none",
          transition: "box-shadow 140ms",
        }}
      >
        <Search size={16} color="var(--ink-500)" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              tryCommitFromText();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Référence catalogue (ex. TS-001) — Entrée pour ajouter"
          aria-label="Rechercher une référence catalogue"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 14,
            color: "var(--ink-900)",
            fontFamily: "var(--font-text)",
          }}
        />
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "var(--danger-500)",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {open && results.length > 0 && (
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
            borderRadius: 10,
            boxShadow: "var(--shadow-2)",
            padding: 4,
            margin: 0,
            listStyle: "none",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {results.map((p, i) => {
            const showHeader = i === 0 || p.subfamily !== results[i - 1].subfamily;
            return (
              <li key={p.id} style={{ listStyle: "none" }}>
                {showHeader && (
                  <div
                    style={{
                      padding: "6px 10px 3px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--ink-400)",
                      marginTop: i > 0 ? 4 : 0,
                      borderTop: i > 0 ? "1px solid var(--ink-100)" : "none",
                    }}
                  >
                    {p.subfamily}
                  </div>
                )}
                <div
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(p);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "7px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: i === activeIdx ? "rgba(74,98,116,0.08)" : "transparent",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--ink-900)",
                      minWidth: 60,
                    }}
                  >
                    {p.reference}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--ink-700)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      fontWeight: 700,
                      color: p.defaultPrice > 0 ? "var(--ink-900)" : "var(--ink-400)",
                    }}
                  >
                    {p.defaultPrice > 0
                      ? new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(p.defaultPrice)
                      : "—"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
