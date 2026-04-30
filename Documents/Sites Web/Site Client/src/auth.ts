/**
 * Configuration Auth.js (next-auth v5)
 *
 * Mode 1 — Strapi (si NEXT_PUBLIC_STRAPI_URL est défini)
 *   Auth via POST /api/auth/local + groupes tarifaires
 *
 * Mode 2 — LOCAL_USERS (si Strapi n'est pas configuré)
 *   Utilisateurs définis dans la variable d'environnement LOCAL_USERS
 *   Format JSON : [{"id":"1","email":"...","password":"sha256:...","name":"...","groupe":"standard"}]
 *   Générer un hash : node scripts/add-user.mjs
 *
 * Variables d'environnement requises :
 *   AUTH_SECRET              — chaîne aléatoire secrète (openssl rand -base64 32)
 *
 * Variables optionnelles :
 *   NEXT_PUBLIC_STRAPI_URL   — URL Strapi (active le mode Strapi)
 *   STRAPI_API_TOKEN         — token API Strapi (server-only)
 *   LOCAL_USERS              — JSON array des utilisateurs locaux
 *   ADMIN_EMAILS             — emails admin séparés par virgule (ex: patron@olda.fr)
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const STRAPI_URL = (process.env.NEXT_PUBLIC_STRAPI_URL ?? "").replace(/\/$/, "");

// ── Types Strapi ───────────────────────────────────────────────────

type StrapiAuthResponse = {
  jwt?: string;
  user?: { id: number; email: string; username: string };
};

type StrapiMeResponse = {
  id: number;
  email: string;
  username: string;
  groupe_client?: {
    id: number;
    slug: string;
    nom: string;
  } | null;
};

// ── Types utilisateurs locaux ──────────────────────────────────────

export type LocalUser = {
  id: string;
  email: string;
  /** Mot de passe : "sha256:<hex>" (recommandé) ou texte brut */
  password: string;
  name: string;
  groupe?: string;
};

function getLocalUsers(): LocalUser[] {
  const raw = process.env.LOCAL_USERS ?? "";
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LocalUser[];
  } catch {
    console.error("[auth] LOCAL_USERS: JSON invalide — vérifiez la variable d'environnement");
    return [];
  }
}

/**
 * Vérifie un mot de passe contre le hash stocké.
 * Utilise Web Crypto API (compatible Edge Runtime et Node.js).
 * Supporte : "sha256:<hex>" ou texte brut (non recommandé en production).
 */
async function checkPassword(input: string, stored: string): Promise<boolean> {
  if (stored.startsWith("sha256:")) {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex === stored.slice(7);
  }
  // Comparaison directe (plaintext) — acceptable si l'env var n'est jamais exposé
  return input === stored;
}

// ── NextAuth configuration ─────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        // ── Mode 1 : Authentification Strapi ─────────────────────
        if (STRAPI_URL) {
          try {
            const authRes = await fetch(`${STRAPI_URL}/api/auth/local`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                identifier: credentials.email,
                password: credentials.password,
              }),
            });

            if (authRes.ok) {
              const authData = await authRes.json() as StrapiAuthResponse;
              if (authData.jwt && authData.user) {
                let groupeId: number | undefined;
                let groupeSlug: string | undefined;

                try {
                  const meRes = await fetch(
                    `${STRAPI_URL}/api/users/me?populate=groupe_client`,
                    { headers: { Authorization: `Bearer ${authData.jwt}` } },
                  );
                  if (meRes.ok) {
                    const me = await meRes.json() as StrapiMeResponse;
                    if (me.groupe_client) {
                      groupeId = me.groupe_client.id;
                      groupeSlug = me.groupe_client.slug;
                    }
                  }
                } catch {
                  // Non bloquant
                }

                return {
                  id: String(authData.user.id),
                  email: authData.user.email,
                  name: authData.user.username,
                  strapiToken: authData.jwt,
                  strapiId: String(authData.user.id),
                  groupeId,
                  groupeSlug,
                };
              }
            }
          } catch {
            // Strapi inaccessible — on passe en mode local si LOCAL_USERS est défini
          }
        }

        // ── Mode 2 : Utilisateurs locaux ─────────────────────────
        const localUsers = getLocalUsers();
        if (localUsers.length > 0) {
          const user = localUsers.find(
            (u) => u.email.trim().toLowerCase() === email,
          );
          if (user && await checkPassword(password, user.password)) {
            const adminEmails = (process.env.ADMIN_EMAILS ?? "")
              .split(",")
              .map((e) => e.trim().toLowerCase())
              .filter(Boolean);

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              groupeSlug: user.groupe,
              isAdmin: adminEmails.includes(user.email.trim().toLowerCase()),
            };
          }
        }

        return null;
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & {
          strapiToken?: string;
          strapiId?: string;
          groupeId?: number;
          groupeSlug?: string;
          isAdmin?: boolean;
        };
        token.strapiToken = u.strapiToken;
        token.strapiId = u.strapiId;
        token.groupeId = u.groupeId;
        token.groupeSlug = u.groupeSlug;
      }
      // Re-vérification admin à chaque renouvellement de token (pas seulement à la connexion)
      const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const tokenEmail = (token.email ?? "").trim().toLowerCase();
      token.isAdmin =
        adminEmails.length > 0 &&
        tokenEmail !== "" &&
        adminEmails.includes(tokenEmail);
      return token;
    },
    session({ session, token }) {
      session.user.strapiToken = token.strapiToken as string | undefined;
      session.user.strapiId = token.strapiId as string | undefined;
      session.user.groupeId = token.groupeId as number | undefined;
      session.user.groupeSlug = token.groupeSlug as string | undefined;

      // Re-vérification admin à chaque requête depuis ADMIN_EMAILS
      // (pas besoin de se déconnecter/reconnecter si la variable change)
      const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const userEmail = (session.user?.email ?? "").trim().toLowerCase();
      session.user.isAdmin =
        adminEmails.length > 0 &&
        userEmail !== "" &&
        adminEmails.includes(userEmail);

      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
