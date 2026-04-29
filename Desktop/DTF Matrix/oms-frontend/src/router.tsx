import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";

// Toutes les pages sont lazy-loadées : seul le shell Layout est embarqué dans
// le bundle initial. Économie d'environ ~1,5 MB sur le premier chargement
// (pdfjs + pdf-lib + konva + tout le tunnel new-order).
const OrdersPage = lazy(() =>
  import("@/pages/Orders").then((m) => ({ default: m.OrdersPage })),
);
const NewOrderPage = lazy(() =>
  import("@/pages/NewOrder").then((m) => ({ default: m.NewOrderPage })),
);
const DraftsPage = lazy(() =>
  import("@/pages/Drafts").then((m) => ({ default: m.DraftsPage })),
);
const QuoteDemoPage = lazy(() =>
  import("@/pages/QuoteDemo").then((m) => ({ default: m.QuoteDemoPage })),
);
const FlashDevisStandalonePage = lazy(() =>
  import("@/pages/FlashDevisStandalone").then((m) => ({
    default: m.FlashDevisStandalonePage,
  })),
);
const DevisPage = lazy(() =>
  import("@/pages/Devis").then((m) => ({ default: m.DevisPage })),
);
const SupplierCatalogPage = lazy(() =>
  import("@/pages/SupplierCatalog").then((m) => ({ default: m.SupplierCatalogPage })),
);
const KanbanPage = lazy(() =>
  import("@/pages/Kanban").then((m) => ({ default: m.KanbanPage })),
);
const ClientsPage = lazy(() =>
  import("@/pages/Clients").then((m) => ({ default: m.ClientsPage })),
);
const BatPage = lazy(() =>
  import("@/pages/Bat").then((m) => ({ default: m.BatPage })),
);
const StudioBatPage = lazy(() =>
  import("@/pages/StudioBat").then((m) => ({ default: m.StudioBatPage })),
);
const StudioBatEditorPage = lazy(() =>
  import("@/pages/StudioBatEditor").then((m) => ({ default: m.StudioBatEditorPage })),
);
const StudioBatPreviewPage = lazy(() =>
  import("@/pages/StudioBatPreview").then((m) => ({ default: m.StudioBatPreviewPage })),
);

const wrap = (el: React.ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Navigate to="/orders" replace /> },
      { path: "/orders", element: wrap(<OrdersPage />) },
      { path: "/orders/drafts", element: wrap(<DraftsPage />) },
      { path: "/orders/new", element: wrap(<NewOrderPage />) },
      { path: "/flash-devis", element: wrap(<FlashDevisStandalonePage />) },
      { path: "/flash-devis-v2", element: <Navigate to="/flash-devis" replace /> },
      { path: "/devis", element: wrap(<DevisPage />) },
      { path: "/catalogue", element: wrap(<SupplierCatalogPage />) },
      { path: "/kanban", element: wrap(<KanbanPage />) },
      { path: "/clients", element: wrap(<ClientsPage />) },
      { path: "/bat", element: wrap(<BatPage />) },
      { path: "/quick-quote", element: <Navigate to="/orders/new" replace /> },
      { path: "/studio-bat", element: wrap(<StudioBatPage />) },
      // @deprecated — utiliser StudioBatDrawer (monté depuis BatMatrix). Conservé
      // pour rétrocompat des liens externes ; redirige vers /orders/new si la
      // ligne courante n'a pas de couleur correspondante.
      { path: "/studio-bat/preview", element: wrap(<StudioBatPreviewPage />) },
      { path: "/studio-bat/:orderId", element: wrap(<StudioBatEditorPage />) },
    ],
  },
  // Tunnel « Devis Rapide » — refonte audit-refonte.html. Monté hors Layout
  // pour que le header sticky 64px du QuoteLayout ait la pleine largeur, sans
  // sidebar OMS ni header app au-dessus pendant l'itération design.
  { path: "/quote-demo", element: wrap(<QuoteDemoPage />) },
  { path: "*", element: <Navigate to="/" replace /> },
]);
