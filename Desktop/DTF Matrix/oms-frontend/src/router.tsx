import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { OrdersPage } from "@/pages/Orders";
import { KanbanPage } from "@/pages/Kanban";
import { ClientsPage } from "@/pages/Clients";
import { BatPage } from "@/pages/Bat";
import { StudioBatPage } from "@/pages/StudioBat";
import { StudioBatEditorPage } from "@/pages/StudioBatEditor";
import { NewOrderPage } from "@/pages/NewOrder";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Navigate to="/orders" replace /> },
      { path: "/orders", element: <OrdersPage /> },
      { path: "/orders/new", element: <NewOrderPage /> },
      { path: "/kanban", element: <KanbanPage /> },
      { path: "/clients", element: <ClientsPage /> },
      { path: "/bat", element: <BatPage /> },
      { path: "/quick-quote", element: <Navigate to="/orders/new" replace /> },
      { path: "/studio-bat", element: <StudioBatPage /> },
      { path: "/studio-bat/:orderId", element: <StudioBatEditorPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
