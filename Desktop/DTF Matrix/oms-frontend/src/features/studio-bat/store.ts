import { create } from "zustand";
import {
  DEFAULT_VIEW_STATE,
  VIEW_ORDER,
  type LogoAsset,
  type MockupAsset,
  type ViewId,
  type ViewState,
} from "./types";

type ViewsMap = Record<ViewId, ViewState>;

function initialViews(): ViewsMap {
  return VIEW_ORDER.reduce((acc, id) => {
    acc[id] = { ...DEFAULT_VIEW_STATE };
    return acc;
  }, {} as ViewsMap);
}

interface StudioState {
  activeView: ViewId;
  views: ViewsMap;
  setActiveView: (id: ViewId) => void;
  setMockup: (id: ViewId, mockup: MockupAsset | null) => void;
  setLogo: (id: ViewId, logo: LogoAsset | null) => void;
  setPosition: (id: ViewId, xPct: number, yPct: number) => void;
  setLogoWidth: (id: ViewId, pct: number) => void;
  resetView: (id: ViewId) => void;
  resetAll: () => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  activeView: "front",
  views: initialViews(),
  setActiveView: (id) => set({ activeView: id }),
  setMockup: (id, mockup) =>
    set((s) => ({ views: { ...s.views, [id]: { ...s.views[id], mockup } } })),
  setLogo: (id, logo) =>
    set((s) => ({ views: { ...s.views, [id]: { ...s.views[id], logo } } })),
  setPosition: (id, positionXPct, positionYPct) =>
    set((s) => ({
      views: {
        ...s.views,
        [id]: { ...s.views[id], positionXPct, positionYPct },
      },
    })),
  setLogoWidth: (id, logoWidthPct) =>
    set((s) => ({
      views: { ...s.views, [id]: { ...s.views[id], logoWidthPct } },
    })),
  resetView: (id) =>
    set((s) => ({ views: { ...s.views, [id]: { ...DEFAULT_VIEW_STATE } } })),
  resetAll: () => set({ views: initialViews(), activeView: "front" }),
}));
