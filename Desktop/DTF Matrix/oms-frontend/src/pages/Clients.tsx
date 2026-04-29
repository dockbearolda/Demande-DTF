import { FormEvent, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { AlertDialog } from "@/components/ui/AlertDialog";
import {
  ClientContactInput,
  ClientImportRow,
  ClientInput,
  useAddContact,
  useClients,
  useCreateClient,
  useDeleteClient,
  useDeleteContact,
  useImportClients,
  useUpdateClient,
  useUpdateContact,
} from "@/hooks/useClients";
import type { Client, ClientContact } from "@/lib/types";
import { AxiosError } from "axios";

// ─── Styles constants ───────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  border: "1px solid var(--brand-sage-100)",
  background: "var(--brand-paper)",
  color: "var(--fg-1)",
};

const BTN_GHOST: React.CSSProperties = {
  border: "1px solid var(--brand-sage-100)",
  background: "var(--brand-paper-hi)",
  color: "var(--fg-2)",
};

const BTN_DANGER: React.CSSProperties = {
  border: "1px solid var(--color-danger)",
  background: "color-mix(in srgb, var(--color-danger) 8%, var(--brand-paper))",
  color: "var(--color-danger)",
};

const TH: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  borderBottom: "1px solid var(--brand-sage-100)",
  background: "var(--brand-paper-hi)",
  color: "var(--fg-3)",
};

const TD: React.CSSProperties = { borderBottom: "1px solid var(--brand-sage-100)", color: "var(--fg-2)" };

// ─── Helpers ────────────────────────────────────────────────────────────────

function apiError(err: unknown, fallback: string): string {
  const e = err as AxiosError<{ detail?: string }>;
  return e.response?.data?.detail ?? fallback;
}

function parseCSV(text: string): ClientImportRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const results: ClientImportRow[] = [];
  for (const line of lines.slice(1)) {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    const nom = row["societe"] || row["nom"] || "";
    if (!nom) continue;
    results.push({
      nom,
      contact: row["contact"] || null,
      ville: row["ville"] || null,
      telephone: row["telephone"] || null,
      email: row["email"] || null,
    });
  }
  return results;
}

// ─── Sous-composant : panneau contacts d'un client ──────────────────────────

