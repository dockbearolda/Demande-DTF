"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./catalogue.module.css";

type Produit = {
  id: number;
  reference: string;
  designation: string;
  note1: string | null;
  note2: string | null;
  moq: number | null;
  stock: number | null;
  prixPublic: number | null;
  prixRevendeur: number | null;
  imageUrl: string | null;
  enLigne: boolean;
  categorieId: number;
};

type Categorie = {
  id: number;
  nom: string;
  slug: string;
  ordre: number;
  produits: Produit[];
};

type Famille = {
  id: number;
  nom: string;
  slug: string;
  strapline: string;
  resume: string;
  categories: Categorie[];
};

type EditingProduit = Partial<Produit> & { isNew?: boolean };

export function CatalogueAdmin() {
  const [familles, setFamilles] = useState<Famille[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFamilleId, setActiveFamilleId] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditingProduit | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/catalog");
    const data = await res.json() as { familles: Famille[] };
    setFamilles(data.familles ?? []);
    if (data.familles?.length && activeFamilleId === null) {
      setActiveFamilleId(data.familles[0].id);
    }
    setLoading(false);
  }, [activeFamilleId]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const activeFamille = familles.find((f) => f.id === activeFamilleId) ?? null;

  // Recherche globale
  const searchResults: Array<{ famille: Famille; categorie: Categorie; produit: Produit }> = [];
  if (search.trim().length >= 2) {
    const q = search.toLowerCase();
    for (const f of familles) {
      for (const c of f.categories) {
        for (const p of c.produits) {
          if (
            p.designation.toLowerCase().includes(q) ||
            p.reference.toLowerCase().includes(q)
          ) {
            searchResults.push({ famille: f, categorie: c, produit: p });
          }
        }
      }
    }
  }

  const handleSave = useCallback(async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.isNew) {
        await fetch("/api/admin/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing),
        });
        flash("✓ Produit créé");
      } else {
        await fetch("/api/admin/catalog", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing),
        });
        flash("✓ Sauvegardé");
      }
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  }, [editing, load]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm("Supprimer ce produit définitivement ?")) return;
    await fetch(`/api/admin/catalog?id=${id}`, { method: "DELETE" });
    flash("✓ Produit supprimé");
    await load();
  }, [load]);

  const handleToggle = useCallback(async (produit: Produit) => {
    await fetch("/api/admin/catalog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: produit.id, enLigne: !produit.enLigne }),
    });
    await load();
  }, [load]);

  const totalProduits = familles.reduce(
    (s, f) => s + f.categories.reduce((cs, c) => cs + c.produits.length, 0), 0,
  );

  if (loading) {
    return (
      <div className={styles.loading}>
        <span className={styles.spinner} />
        <p>Chargement du catalogue…</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Catalogue</h1>
          <p className={styles.sub}>{totalProduits} produits · {familles.length} familles</p>
        </div>
        <div className={styles.headerActions}>
          <a href="/admin" className={styles.backLink}>← Admin</a>
          <a href="/catalogue/tasses/tasse-ceramique-fuck" target="_blank" className={styles.previewLink}>
            Voir le site →
          </a>
        </div>
      </div>

      {msg && <div className={styles.flash}>{msg}</div>}

      {/* Recherche */}
      <input
        className={styles.search}
        type="text"
        placeholder="Rechercher un produit ou une référence…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Résultats de recherche */}
      {search.trim().length >= 2 ? (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{searchResults.length} résultat(s) pour « {search} »</h2>
          {searchResults.length === 0 ? (
            <p className={styles.empty}>Aucun produit trouvé.</p>
          ) : (
            <ProductTable
              produits={searchResults.map((r) => r.produit)}
              onEdit={setEditing}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          )}
        </div>
      ) : (
        <>
          {/* Onglets familles */}
          <div className={styles.familyTabs}>
            {familles.map((f) => (
              <button
                key={f.id}
                className={`${styles.familyTab} ${f.id === activeFamilleId ? styles.familyTabActive : ""}`}
                onClick={() => setActiveFamilleId(f.id)}
              >
                {f.nom}
              </button>
            ))}
          </div>

          {/* Famille active */}
          {activeFamille && (
            <div>
              {/* Info famille éditable */}
              <div className={styles.card}>
                <div className={styles.familleHeader}>
                  <div>
                    <span className={styles.familleNom}>{activeFamille.nom}</span>
                    <span className={styles.familleStrapline}>{activeFamille.strapline}</span>
                  </div>
                  <button
                    className={styles.editFamilleBtn}
                    onClick={() => setEditing({ id: activeFamille.id, designation: activeFamille.nom, note1: activeFamille.strapline, note2: activeFamille.resume } as EditingProduit & { _type: "famille" })}
                  >
                    Modifier textes
                  </button>
                </div>
              </div>

              {/* Catégories + produits */}
              {activeFamille.categories.map((cat) => (
                <div key={cat.id} className={styles.card}>
                  <div className={styles.catHeader}>
                    <h2 className={styles.catTitle}>{cat.nom}
                      <span className={styles.catCount}>{cat.produits.length}</span>
                    </h2>
                    <button
                      className={styles.addBtn}
                      onClick={() => setEditing({
                        isNew: true,
                        categorieId: cat.id,
                        enLigne: true,
                      })}
                    >
                      + Ajouter
                    </button>
                  </div>
                  <ProductTable
                    produits={cat.produits}
                    onEdit={setEditing}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal d'édition */}
      {editing && (
        <EditModal
          produit={editing}
          familles={familles}
          onChange={setEditing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ── ProductTable ──────────────────────────────────────────────────

function ProductTable({
  produits,
  onEdit,
  onDelete,
  onToggle,
}: {
  produits: Produit[];
  onEdit: (p: EditingProduit) => void;
  onDelete: (id: number) => void;
  onToggle: (p: Produit) => void;
}) {
  if (produits.length === 0) return <p className={styles.empty}>Aucun produit.</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Réf.</th>
            <th>Désignation</th>
            <th>Prix achat</th>
            <th>Prix vente</th>
            <th>MOQ</th>
            <th>Stock</th>
            <th>Image</th>
            <th>Ligne</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {produits.map((p) => (
            <tr key={p.id} className={!p.enLigne ? styles.rowOff : ""}>
              <td className={styles.tdRef}>{p.reference}</td>
              <td className={styles.tdLabel}>
                <span>{p.designation}</span>
                {p.note1 && <small className={styles.note}>{p.note1}</small>}
                {p.note2 && <small className={styles.note}>{p.note2}</small>}
              </td>
              <td>{p.prixRevendeur != null ? `${p.prixRevendeur} €` : "—"}</td>
              <td>{p.prixPublic != null ? `${p.prixPublic} €` : "—"}</td>
              <td>{p.moq ?? "—"}</td>
              <td>{p.stock ?? "—"}</td>
              <td className={styles.tdImg}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" width={36} height={36} style={{ objectFit: "cover", borderRadius: 4 }} />
                ) : "—"}
              </td>
              <td>
                <button
                  className={p.enLigne ? styles.toggleOn : styles.toggleOff}
                  onClick={() => onToggle(p)}
                  title={p.enLigne ? "En ligne" : "Hors ligne"}
                >
                  {p.enLigne ? "✓" : "✗"}
                </button>
              </td>
              <td className={styles.tdActions}>
                <button className={styles.editBtn} onClick={() => onEdit({ ...p })}>Modifier</button>
                <button className={styles.delBtn} onClick={() => onDelete(p.id)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── EditModal ─────────────────────────────────────────────────────

function EditModal({
  produit,
  familles,
  onChange,
  onSave,
  onClose,
  saving,
}: {
  produit: EditingProduit;
  familles: Famille[];
  onChange: (p: EditingProduit) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const set = (field: keyof EditingProduit, value: unknown) =>
    onChange({ ...produit, [field]: value });

  const allCategories = familles.flatMap((f) =>
    f.categories.map((c) => ({ ...c, familleNom: f.nom })),
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{produit.isNew ? "Nouveau produit" : "Modifier le produit"}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.formGrid}>
            <label className={styles.fieldLabel}>
              Référence *
              <input className={styles.input} value={produit.reference ?? ""} onChange={(e) => set("reference", e.target.value)} required />
            </label>
            <label className={styles.fieldLabel}>
              Désignation *
              <input className={styles.input} value={produit.designation ?? ""} onChange={(e) => set("designation", e.target.value)} required />
            </label>
            <label className={styles.fieldLabel}>
              Prix achat B2B (€)
              <input className={styles.input} type="number" step="0.01" min="0" value={produit.prixRevendeur ?? ""} onChange={(e) => set("prixRevendeur", e.target.value ? parseFloat(e.target.value) : null)} />
            </label>
            <label className={styles.fieldLabel}>
              Prix vente conseillé (€)
              <input className={styles.input} type="number" step="0.01" min="0" value={produit.prixPublic ?? ""} onChange={(e) => set("prixPublic", e.target.value ? parseFloat(e.target.value) : null)} />
            </label>
            <label className={styles.fieldLabel}>
              Quantité minimale (MOQ)
              <input className={styles.input} type="number" min="1" value={produit.moq ?? ""} onChange={(e) => set("moq", e.target.value ? parseInt(e.target.value) : null)} />
            </label>
            <label className={styles.fieldLabel}>
              Stock
              <input className={styles.input} type="number" min="0" value={produit.stock ?? ""} onChange={(e) => set("stock", e.target.value ? parseInt(e.target.value) : null)} />
            </label>
            <label className={styles.fieldLabel} style={{ gridColumn: "1/-1" }}>
              URL image (lien Cloudinary, Google Drive, etc.)
              <input className={styles.input} type="url" placeholder="https://res.cloudinary.com/..." value={produit.imageUrl ?? ""} onChange={(e) => set("imageUrl", e.target.value || null)} />
            </label>
            <label className={styles.fieldLabel} style={{ gridColumn: "1/-1" }}>
              Note 1 (ex: "Choix de designs en fonction du stock")
              <input className={styles.input} value={produit.note1 ?? ""} onChange={(e) => set("note1", e.target.value || null)} />
            </label>
            <label className={styles.fieldLabel} style={{ gridColumn: "1/-1" }}>
              Note 2 (ex: "350 ml")
              <input className={styles.input} value={produit.note2 ?? ""} onChange={(e) => set("note2", e.target.value || null)} />
            </label>
            <label className={styles.fieldLabel}>
              Catégorie
              <select className={styles.input} value={produit.categorieId ?? ""} onChange={(e) => set("categorieId", parseInt(e.target.value))}>
                <option value="">— Choisir —</option>
                {allCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.familleNom} / {c.nom}</option>
                ))}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              Statut
              <select className={styles.input} value={produit.enLigne ? "1" : "0"} onChange={(e) => set("enLigne", e.target.value === "1")}>
                <option value="1">En ligne</option>
                <option value="0">Hors ligne</option>
              </select>
            </label>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Annuler</button>
          <button className={styles.saveBtn} onClick={onSave} disabled={saving}>
            {saving ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
