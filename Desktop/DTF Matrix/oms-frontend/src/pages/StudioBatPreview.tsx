import { useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { StudioBatStudio } from "@/features/studio-bat";
import {
  isTextileLine,
  selectHeader,
  selectLine,
  useNewOrderStore,
} from "@/features/new-order";

export function StudioBatPreviewPage() {
  const header = useNewOrderStore(selectHeader);
  const line = useNewOrderStore(selectLine);
  const setStep = useNewOrderStore((s) => s.setStep);
  const [params] = useSearchParams();

  useEffect(() => {
    // When the user navigates back to /orders/new, resume the wizard at
    // step 2 (where the Studio BAT entry lives).
    return () => setStep(2);
  }, [setStep]);

  if (!line || !isTextileLine(line)) {
    return <Navigate to="/orders/new" replace />;
  }

  const reference = "Nouvelle commande";
  const clientName = header.clientNom.trim() || "Client à renseigner";
  // Optional: ?color=<colorId> identifies which (model × color) BAT is being edited.
  const colorId = params.get("color") ?? undefined;

  return (
    <StudioBatStudio
      orderId={undefined}
      backTo="/orders/new"
      preview={{ reference, clientName }}
      colorId={colorId}
    />
  );
}
