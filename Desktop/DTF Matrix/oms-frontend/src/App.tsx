import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ToastProvider } from "@/components/Toast";
import { SessionGate } from "@/components/SessionGate";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Default react-query gcTime is 5 min; we set it explicitly so cache
      // retention is documented rather than implicit.
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionGate>
          <RouterProvider router={router} />
        </SessionGate>
      </ToastProvider>
    </QueryClientProvider>
  );
}
