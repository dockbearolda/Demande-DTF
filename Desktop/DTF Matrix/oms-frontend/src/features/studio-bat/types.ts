export type ViewId = "front" | "back" | "sleeve_left" | "sleeve_right";

export const VIEW_ORDER: ViewId[] = ["front", "back", "sleeve_left", "sleeve_right"];

export const VIEW_LABELS: Record<ViewId, string> = {
  front: "Avant",
  back: "Arrière",
  sleeve_left: "Manche gauche",
  sleeve_right: "Manche droite",
};

export interface LogoAsset {
  dataUrl: string;
  mime: string;
  name: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface MockupAsset {
  dataUrl: string;
  mime: string;
  name: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface ViewState {
  mockup: MockupAsset | null;
  logo: LogoAsset | null;
  positionXPct: number;
  positionYPct: number;
  logoWidthPct: number;
}

export const DEFAULT_VIEW_STATE: ViewState = {
  mockup: null,
  logo: null,
  positionXPct: 50,
  positionYPct: 30,
  logoWidthPct: 30,
};