function ContactsPanel({ client }: { client: Client }) {
  const { show } = useToast();
  const addMut = useAddContact(client.id);
  const updateMut = useUpdateContact(client.id);
  const deleteMut = useDeleteContact(client.id);

  const EMPTY_C: ClientContactInput = { nom: "", telephone: "", email: "" };
  const [newC, setNewC] = useState<ClientContactInput>(EMPTY_C);
  const [editingC, setEditingC] = useState<ClientContact | null>(null);
  const [editForm, setEditForm] = useState<ClientContactInput>(EMPTY_C);

  async function addContact(e: FormEvent) {
    e.preventDefault();
    const payload = {
      nom: newC.nom.trim(),
      telephone: newC.telephone?.trim() || null,
      email: newC.email?.trim() || null,
    };
    if (!payload.nom) return;
    try {
      await addMut.mutateAsync(payload);
      setNewC(EMPTY_C);
      show("Responsable ajouté", "success");
    } catch (err) {
      show(apiError(err, "Ajout impossible"), "error");
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingC) return;
    try {
      await updateMut.mutateAsync({
        id: editingC.id,
        payload: {
          nom: editForm.nom.trim(),
          telephone: editForm.telephone?.trim() || null,
          email: editForm.email?.trim() || null,
        },
      });
      setEditingC(null);
      show("Responsable mis à jour", "success");
    } catch (err) {
      show(apiError(err, "Modification impossible"), "error");
    }
  }

  async function removeContact(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      show("Responsable supprimé", "success");
    } catch (err) {
      show(apiError(err, "Suppression impossible"), "error");
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--fg-3)" }}>
        Responsables internes
      </p>

      {/* Liste */}
      {client.contacts.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--fg-4)" }}>Aucun responsable</p>
      ) : (
        <div className="space-y-1">
          {client.contacts.map((c) =>
            editingC?.id === c.id ? (
              <form key={c.id} onSubmit={saveEdit} className="flex flex-wrap items-center gap-1">
                <input
                  type="text"
                  required
                  placeholder="Nom"
                  value={editForm.nom}
                  onChange={(e) => setEditForm((f) => ({ ...f, nom: e.target.value }))}
                  className="w-28 rounded px-2 py-1 text-xs"
                  style={INPUT}
                />
                <input
                  type="tel"
                  placeholder="Tél."
                  value={editForm.telephone ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, telephone: e.target.value }))}
                  className="w-28 rounded px-2 py-1 text-xs"
                  style={INPUT}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={editForm.email ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-36 rounded px-2 py-1 text-xs"
                  style={INPUT}
                />
                <button type="submit" className="rounded px-2 py-1 text-xs font-medium" style={{ background: "var(--brand-duck-500)", color: "var(--fg-on-primary)" }}>
                  ✓
                </button>
                <button type="button" onClick={() => setEditingC(null)} className="rounded px-2 py-1 text-xs" style={BTN_GHOST}>
                  ✕
                </button>
              </form>
            ) : (
              <div key={c.id} className="flex items-center gap-2 rounded px-2 py-1" style={{ background: "var(--brand-paper-hi)" }}>
                <span className="flex-1 text-xs font-medium" style={{ color: "var(--fg-1)" }}>
                  {c.nom}
                </span>
                {c.telephone && (
                  <span className="text-xs" style={{ color: "var(--fg-3)" }}>{c.telephone}</span>
                )}
                {c.email && (
                  <span className="text-xs" style={{ color: "var(--fg-3)" }}>{c.email}</span>
                )}
                <button
                  type="button"
                  onClick={() => { setEditingC(c); setEditForm({ nom: c.nom, telephone: c.telephone ?? "", email: c.email ?? "" }); }}
                  className="rounded px-1.5 py-0.5 text-xs"
                  style={BTN_GHOST}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => removeContact(c.id)}
                  className="rounded px-1.5 py-0.5 text-xs"
                  style={BTN_DANGER}
                >
                  ✕
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* Formulaire ajout */}
      <form onSubmit={addContact} className="flex flex-wrap items-center gap-1 pt-1">
        <input
          type="text"
          required
          placeholder="Nom *"
          value={newC.nom}
          onChange={(e) => setNewC((f) => ({ ...f, nom: e.target.value }))}
          className="w-28 rounded px-2 py-1 text-xs"
          style={INPUT}
        />
        <input
          type="tel"
          placeholder="Tél."
          value={newC.telephone ?? ""}
          onChange={(e) => setNewC((f) => ({ ...f, telephone: e.target.value }))}
          className="w-28 rounded px-2 py-1 text-xs"
          style={INPUT}
        />
        <input
          type="email"
          placeholder="Email"
          value={newC.email ?? ""}
          onChange={(e) => setNewC((f) => ({ ...f, email: e.target.value }))}
          className="w-36 rounded px-2 py-1 text-xs"
          style={INPUT}
        />
        <button
          type="submit"
          disabled={addMut.isPending}
          className="rounded px-2 py-1 text-xs font-medium disabled:opacity-60"
          style={{ background: "var(--brand-duck-500)", color: "var(--fg-on-primary)" }}
        >
          + Ajouter
        </button>
      </form>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

const EMPTY: ClientInput = {
  nom: "",
  nom_facture: "",
  contact: "",
  ville: "",
  email: "",
  telephone: "",
  adresse: "",
};

const FORM_FIELDS: {
  key: keyof ClientInput;
  label: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
}[] = [
  { key: "nom", label: "Société *", required: true },
  { key: "nom_facture", label: "Nom facture" },
  { key: "ville", label: "Ville" },
  { key: "telephone", label: "Téléphone", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "adresse", label: "Adresse", textarea: true },
];

