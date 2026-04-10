import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isDBConfigured } from "@/lib/prisma";
import { CatalogueAdmin } from "./CatalogueAdmin";
import styles from "../page.module.css";

export default async function AdminCataloguePage() {
  const session = await auth();

  if (!session) redirect("/login?callbackUrl=/admin/catalogue");
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

  if (!isDBConfigured()) {
    return (
      <main className={styles.page}>
        <div className={styles.admin}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Catalogue</h1>
              <p className={styles.subtitle}>Base de données non configurée</p>
            </div>
            <a href="/admin" className={styles.backLink}>← Admin</a>
          </div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Base de données requise</h2>
            <p className={styles.instructions}>
              Pour modifier le catalogue depuis l&apos;admin, ajoutez une base PostgreSQL Railway :
            </p>
            <div className={styles.stepList}>
              <div className={styles.step}><span className={styles.stepNum}>1</span><span>Railway → votre projet → <strong>New Service</strong> → <strong>Database</strong> → <strong>PostgreSQL</strong></span></div>
              <div className={styles.step}><span className={styles.stepNum}>2</span><span>Railway injecte automatiquement <code>DATABASE_URL</code> dans votre projet</span></div>
              <div className={styles.step}><span className={styles.stepNum}>3</span><span>Redéployez — le catalogue se peuple automatiquement</span></div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <CatalogueAdmin />
    </main>
  );
}
