import { create } from "zustand";

interface BatEditorState {
  /** Couleur en cours d'édition dans le drawer studio. `null` = drawer fermé. */
  editColorId: string | null;
  /** Quand non-null, le drawer s'ouvre en mode "Créer tous les BATs"
   *  (avance auto vers la couleur suivante non terminée après validation). */
  groupedStart: string | null;
  open: (colorId: string, opts?: { grouped?: boolean }) => void;
  changeColor: (colorId: string) => void;
  close: () => void;
}

/** Store partagé pour l'ouverture du StudioBatDrawer — permet à plusieurs
 *  composants (BatMatrix, SizeQuantityPicker…) d'ouvrir le même drawer sans
 *  prop-drilling et sans démultiplier les instances. */
export const useBatEditor = create<BatEditorState>((set) => ({
  editColorId: null,
  groupedStart: null,
  open: (colorId, opts) =>
    set({
      editColorId: colorId,
      groupedStart: opts?.grouped ? colorId : null,
    }),
  changeColor: (colorId) => set({ editColorId: colorId }),
  close: () => set({ editColorId: null, groupedStart: null }),
}));
