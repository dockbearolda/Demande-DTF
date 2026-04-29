import { lazy, Suspense } from "react";
import { useBatEditor } from "../useBatEditor";

// Code-split le studio BAT (Konva + pdf-lib + pdfjs ≈ 1,5 MB) : chargé
// seulement à la première ouverture du drawer, pas au chargement initial.
const StudioBatDrawer = lazy(() =>
  import("@/features/studio-bat").then((m) => ({ default: m.StudioBatDrawer })),
);

/** Portail du drawer studio BAT — monté une seule fois au top-level d'OrderForm.
 *  Tout composant peut l'ouvrir via `useBatEditor.getState().open(colorId)` (ou
 *  son hook équivalent), garantissant qu'une seule instance du drawer est rendue
 *  et qu'aucun prop-drilling n'est nécessaire. */
export function BatDrawerPortal() {
  const editColorId = useBatEditor((s) => s.editColorId);
  const groupedStart = useBatEditor((s) => s.groupedStart);
  const changeColor = useBatEditor((s) => s.changeColor);
  const close = useBatEditor((s) => s.close);

  // Pas la peine de monter le bundle tant qu'aucune édition n'a démarré.
  if (editColorId === null) return null;

  return (
    <Suspense fallback={null}>
      <StudioBatDrawer
        open
        colorId={editColorId}
        onClose={close}
        onChangeColor={changeColor}
        groupedMode={groupedStart !== null}
      />
    </Suspense>
  );
}
