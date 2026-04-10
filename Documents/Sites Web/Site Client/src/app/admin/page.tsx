import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { LocalUser } from "@/auth";
import { AdminClient } from "./AdminClient";
import styles from "./page.module.css";

function getLocalUsers(): LocalUser[] {
  const raw = process.env.LOCAL_USERS ?? "";
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LocalUser[];
  } catch {
    return [];
  }
}

export default async function AdminPage() {
  const session = await auth();

  if (!session) {
    redirect("/login?callbackUrl=/admin");
  }

  if (!session.user?.isAdmin) {
    return (
      <main className={styles.page}>
        <div className={styles.accessDenied}>
          <h1>Accès refusé</h1>
          <p>Votre compte n&apos;a pas les droits administrateur.</p>
          <a href="/" className={styles.backLink}>← Retour au site</a>
        </div>
      </main>
    );
  }

  const users = getLocalUsers();

  return (
    <main className={styles.page}>
      <AdminClient initialUsers={users} adminEmail={session.user.email ?? ""} />
    </main>
  );
}
