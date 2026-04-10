"use client";

import { useState, useCallback } from "react";
import type { LocalUser } from "@/auth";
import styles from "./page.module.css";

type Props = {
  initialUsers: LocalUser[];
  adminEmail: string;
};

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function AdminClient({ initialUsers, adminEmail }: Props) {
  const [users, setUsers] = useState<LocalUser[]>(initialUsers);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newGroupe, setNewGroupe] = useState("standard");
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [changePassId, setChangePassId] = useState<string | null>(null);
  const [newPass, setNewPass] = useState("");

  const generateJson = useCallback((list: LocalUser[]) => {
    return JSON.stringify(list, null, 2);
  }, []);

  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(generateJson(users));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [users, generateJson]);

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    const hash = await sha256(newPassword);
    const newUser: LocalUser = {
      id: `client-${Date.now()}`,
      email: newEmail.trim().toLowerCase(),
      password: `sha256:${hash}`,
      name: newName.trim(),
      groupe: newGroupe || "standard",
    };
    setUsers((prev) => [...prev, newUser]);
    setNewEmail("");
    setNewName("");
    setNewPassword("");
    setNewGroupe("standard");
    setAdding(false);
  }, [newEmail, newName, newPassword, newGroupe]);

  const handleDelete = useCallback((id: string) => {
    if (!confirm("Supprimer ce client ?")) return;
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const handleChangePassword = useCallback(async (id: string) => {
    if (!newPass) return;
    const hash = await sha256(newPass);
    setUsers((prev) =>
      prev.map((u) => u.id === id ? { ...u, password: `sha256:${hash}` } : u),
    );
    setChangePassId(null);
    setNewPass("");
  }, [newPass]);

  return (
    <div className={styles.admin}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Administration OLDA</h1>
          <p className={styles.subtitle}>Connecté : {adminEmail}</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/admin/catalogue" className={styles.backLink} style={{ background: "#1d1d1f", color: "#fff", padding: "8px 18px", borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            Modifier le catalogue →
          </a>
          <a href="/" className={styles.backLink}>← Site</a>
        </div>
      </div>

      {/* Ajouter un client */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Ajouter un client</h2>
        <form className={styles.addForm} onSubmit={handleAdd}>
          <div className={styles.formRow}>
            <label className={styles.fieldLabel}>
              Nom complet
              <input
                className={styles.input}
                type="text"
                placeholder="Jean Dupont"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </label>
            <label className={styles.fieldLabel}>
              Email
              <input
                className={styles.input}
                type="email"
                placeholder="client@exemple.fr"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.fieldLabel}>
              Mot de passe
              <input
                className={styles.input}
                type="text"
                placeholder="Mot de passe temporaire"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <label className={styles.fieldLabel}>
              Groupe tarifaire
              <select
                className={styles.input}
                value={newGroupe}
                onChange={(e) => setNewGroupe(e.target.value)}
              >
                <option value="standard">Standard</option>
                <option value="distributeur">Distributeur</option>
                <option value="grossiste">Grossiste</option>
                <option value="vip">VIP</option>
              </select>
            </label>
          </div>
          <button type="submit" className={styles.addBtn} disabled={adding}>
            {adding ? "Ajout…" : "+ Ajouter le client"}
          </button>
        </form>
      </section>

      {/* Liste des clients */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          Clients ({users.length})
        </h2>
        {users.length === 0 ? (
          <p className={styles.empty}>Aucun client pour l&apos;instant.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Groupe</th>
                  <th>Mot de passe</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className={styles.tdName}>{u.name}</td>
                    <td className={styles.tdEmail}>{u.email}</td>
                    <td>
                      <span className={styles.badge}>{u.groupe ?? "standard"}</span>
                    </td>
                    <td className={styles.tdPass}>
                      {changePassId === u.id ? (
                        <div className={styles.passRow}>
                          <input
                            className={styles.inputSm}
                            type="text"
                            placeholder="Nouveau mdp"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                          />
                          <button
                            className={styles.btnSm}
                            onClick={() => handleChangePassword(u.id)}
                          >OK</button>
                          <button
                            className={styles.btnSmCancel}
                            onClick={() => { setChangePassId(null); setNewPass(""); }}
                          >✕</button>
                        </div>
                      ) : (
                        <button
                          className={styles.btnLink}
                          onClick={() => setChangePassId(u.id)}
                        >
                          Changer
                        </button>
                      )}
                    </td>
                    <td>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(u.id)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Déploiement */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Appliquer les changements</h2>
        <p className={styles.instructions}>
          Après avoir ajouté ou supprimé des clients, cliquez sur <strong>Copier le JSON</strong>{" "}
          puis collez-le dans Railway :
          <br />
          Railway → votre projet → Variables → <code>LOCAL_USERS</code> → Enregistrer
        </p>
        <div className={styles.deployActions}>
          <button className={styles.copyBtn} onClick={copyToClipboard}>
            {copied ? "✓ Copié !" : "Copier le JSON"}
          </button>
          <button
            className={styles.toggleJson}
            onClick={() => setShowJson((v) => !v)}
          >
            {showJson ? "Masquer" : "Afficher"} le JSON
          </button>
        </div>
        {showJson && (
          <pre className={styles.jsonPreview}>{generateJson(users)}</pre>
        )}
        <div className={styles.stepList}>
          <div className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <span>Cliquer <strong>Copier le JSON</strong> ci-dessus</span>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <span>Aller sur <strong>railway.app</strong> → votre projet → Variables</span>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>3</span>
            <span>Trouver <code>LOCAL_USERS</code>, coller le JSON et enregistrer</span>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>4</span>
            <span>Railway redéploie automatiquement (~1 min) et les clients peuvent se connecter</span>
          </div>
        </div>
      </section>
    </div>
  );
}
