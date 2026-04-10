import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      strapiToken?: string;
      strapiId?: string;
      /** ID du groupe_client Strapi (null = client standard sans groupe) */
      groupeId?: number;
      /** Slug lisible : "standard" | "distributeur" | "grossiste" | … */
      groupeSlug?: string;
      /** true si l'email est dans ADMIN_EMAILS */
      isAdmin?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    strapiToken?: string;
    strapiId?: string;
    groupeId?: number;
    groupeSlug?: string;
    isAdmin?: boolean;
  }
}