export function ClientsPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientInput>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ClientImportRow[] | null>(null);

  const { data: clients = [], isLoading } = useClients(search || undefined);
  const createMut = useCreateClient();
  const updateMut = useUpdateClient();
  const deleteMut = useDeleteClient();
  const importMut = useImportClients();
  const { show } = useToast();

  // Dériver le client édité depuis les données fraîches (contacts mis à jour en temps réel)
  const liveEditing = editing ? (clients.find((c) => c.id === editing.id) ?? editing) : null;

  function resetForm() {
    setEditing(null);
    setForm(EMPTY);
  }

  function startEdit(client: Client) {
    setEditing(client);
    setExpandedId(client.id);
    setForm({
      nom: client.nom,
      nom_facture: client.nom_facture ?? "",
      contact: client.contact ?? "",
      ville: client.ville ?? "",
      email: client.email ?? "",
      telephone: client.telephone ?? "",
      adresse: client.adresse ?? "",
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: ClientInput = {
      nom: form.nom.trim(),
      nom_facture: form.nom_facture?.trim() || null,
      contact: form.contact?.trim() || null,
      ville: form.ville?.trim() || null,
      email: form.email?.trim() || null,
      telephone: form.telephone?.trim() || null,
      adresse: form.adresse?.trim() || null,
    };
    if (!payload.nom) { show("Le nom est requis", "error"); return; }
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, payload });
        show("Client mis à jour", "success");
      } else {
        await createMut.mutateAsync(payload);
        show("Client créé", "success");
      }
      resetForm();
    } catch (err) {
      show(apiError(err, "Enregistrement impossible"), "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      show("Client supprimé", "success");
      if (editing?.id === deleteTarget.id) resetForm();
      if (expandedId === deleteTarget.id) setExpandedId(null);
    } catch (err) {
      show(apiError(err, "Suppression impossible"), "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target?.result as string);
      setImportPreview(rows);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  async function confirmImport() {
    if (!importPreview) return;
    try {
      const r = await importMut.mutateAsync(importPreview);
      show(
        `${r.clients_created} société${r.clients_created > 1 ? "s" : ""} créée${r.clients_created > 1 ? "s" : ""}, ${r.contacts_created} responsable${r.contacts_created > 1 ? "s" : ""} importé${r.contacts_created > 1 ? "s" : ""}${r.clients_skipped > 0 ? `, ${r.clients_skipped} existante${r.clients_skipped > 1 ? "s" : ""} ignorée${r.clients_skipped > 1 ? "s" : ""}` : ""}`,
        "success",
      );
    } catch (err) {
      show(apiError(err, "Import impossible"), "error");
    } finally {
      setImportPreview(null);
    }
  }

  const submitting = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--fg-1)" }}>
            Clients
          </h1>
          <p className="text-sm" style={{ color: "var(--fg-3)" }}>
            {clients.length} client{clients.length > 1 ? "s" : ""}
          </p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          aria-label="Rechercher un client"
          className="w-56 rounded-md px-3 py-2 text-sm"
          style={INPUT}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md px-3 py-2 text-sm font-medium"
          style={BTN_GHOST}
        >
          Importer CSV
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* ── Formulaire client ── */}
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-xl p-4 lg:col-span-1"
          style={{ background: "var(--brand-paper)", border: "1px solid var(--brand-sage-100)", boxShadow: "var(--shadow-1)" }}
          aria-label={editing ? "Modifier un client" : "Créer un client"}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--fg-1)" }}>
            {editing ? `Modifier — ${editing.nom}` : "Nouveau client"}
          </h2>

          {FORM_FIELDS.map(({ key, label, type = "text", required, textarea }) => (
            <label key={key} className="block text-xs font-medium" style={{ color: "var(--fg-3)" }}>
              {label}
              {textarea ? (
                <textarea
                  rows={2}
                  value={(form[key] as string) ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  style={INPUT}
                />
              ) : (
                <input
                  type={type}
                  required={required}
                  value={(form[key] as string) ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  style={INPUT}
                />
              )}
            </label>
          ))}

          {/* Responsables dans le formulaire d'édition */}
          {liveEditing && <ContactsPanel client={liveEditing} />}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "var(--brand-duck-500)", color: "var(--fg-on-primary)" }}
            >
              {submitting ? "…" : editing ? "Enregistrer" : "Créer"}
            </button>
            {editing && (
              <button type="button" onClick={resetForm} className="rounded-md px-3 py-2 text-sm font-medium" style={BTN_GHOST}>
                Annuler
              </button>
            )}
          </div>
        </form>

        {/* ── Tableau ── */}
        <div
          className="overflow-hidden rounded-xl lg:col-span-3"
          style={{ background: "var(--brand-paper)", border: "1px solid var(--brand-sage-100)", boxShadow: "var(--shadow-1)" }}
        >
          <div className="max-h-[80vh] overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {["Société", "Ville", "Tél.", "Email"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={TH}>
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={TH}>
                    Responsables
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={TH}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--fg-3)" }}>Chargement…</td></tr>
                ) : clients.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--fg-3)" }}>Aucun client</td></tr>
                ) : (
                  clients.map((c, i) => (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? "var(--brand-paper)" : "var(--brand-paper-hi)" }}>
                      <td className="px-3 py-2 font-medium" style={{ ...TD, color: "var(--fg-1)" }}>
                        <div>{c.nom}</div>
                        {c.nom_facture && c.nom_facture !== c.nom && (
                          <div className="text-xs" style={{ color: "var(--fg-3)" }}>Fact. {c.nom_facture}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={TD}>
                        {c.ville ?? <span style={{ color: "var(--fg-4)" }}>—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={TD}>
                        {c.telephone ?? <span style={{ color: "var(--fg-4)" }}>—</span>}
                      </td>
                      <td className="px-3 py-2" style={TD}>
                        {c.email ?? <span style={{ color: "var(--fg-4)" }}>—</span>}
                      </td>
                      <td className="px-3 py-2" style={{ ...TD, minWidth: "160px" }}>
                        {c.contacts.length === 0 ? (
                          <span className="text-xs" style={{ color: "var(--fg-4)" }}>—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {c.contacts.map((r) => (
                              <span
                                key={r.id}
                                title={[r.telephone, r.email].filter(Boolean).join(" · ")}
                                className="inline-block rounded-full px-2 py-0.5 text-xs"
                                style={{ background: "var(--brand-sage-50)", color: "var(--fg-2)", border: "1px solid var(--brand-sage-100)" }}
                              >
                                {r.nom}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right" style={TD}>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="rounded-md px-2 py-1 text-xs font-medium"
                            style={BTN_GHOST}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            className="rounded-md px-2 py-1 text-xs font-medium"
                            style={BTN_DANGER}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Dialogue suppression ── */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`Supprimer ${deleteTarget?.nom ?? ""} ?`}
        description="Les commandes existantes seront conservées. Cette action est irréversible."
        confirmLabel="Supprimer"
        confirmTone="danger"
        typeToConfirm={deleteTarget?.nom.toUpperCase()}
        onConfirm={confirmDelete}
      />

      {/* ── Dialogue import CSV ── */}
      <AlertDialog
        open={importPreview !== null}
        onOpenChange={(open) => { if (!open) setImportPreview(null); }}
        title={`Importer ${importPreview?.length ?? 0} lignes CSV ?`}
        description={
          importPreview
            ? `Les sociétés déjà présentes seront ignorées. Les nouveaux responsables seront rattachés à leur société.`
            : ""
        }
        confirmLabel={importMut.isPending ? "Import en cours…" : "Importer"}
        confirmTone="primary"
        onConfirm={confirmImport}
      />
    </div>
  );
}
