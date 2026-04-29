import Konva from "konva";
import { Plus, Trash2 } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Image as KonvaImage, Layer, Line, Stage, Transformer } from "react-konva";
import { useToast } from "@/components/Toast";
import { useStudioStore } from "../store";
import { VIEW_LABELS } from "../types";
import { ingestLogo, ingestMockup, IngestError } from "../ingest";

const SNAP_TOLERANCE = 4;
const MIN_LOGO_WIDTH_PCT = 5;
const MAX_LOGO_WIDTH_PCT = 80;

const MOCKUP_ACCEPT = "image/png,image/jpeg";
const LOGO_ACCEPT = "image/png,image/jpeg,image/svg+xml,application/pdf";

const imageCache = new Map<string, HTMLImageElement>();

function useCachedImage(src: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(() => {
    if (!src) return null;
    const hit = imageCache.get(src);
    return hit && hit.complete && hit.naturalWidth > 0 ? hit : null;
  });

  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    const hit = imageCache.get(src);
    if (hit && hit.complete && hit.naturalWidth > 0) {
      setImg(hit);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      imageCache.set(src, image);
      setImg(image);
    };
    image.onerror = () => {
      if (!cancelled) setImg(null);
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return img;
}

function useContainerSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export function CanvasStage() {
  const { show } = useToast();
  const activeView = useStudioStore((s) => s.activeView);
  const view = useStudioStore((s) => s.views[activeView]);
  const setMockup = useStudioStore((s) => s.setMockup);
  const setLogo = useStudioStore((s) => s.setLogo);
  const setPosition = useStudioStore((s) => s.setPosition);
  const setLogoWidth = useStudioStore((s) => s.setLogoWidth);

  const containerRef = useRef<HTMLDivElement>(null);
  const mockupInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { width: boxW, height: boxH } = useContainerSize(containerRef);

  const mockupImg = useCachedImage(view.mockup?.dataUrl ?? null);
  const logoImg = useCachedImage(view.logo?.dataUrl ?? null);

  const mockupAspect = view.mockup ? view.mockup.naturalWidth / view.mockup.naturalHeight : 1;

  const stageSize = useMemo(() => {
    if (!boxW || !boxH) return { width: 0, height: 0 };
    const maxW = boxW;
    const maxH = boxH;
    const fitW = Math.min(maxW, maxH * mockupAspect);
    const fitH = fitW / mockupAspect;
    return { width: Math.round(fitW), height: Math.round(fitH) };
  }, [boxW, boxH, mockupAspect]);

  const deferredX = useDeferredValue(view.positionXPct);
  const deferredY = useDeferredValue(view.positionYPct);
  const deferredW = useDeferredValue(view.logoWidthPct);

  const logoRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [snap, setSnap] = useState<{ vertical: boolean; horizontal: boolean }>({
    vertical: false,
    horizontal: false,
  });

  const logoAspect = useMemo(() => {
    if (!view.logo) return 1;
    return view.logo.naturalWidth / view.logo.naturalHeight;
  }, [view.logo]);

  const logoPx = useMemo(() => {
    if (!stageSize.width || !view.logo) return null;
    const width = (deferredW / 100) * stageSize.width;
    const height = width / logoAspect;
    const x = (deferredX / 100) * stageSize.width;
    const y = (deferredY / 100) * stageSize.height;
    return { x, y, width, height };
  }, [stageSize, view.logo, deferredW, deferredX, deferredY, logoAspect]);

  useEffect(() => {
    const tr = transformerRef.current;
    const node = logoRef.current;
    if (!tr) return;
    if (node && logoImg) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [logoImg, view.logo, activeView]);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!stageSize.width) return;
      const node = e.target;
      const cx = stageSize.width / 2;
      const cy = stageSize.height / 2;
      let x = node.x();
      let y = node.y();
      const snapV = Math.abs(x - cx) < SNAP_TOLERANCE;
      const snapH = Math.abs(y - cy) < SNAP_TOLERANCE;
      if (snapV) x = cx;
      if (snapH) y = cy;
      node.x(x);
      node.y(y);
      setSnap({ vertical: snapV, horizontal: snapH });
    },
    [stageSize.width, stageSize.height],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      setSnap({ vertical: false, horizontal: false });
      if (!stageSize.width) return;
      const node = e.target;
      const newXPct = (node.x() / stageSize.width) * 100;
      const newYPct = (node.y() / stageSize.height) * 100;
      setPosition(activeView, clamp(newXPct, 0, 100), clamp(newYPct, 0, 100));
    },
    [stageSize.width, stageSize.height, setPosition, activeView],
  );

  const handleTransformEnd = useCallback(() => {
    const node = logoRef.current;
    if (!node || !stageSize.width) return;
    const scaleX = node.scaleX();
    node.scaleX(1);
    node.scaleY(1);
    const newWidthPx = Math.max(1, node.width() * scaleX);
    const newXPct = (node.x() / stageSize.width) * 100;
    const newYPct = (node.y() / stageSize.height) * 100;
    const newSizePct = clamp(
      (newWidthPx / stageSize.width) * 100,
      MIN_LOGO_WIDTH_PCT,
      MAX_LOGO_WIDTH_PCT,
    );
    setPosition(activeView, clamp(newXPct, 0, 100), clamp(newYPct, 0, 100));
    setLogoWidth(activeView, Math.round(newSizePct));
  }, [stageSize.width, stageSize.height, setPosition, setLogoWidth, activeView]);

  async function handleMockupFile(f: File) {
    try {
      const asset = await ingestMockup(f);
      setMockup(activeView, asset);
    } catch (err) {
      show(err instanceof IngestError ? err.message : "Mockup illisible", "error");
    }
  }

  async function handleLogoFile(f: File) {
    try {
      const asset = await ingestLogo(f);
      setLogo(activeView, asset);
    } catch (err) {
      show(err instanceof IngestError ? err.message : "Logo illisible", "error");
    }
  }

  const hasMockup = view.mockup !== null;
  const hasLogo = view.logo !== null;

  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,theme(colors.slate.200)_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(circle_at_center,theme(colors.slate.800)_1px,transparent_1px)]">
      <div
        ref={containerRef}
        className="relative flex aspect-square w-full max-w-[620px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        {!hasMockup ? (
          <button
            type="button"
            onClick={() => mockupInputRef.current?.click()}
            className="group flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 px-10 py-8 text-slate-400 transition hover:border-slate-900 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-200 dark:hover:bg-slate-800/40 dark:hover:text-slate-100"
          >
            <Plus className="h-10 w-10" strokeWidth={1.5} />
            <span className="text-sm font-medium">Ajouter un mockup</span>
          </button>
        ) : stageSize.width > 0 ? (
          <Stage width={stageSize.width} height={stageSize.height}>
            <Layer listening={false}>
              {mockupImg && (
                <KonvaImage
                  image={mockupImg}
                  x={activeView === "sleeve_left" ? stageSize.width : 0}
                  y={0}
                  width={stageSize.width}
                  height={stageSize.height}
                  scaleX={activeView === "sleeve_left" ? -1 : 1}
                  listening={false}
                />
              )}
            </Layer>
            <Layer>
              {logoImg && logoPx && (
                <KonvaImage
                  ref={logoRef}
                  image={logoImg}
                  x={logoPx.x}
                  y={logoPx.y}
                  width={logoPx.width}
                  height={logoPx.height}
                  offsetX={logoPx.width / 2}
                  offsetY={logoPx.height / 2}
                  draggable
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  onTransformEnd={handleTransformEnd}
                />
              )}
              <Transformer
                ref={transformerRef}
                rotateEnabled={false}
                keepRatio
                enabledAnchors={[
                  "top-left",
                  "top-right",
                  "bottom-left",
                  "bottom-right",
                ]}
                boundBoxFunc={(oldBox, newBox) => {
                  const minPx = (MIN_LOGO_WIDTH_PCT / 100) * stageSize.width;
                  const maxPx = (MAX_LOGO_WIDTH_PCT / 100) * stageSize.width;
                  if (newBox.width < minPx || newBox.width > maxPx) return oldBox;
                  return newBox;
                }}
              />
              {snap.vertical && (
                <Line
                  points={[stageSize.width / 2, 0, stageSize.width / 2, stageSize.height]}
                  stroke="#ec4899"
                  strokeWidth={1}
                  dash={[4, 4]}
                  listening={false}
                />
              )}
              {snap.horizontal && (
                <Line
                  points={[0, stageSize.height / 2, stageSize.width, stageSize.height / 2]}
                  stroke="#ec4899"
                  strokeWidth={1}
                  dash={[4, 4]}
                  listening={false}
                />
              )}
            </Layer>
          </Stage>
        ) : null}

        {hasMockup && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-1.5 py-1 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                title={hasLogo ? "Remplacer le logo" : "Ajouter un logo"}
              >
                <Plus className="h-3.5 w-3.5" />
                {hasLogo ? "Remplacer le logo" : "Ajouter un logo"}
              </button>
              {hasLogo && (
                <button
                  type="button"
                  onClick={() => setLogo(activeView, null)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  title="Retirer le logo"
                  aria-label="Retirer le logo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm backdrop-blur dark:bg-slate-950/80 dark:text-slate-400">
          {VIEW_LABELS[activeView]}
        </div>

        {hasMockup && (
          <button
            type="button"
            onClick={() => setMockup(activeView, null)}
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-slate-400 shadow-sm backdrop-blur transition hover:bg-white hover:text-slate-700 dark:bg-slate-950/80 dark:hover:bg-slate-900 dark:hover:text-slate-200"
            title="Retirer le mockup"
            aria-label="Retirer le mockup"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        <input
          ref={mockupInputRef}
          type="file"
          accept={MOCKUP_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleMockupFile(f);
            e.target.value = "";
          }}
        />
        <input
          ref={logoInputRef}
          type="file"
          accept={LOGO_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleLogoFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
