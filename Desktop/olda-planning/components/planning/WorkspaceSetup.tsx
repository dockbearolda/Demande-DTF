'use client';

import React, { useState } from 'react';
import styles from './WorkspaceSetup.module.css';

interface Props {
  onConfirm: (p: string) => void;
}

export function WorkspaceSetup({ onConfirm }: Props) {
  const [chosen, setChosen]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const pick = async () => {
    const p = await window.electronAPI?.selectWorkspace();
    if (p) { setChosen(p); setError(null); }
  };

  const confirm = async () => {
    if (!chosen) return;
    setLoading(true);
    const res = await window.electronAPI?.setWorkspace(chosen);
    if (res?.error) {
      setError(`Impossible d'accéder au dossier : ${res.error}`);
      setLoading(false);
    } else {
      onConfirm(chosen);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.logo}>OLDA</div>
        <h1 className={styles.title}>Planning OLDA</h1>
        <p className={styles.subtitle}>
          Première utilisation — sélectionne le dossier Dropbox partagé.<br />
          Toutes les commandes seront synchronisées entre les postes.
        </p>

        <button className={styles.pickBtn} onClick={pick}>
          📁 Choisir le dossier Dropbox…
        </button>

        {chosen && (
          <div className={styles.path}>{chosen}</div>
        )}

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <button
          className={styles.confirmBtn}
          onClick={confirm}
          disabled={!chosen || loading}
        >
          {loading ? 'Connexion…' : 'Démarrer le planning'}
        </button>
      </div>
    </div>
  );
}
