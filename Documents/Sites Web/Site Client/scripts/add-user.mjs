#!/usr/bin/env node
/**
 * Aide à la gestion des utilisateurs locaux OLDA
 * Usage : node scripts/add-user.mjs
 *
 * Ce script :
 *  1. Lit LOCAL_USERS depuis .env.local
 *  2. Demande les infos du nouveau client
 *  3. Génère le mot de passe en SHA-256
 *  4. Affiche le nouveau JSON LOCAL_USERS à copier dans Railway
 */

import { createInterface } from "readline";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Lire .env.local ───────────────────────────────────────────────
function readEnvLocal() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return {};
  const lines = readFileSync(envPath, "utf-8").split("\n");
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

// ── Input interactif ──────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function hash(password) {
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
  return "sha256:" + hex;
}

async function main() {
  console.log("\n═══════════════════════════════════════");
  console.log("  Gestion des clients OLDA");
  console.log("═══════════════════════════════════════\n");

  const env = readEnvLocal();
  let users = [];

  if (env.LOCAL_USERS) {
    try {
      users = JSON.parse(env.LOCAL_USERS);
      console.log(`✓ ${users.length} client(s) existant(s) chargé(s)\n`);
      users.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.name} <${u.email}> [${u.groupe ?? "standard"}]`);
      });
      console.log("");
    } catch {
      console.log("⚠ LOCAL_USERS invalide — démarrage avec liste vide\n");
    }
  } else {
    console.log("ℹ Aucun LOCAL_USERS trouvé — création d'une nouvelle liste\n");
  }

  const action = await ask("Action ? (a = ajouter, s = supprimer, h = hasher un mdp, q = quitter) : ");

  if (action.trim() === "q") {
    console.log("\nAu revoir !\n");
    rl.close();
    return;
  }

  if (action.trim() === "h") {
    const pwd = await ask("Mot de passe à hasher : ");
    console.log(`\n✓ Hash SHA-256 : ${await hash(pwd.trim())}\n`);
    rl.close();
    return;
  }

  if (action.trim() === "s") {
    if (users.length === 0) {
      console.log("\nAucun client à supprimer.\n");
      rl.close();
      return;
    }
    const idx = await ask(`Numéro du client à supprimer (1-${users.length}) : `);
    const n = parseInt(idx.trim(), 10);
    if (n >= 1 && n <= users.length) {
      const removed = users.splice(n - 1, 1)[0];
      console.log(`\n✓ ${removed.name} supprimé.\n`);
    } else {
      console.log("\n⚠ Numéro invalide.\n");
      rl.close();
      return;
    }
  } else {
    // Ajouter
    const name = await ask("Nom complet du client : ");
    const email = await ask("Email : ");
    const password = await ask("Mot de passe (sera hashé) : ");
    const groupe = await ask("Groupe (standard / distributeur / grossiste / vip) [standard] : ");

    const existing = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (existing) {
      console.log("\n⚠ Un client avec cet email existe déjà.\n");
      rl.close();
      return;
    }

    users.push({
      id: `client-${Date.now()}`,
      email: email.trim().toLowerCase(),
      password: await hash(password),
      name: name.trim(),
      groupe: groupe.trim() || "standard",
    });

    console.log(`\n✓ Client ${name.trim()} ajouté.\n`);
  }

  const json = JSON.stringify(users);

  console.log("═══════════════════════════════════════");
  console.log("  Nouvelle valeur LOCAL_USERS :");
  console.log("═══════════════════════════════════════\n");
  console.log(json);
  console.log("\n═══════════════════════════════════════");
  console.log("\nÉtapes :");
  console.log("  1. Copier le JSON ci-dessus");
  console.log("  2. Railway → Variables → LOCAL_USERS → Coller → Enregistrer");
  console.log("  3. Railway redéploie automatiquement (~1 min)\n");

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
