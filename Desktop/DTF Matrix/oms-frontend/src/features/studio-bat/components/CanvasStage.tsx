import Konva from "konva";
import { ImageOff } from "lucide-react";
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
import { useStudioStore } from "../store";
import { VIEW_LABELS } from "../types";

const SNAP_TOLERANCE = 4;
const MIN_LOGO_WIDTH_PCT = 5;
const MAX_LOGO_WIDTH_PCT = 80;

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
  const activeView = useStudioStore((s) => s.activeView);
  const view = useStudioStore((s) => s.views[activeView]);
  const setPosition = useStudioStore((s) => s.setPosition);
  const setLogoWidth = useStudioStore((s) => s.setLogoWidth);

  const containerRef = useRef<HTMLDivElement>(null);
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

  const hasMockup = view.mockup !== null;

  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,theme(colors.slate.200)_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(circle_at_center,theme(colors.slate.800)_1px,transparent_1px)]">
      <div
        ref={containerRef}
        className="relative flex aspect-square w-full max-w-[620px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        {!hasMockup ? (
          <div className="flex flex-col items-center gap-2 text-center text-slate-400">
            <ImageOff className="h-8 w-8" strokeWidth={1.5} />
            <div className="text-sm font-medium">Aucun mockup chargé</div>
            <div className="text-xs">
              Ajoute un visuel fournisseur pour la vue{" "}
              <span className="font-semibold">{VIEW_LABELS[activeView]}</span>
            </div>
          </div>
        ) : stageSize.width > 0 ? (
          <Stage width={stageSize.width} height={stageSize.height}>
            <Layer listening={false}>
              {mockupImg && (
                <KonvaImage
                  image={mockupImg}
                  width={stageSize.width}
                  height={stageSize.height}
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

        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm backdrop-blur dark:bg-slate-950/80 dark:text-slate-400">
          {VIEW_LABELS[activeView]}
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
