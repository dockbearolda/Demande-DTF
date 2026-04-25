import { FormEvent, useState } from "react";
import { useToast } from "@/components/Toast";
import { AlertDialog } from "@/components/ui/AlertDialog";
import {
  ClientInput,
  useClients,
  useCreateClient,
  useDeleteClient,
  useUpdateClient,
} from "@/hooks/useClients";
import type { Client } from "@/lib/types";
import { AxiosError } from "axios";

const EMPTY: ClientInput = { nom: "", email: "", telephone: "", adresse: "" };

const INPUT_STYLE: React.CSSProperties = {
  border: "1px solid var(--brand-sage-100)",
  background: "var(--brand-paper)",
  color: "var(--fg-1)",
};

const BTN_SECONDARY: React.CSSProperties = {
  border: "1px solid var(--brand-sage-100)",
  background: "var(--brand-paper-hi)",
  color: "var(--fg-2)",
};

function errorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<{ detail?: string }>;
  return axiosErr.response?.data?.detail ?? fallback;
}

export function ClientsPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientInput>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useClients(search || undefined);
  const createMut = useCreateClient();
  const updateMut = useUpdateClient();
  const deleteMut = useDeleteClient();
  const { show } = useToast();

  function resetForm() {
    setEditing(null);
    setForm(EMPTY);
  }

  function startEdit(client: Client) {
    setEditing(client);
    setForm({
      nom: client.nom,
      email: client.email ?? "",
      telephone: client.telephone ?? "",
      adresse: client.adresse ?? "",
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const payload: ClientInput = {
      nom: form.nom.trim(),
      email: form.email?.trim() || null,
      telephone: form.telephone?.trim() || null,
      adresse: form.adresse?.trim() || null,
    };
    if (!payload.nom) {
      show("Le nom est requis", "error");
      return;
    }
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
      show(errorMessage(err, "Enregistrement impossible"), "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      show("Client supprimé", "success");
      if (editing?.id === deleteTarget.id) resetForm();
    } catch (err) {
      show(errorMessage(err, "Suppression impossible"), "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  const submitting = createMut.isPending || updateMut.isPending;

  const TH_STYLE: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 1,
    borderBottom: "1px solid var(--brand-sage-100)",
    background: "var(--brand-paper-hi)",
    color: "var(--fg-3)",
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
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
          className="w-64 rounded-md px-3 py-2 text-sm"
          style={INPUT_STYLE}
        />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-xl p-4 lg:col-span-1"
          style={{
            background: "var(--brand-paper)",
            border: "1px solid var(--brand-sage-100)",
            boxShadow: "var(--shadow-1)",
          }}
          aria-label={editing ? "Modifier un client" : "Créer un client"}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--fg-1)" }}>
            {editing ? `Modifier — ${editing.nom}` : "Nouveau client"}
          </h2>

          {(["nom", "email", "telephone", "adresse"] as const).map((field) => (
            <label key={field} className="block text-xs font-medium" style={{ color: "var(--fg-3)" }}>
              {field === "nom" ? "Nom *" : field === "email" ? "Email" : field === "telephone" ? "Téléphone" : "Adresse"}
              {field === "adresse" ? (
                <textarea
                  rows={2}
                  value={form.adresse ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                  className="mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  style={INPUT_STYLE}
                />
              ) : (
                <input
                  type={field === "email" ? "email" : field === "telephone" ? "tel" : "text"}
                  required={field === "nom"}
                  value={(form[field] as string) ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  style={INPUT_STYLE}
                />
              )}
            </label>
          ))}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "var(--brand-duck-500)", color: "var(--fg-on-primary)" }}
            >
              {submitting ? "…" : editing ? "Enregistrer" : "Créer"}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md px-3 py-2 text-sm font-medium"
                style={BTN_SECONDARY}
              >
                Annuler
              </button>
            ) : null}
          </div>
        </form>

        <div
          className="overflow-hidden rounded-xl lg:col-span-2"
          style={{
            background: "var(--brand-paper)",
            border: "1px solid var(--brand-sage-100)",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {["Nom", "Email", "Téléphone"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                      style={TH_STYLE}
                    >
                      {h}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide"
                    style={TH_STYLE}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--fg-3)" }}>
                      Chargement…
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--fg-3)" }}>
                      Aucun client
                    </td>
                  </tr>
                ) : (
                  clients.map((c, i) => (
                    <tr
                      key={c.id}
                      style={{
                        background: i % 2 === 0 ? "var(--brand-paper)" : "var(--brand-paper-hi)",
                      }}
                    >
                      <td
                        className="px-3 py-2 font-medium"
                        style={{ borderBottom: "1px solid var(--brand-sage-100)", color: "var(--fg-1)" }}
                      >
                        {c.nom}
                      </td>
                      <td
                        className="px-3 py-2"
                        style={{ borderBottom: "1px solid var(--brand-sage-100)", color: "var(--fg-2)" }}
                      >
                        {c.email ?? "—"}
                      </td>
                      <td
                        className="px-3 py-2"
                        style={{ borderBottom: "1px solid var(--brand-sage-100)", color: "var(--fg-2)" }}
                      >
                        {c.telephone ?? "—"}
                      </td>
                      <td
                        className="px-3 py-2 text-right"
                        style={{ borderBottom: "1px solid var(--brand-sage-100)" }}
                      >
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="rounded-md px-2 py-1 text-xs font-medium"
                            style={BTN_SECONDARY}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            className="rounded-md px-2 py-1 text-xs font-medium"
                            style={{
                              border: "1px solid var(--color-danger)",
                              background: "color-mix(in srgb, var(--color-danger) 8%, var(--brand-paper))",
                              color: "var(--color-danger)",
                            }}
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
    </div>
  );
}
