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
  step: number | null;
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
  accent: string;
  surface: string;
  categories: Categorie[];
};

type EditingProduit = Partial<Produit> & { isNew?: boolean };
type EditingFamille = Partial<Famille> & { isNew?: boolean };
type EditingCategorie = Partial<Categorie> & { isNew?: boolean; familleId?: number };

export function CatalogueAdmin() {
  const [familles, setFamilles] = useState<Famille[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFamilleId, setActiveFamilleId] = useState<number | null>(null);
  const [editingProduit, setEditingProduit] = useState<EditingProduit | null>(null);
  const [editingFamille, setEditingFamille] = useState<EditingFamille | null>(null);
  const [editingCategorie, setEditingCategorie] = useState<EditingCategorie | null>(null);
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
          if (p.designation.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)) {
            searchResults.push({ famille: f, categorie: c, produit: p });
          }
        }
      }
    }
  }

  // ── Produit ──────────────────────────────────────────────────────
  const handleSaveProduit = useCallback(async () => {
    if (!editingProduit) return;
    setSaving(true);
    try {
      if (editingProduit.isNew) {
        await fetch("/api/admin/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingProduit),
        });
        flash("✓ Produit créé");
      } else {
        await fetch("/api/admin/catalog", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingProduit),
        });
        flash("✓ Sauvegardé");
      }
      setEditingProduit(null);
      await load();
    } finally {
      setSaving(false);
    }
  }, [editingProduit, load]);

  const handleDeleteProduit = useCallback(async (id: number) => {
    if (!confirm("Supprimer ce produit définitivement ?")) return;
    await fetch(`/api/admin/catalog?id=${id}&type=produit`, { method: "DELETE" });
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

  // ── Famille ──────────────────────────────────────────────────────
  const handleSaveFamille = useCallback(async () => {
    if (!editingFamille) return;
    setSaving(true);
    try {
      if (editingFamille.isNew) {
        const res = await fetch("/api/admin/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "famille", ...editingFamille }),
        });
        const data = await res.json() as { famille: Famille };
        flash("✓ Famille créée");
        await load();
        setActiveFamilleId(data.famille.id);
      } else {
        await fetch("/api/admin/catalog", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "famille", ...editingFamille }),
        });
        flash("✓ Famille mise à jour");
        await load();
      }
      setEditingFamille(null);
    } finally {
      setSaving(false);
    }
  }, [editingFamille, load]);

  const handleDeleteFamille = useCallback(async (id: number, nom: string) => {
    if (!confirm(`Supprimer la famille "${nom}" et tous ses produits ? Cette action est irréversible.`)) return;
    await fetch(`/api/admin/catalog?id=${id}&type=famille`, { method: "DELETE" });
    flash("✓ Famille supprimée");
    setActiveFamilleId(null);
    await load();
  }, [load]);

  // ── Catégorie ────────────────────────────────────────────────────
  const handleSaveCategorie = useCallback(async () => {
    if (!editingCategorie) return;
    setSaving(true);
    try {
      if (editingCategorie.isNew) {
        await fetch("/api/admin/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "categorie", ...editingCategorie }),
        });
        flash("✓ Catégorie créée");
      } else {
        await fetch("/api/admin/catalog", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "categorie", ...editingCategorie }),
        });
        flash("✓ Catégorie mise à jour");
      }
      setEditingCategorie(null);
      await load();
    } finally {
      setSaving(false);
    }
  }, [editingCategorie, load]);

  const handleDeleteCategorie = useCallback(async (id: number, nom: string) => {
    if (!confirm(`Supprimer la catégorie "${nom}" et tous ses produits ?`)) return;
    await fetch(`/api/admin/catalog?id=${id}&type=categorie`, { method: "DELETE" });
    flash("✓ Catégorie supprimée");
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
          <button
            className={styles.newFamilleBtn}
            onClick={() => setEditingFamille({ isNew: true, accent: "#dbe7ff", surface: "rgba(219, 231, 255, 0.68)" })}
          >
            + Nouvelle famille
          </button>
          <a href="/admin" className={styles.backLink}>← Admin</a>
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
              onEdit={setEditingProduit}
              onDelete={handleDeleteProduit}
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

          {familles.length === 0 && (
            <div className={styles.card}>
              <p className={styles.empty}>Aucune famille. Cliquez sur « + Nouvelle famille » pour commencer.</p>
            </div>
          )}

          {/* Famille active */}
          {activeFamille && (
            <div>
              {/* Info famille */}
              <div className={styles.card}>
                <div className={styles.familleHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 16, height: 16, borderRadius: 4,
                        background: activeFamille.accent, border: "1px solid #ddd", flexShrink: 0
                      }}
                    />
                    <div>
                      <span className={styles.familleNom}>{activeFamille.nom}</span>
                      {activeFamille.strapline && (
                        <span className={styles.familleStrapline}>{activeFamille.strapline}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className={styles.editFamilleBtn}
                      onClick={() => setEditingFamille({ ...activeFamille })}
                    >
                      Modifier
                    </button>
                    <button
                      className={styles.delFamilleBtn}
                      onClick={() => handleDeleteFamille(activeFamille.id, activeFamille.nom)}
                    >
                      Supprimer famille
                    </button>
                  </div>
                </div>
                {activeFamille.resume && (
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#666" }}>{activeFamille.resume}</p>
                )}
              </div>

              {/* Catégories + produits */}
              {activeFamille.categories.map((cat) => (
                <div key={cat.id} className={styles.card}>
                  <div className={styles.catHeader}>
                    <h2 className={styles.catTitle}>
                      {cat.nom}
                      <span className={styles.catCount}>{cat.produits.length}</span>
                    </h2>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className={styles.editFamilleBtn}
                        onClick={() => setEditingCategorie({ ...cat, familleId: activeFamille.id })}
                      >
                        Renommer
                      </button>
                      <button
                        className={styles.addBtn}
                        onClick={() => setEditingProduit({ isNew: true, categorieId: cat.id, enLigne: true })}
                      >
                        + Produit
                      </button>
                      <button
                        className={styles.delBtn}
                        onClick={() => handleDeleteCategorie(cat.id, cat.nom)}
                        title="Supprimer cette catégorie"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <ProductTable
                    produits={cat.produits}
                    onEdit={setEditingProduit}
                    onDelete={handleDeleteProduit}
                    onToggle={handleToggle}
                  />
                </div>
              ))}

              {/* Nouvelle catégorie */}
              <button
                className={styles.newCatBtn}
                onClick={() => setEditingCategorie({ isNew: true, familleId: activeFamille.id })}
              >
                + Nouvelle catégorie dans « {activeFamille.nom} »
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal produit */}
      {editingProduit && (
        <ProduitModal
          produit={editingProduit}
          familles={familles}
          onChange={setEditingProduit}
          onSave={handleSaveProduit}
          onClose={() => setEditingProduit(null)}
          saving={saving}
        />
      )}

      {/* Modal famille */}
      {editingFamille && (
        <FamilleModal
          famille={editingFamille}
          onChange={setEditingFamille}
          onSave={handleSaveFamille}
          onClose={() => setEditingFamille(null)}
          saving={saving}
        />
      )}

      {/* Modal catégorie */}
      {editingCategorie && (
        <CategorieModal
          categorie={editingCategorie}
          onChange={setEditingCategorie}
          onSave={handleSaveCategorie}
          onClose={() => setEditingCategorie(null)}
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
  if (produits.length === 0) return <p className={styles.empty}>Aucun produit. Cliquez sur « + Produit » pour en ajouter.</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Réf.</th>
            <th>Désignation</th>
            <th>Prix achat</th>
            <th>Prix vente</th>
            <th>Coef ×</th>
            <th>MOQ</th>
            <th>Step</th>
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
              <td>
                {p.prixRevendeur && p.prixPublic && p.prixRevendeur > 0 ? (
                  <span style={{
                    display: "inline-block",
                    padding: "2px 7px",
                    borderRadius: 6,
                    background: "rgba(5,150,105,0.10)",
                    color: "#059669",
                    fontWeight: 700,
                    fontSize: 12,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    ×{(p.prixPublic / p.prixRevendeur).toFixed(3)}
                  </span>
                ) : "—"}
              </td>
              <td>{p.moq ?? "—"}</td>
              <td>{p.step ?? "—"}</td>
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
                  title={p.enLigne ? "En ligne — cliquer pour désactiver" : "Hors ligne — cliquer pour activer"}
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

// ── ProduitModal ──────────────────────────────────────────────────

function ProduitModal({
  produit, familles, onChange, onSave, onClose, saving,
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
              Incrément (step)
              <input className={styles.input} type="number" min="1" value={produit.step ?? ""} onChange={(e) => set("step", e.target.value ? parseInt(e.target.value) : null)} />
            </label>
            <label className={styles.fieldLabel}>
              Stock
              <input className={styles.input} type="number" min="0" value={produit.stock ?? ""} onChange={(e) => set("stock", e.target.value ? parseInt(e.target.value) : null)} />
            </label>
            <label className={styles.fieldLabel} style={{ gridColumn: "1/-1" }}>
              URL image
              <input className={styles.input} type="url" placeholder="https://..." value={produit.imageUrl ?? ""} onChange={(e) => set("imageUrl", e.target.value || null)} />
            </label>
            <label className={styles.fieldLabel} style={{ gridColumn: "1/-1" }}>
              Note 1
              <input className={styles.input} value={produit.note1 ?? ""} onChange={(e) => set("note1", e.target.value || null)} />
            </label>
            <label className={styles.fieldLabel} style={{ gridColumn: "1/-1" }}>
              Note 2
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

// ── FamilleModal ──────────────────────────────────────────────────

function FamilleModal({
  famille, onChange, onSave, onClose, saving,
}: {
  famille: EditingFamille;
  onChange: (f: EditingFamille) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const set = (field: keyof EditingFamille, value: unknown) =>
    onChange({ ...famille, [field]: value });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{famille.isNew ? "Nouvelle famille" : `Modifier « ${famille.nom} »`}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formGrid}>
            <label className={styles.fieldLabel} style={{ gridColumn: "1/-1" }}>
              Nom de la famille *
              <input className={styles.input} value={famille.nom ?? ""} onChange={(e) => set("nom", e.target.value)} placeholder="ex: Tasses, T-shirts…" required />
            </label>
            <label className={styles.fieldLabel} style={{ gridColumn: "1/-1" }}>
              Accroche (strapline)
              <input className={styles.input} value={famille.strapline ?? ""} onChange={(e) => set("strapline", e.target.value)} placeholder="ex: Personnalisées à votre image" />
            </label>
            <label className={styles.fieldLabel} style={{ gridColumn: "1/-1" }}>
              Description
              <textarea
                className={styles.input}
                rows={3}
                value={famille.resume ?? ""}
                onChange={(e) => set("resume", e.target.value)}
                placeholder="Description courte de la famille de produits…"
                style={{ resize: "vertical" }}
              />
            </label>
            <label className={styles.fieldLabel}>
              Couleur d&apos;accent
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="color" value={famille.accent ?? "#dbe7ff"} onChange={(e) => set("accent", e.target.value)} style={{ width: 40, height: 36, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }} />
                <input className={styles.input} value={famille.accent ?? "#dbe7ff"} onChange={(e) => set("accent", e.target.value)} style={{ flex: 1 }} />
              </div>
            </label>
            <label className={styles.fieldLabel}>
              Couleur de surface
              <input className={styles.input} value={famille.surface ?? ""} onChange={(e) => set("surface", e.target.value)} placeholder="rgba(219, 231, 255, 0.68)" />
            </label>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Annuler</button>
          <button className={styles.saveBtn} onClick={onSave} disabled={saving || !famille.nom}>
            {saving ? "Sauvegarde…" : famille.isNew ? "Créer la famille" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CategorieModal ────────────────────────────────────────────────

function CategorieModal({
  categorie, onChange, onSave, onClose, saving,
}: {
  categorie: EditingCategorie;
  onChange: (c: EditingCategorie) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const set = (field: keyof EditingCategorie, value: unknown) =>
    onChange({ ...categorie, [field]: value });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className={styles.modalHeader}>
          <h3>{categorie.isNew ? "Nouvelle catégorie" : `Renommer « ${categorie.nom} »`}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <label className={styles.fieldLabel} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Nom de la catégorie *
            <input
              className={styles.input}
              value={categorie.nom ?? ""}
              onChange={(e) => set("nom", e.target.value)}
              placeholder="ex: Tasse céramique, T-shirt col rond…"
              autoFocus
            />
          </label>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Annuler</button>
          <button className={styles.saveBtn} onClick={onSave} disabled={saving || !categorie.nom}>
            {saving ? "Sauvegarde…" : categorie.isNew ? "Créer" : "Renommer"}
          </button>
        </div>
      </div>
    </div>
  );
}
