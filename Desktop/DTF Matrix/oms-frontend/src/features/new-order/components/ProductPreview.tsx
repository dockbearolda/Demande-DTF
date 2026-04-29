import { memo, useMemo } from "react";
import type { ProductCategoryId } from "../constants";
import type { LogoPlacement } from "./LogoPlacementSelector";

interface Props {
  categoryId: ProductCategoryId | null;
  /** Hex fill for the silhouette body. Defaults to a neutral paper tone. */
  color?: string | null;
  /** Visible color label (e.g. "Marine") shown under the silhouette. */
  colorLabel?: string | null;
  /** Logo placement zone — only meaningful for textile previews. */
  placement?: LogoPlacement | null;
  /** Optional caption (e.g. model name). */
  caption?: string | null;
  className?: string;
}

const NEUTRAL_FILL = "#EBEAE8";

/**
 * Best-effort luminance check — chooses a light/dark logo placeholder color
 * that stays visible against the chosen body fill.
 */
function isDarkHex(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.55;
}

export const ProductPreview = memo(function ProductPreview({
  categoryId,
  color,
  colorLabel,
  placement,
  caption,
  className,
}: Props) {
  const fill = color ?? NEUTRAL_FILL;
  const dark = useMemo(() => isDarkHex(fill), [fill]);
  const stroke = dark ? "rgba(255,255,255,0.16)" : "rgba(74,98,116,0.20)";
  const logoColor = dark ? "rgba(255,255,255,0.78)" : "rgba(74,98,116,0.78)";

  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ""}`}>
      <div
        className="flex h-44 w-full items-center justify-center rounded-xl"
        style={{ background: "var(--brand-paper-hi)" }}
      >
        <Silhouette
          categoryId={categoryId}
          fill={fill}
          stroke={stroke}
          logoColor={logoColor}
          placement={placement}
        />
      </div>
      {(caption || colorLabel) && (
        <div className="flex w-full flex-col items-center gap-0.5">
          {caption && (
            <span className="text-[12px] font-semibold leading-tight text-fg-1">
              {caption}
            </span>
          )}
          {colorLabel && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-fg-3">
              <span
                aria-hidden="true"
                className="block h-2.5 w-2.5 rounded-full"
                style={{
                  background: fill,
                  boxShadow: "inset 0 0 0 1px rgba(74,98,116,0.18)",
                }}
              />
              {colorLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

// ───────── Silhouette switcher ─────────

function Silhouette({
  categoryId,
  fill,
  stroke,
  logoColor,
  placement,
}: {
  categoryId: ProductCategoryId | null;
  fill: string;
  stroke: string;
  logoColor: string;
  placement: LogoPlacement | null | undefined;
}) {
  switch (categoryId) {
    case "textile":
      return (
        <TshirtSilhouette
          fill={fill}
          stroke={stroke}
          logoColor={logoColor}
          placement={placement ?? null}
        />
      );
    case "tasses-gourdes":
      return <MugSilhouette fill={fill} stroke={stroke} />;
    case "trophees-medailles":
      return <TrophySilhouette fill={fill} stroke={stroke} />;
    case "porte-cles-plexiglass":
    case "porte-cles-acrylique":
      return <KeychainSilhouette fill={fill} stroke={stroke} />;
    case "goodies":
      return <GiftSilhouette fill={fill} stroke={stroke} />;
    default:
      return <PlaceholderSilhouette />;
  }
}

// ───────── T-shirt with logo placement zones ─────────

function TshirtSilhouette({
  fill,
  stroke,
  logoColor,
  placement,
}: {
  fill: string;
  stroke: string;
  logoColor: string;
  placement: LogoPlacement | null;
}) {
  const showBack = placement === "back";

  return (
    <svg
      viewBox="0 0 220 160"
      className="h-full max-h-full w-auto"
      role="img"
      aria-label="Aperçu textile"
    >
      <g transform="translate(50,0)">
        <ShirtBody fill={fill} stroke={stroke} back={showBack} scale={1} />
        {!showBack && (
          <PlacementZone
            placement={placement}
            logoColor={logoColor}
            offsetX={0}
            scale={1}
          />
        )}
      </g>

      {showBack && (
        <PlacementZone
          placement="back"
          logoColor={logoColor}
          offsetX={0}
          scale={1}
        />
      )}
    </svg>
  );
}

function ShirtBody({
  fill,
  stroke,
  back,
  scale = 1,
}: {
  fill: string;
  stroke: string;
  back?: boolean;
  scale?: number;
}) {
  // Symmetric tee silhouette in a 120×150 box
  // Origin: top-left of the bounding box
  const w = 120 * scale;
  const h = 150 * scale;
  return (
    <g>
      <path
        className="no-preview-fill"
        d={`M ${20 * scale} ${15 * scale}
            L ${42 * scale} ${5 * scale}
            ${
              back
                ? `Q ${60 * scale} ${15 * scale} ${78 * scale} ${5 * scale}`
                : `Q ${60 * scale} ${22 * scale} ${78 * scale} ${5 * scale}`
            }
            L ${100 * scale} ${15 * scale}
            L ${115 * scale} ${38 * scale}
            L ${95 * scale} ${48 * scale}
            L ${95 * scale} ${h - 10 * scale}
            Q ${95 * scale} ${h} ${85 * scale} ${h}
            L ${35 * scale} ${h}
            Q ${25 * scale} ${h} ${25 * scale} ${h - 10 * scale}
            L ${25 * scale} ${48 * scale}
            L ${5 * scale} ${38 * scale} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* Subtle collar/seam detail */}
      {!back && (
        <path
          d={`M ${42 * scale} ${5 * scale} Q ${60 * scale} ${22 * scale} ${78 * scale} ${5 * scale}`}
          fill="none"
          stroke={stroke}
          strokeWidth={1.2}
        />
      )}
      {/* width var to silence ts unused */}
      <rect x={0} y={0} width={w} height={0} fill="transparent" />
    </g>
  );
}

function PlacementZone({
  placement,
  logoColor,
  offsetX,
  scale,
}: {
  placement: LogoPlacement | null;
  logoColor: string;
  offsetX: number;
  scale: number;
}) {
  if (!placement) return null;

  // Placement coordinates relative to the same 120×150 shirt bounding box.
  const zones: Record<
    LogoPlacement,
    { x: number; y: number; w: number; h: number; label?: string }
  > = {
    front: { x: 45, y: 60, w: 30, h: 22 },
    back: { x: 38, y: 55, w: 44, h: 30 },
  };
  const zone = zones[placement];
  if (!zone) return null;

  return (
    <g
      key={placement}
      transform={`translate(${offsetX},0)`}
      className="no-pulse-once"
    >
      <rect
        x={zone.x * scale}
        y={zone.y * scale}
        width={zone.w * scale}
        height={zone.h * scale}
        rx={2 * scale}
        fill={logoColor}
        opacity={0.9}
      />
      {zone.label && (
        <text
          x={(zone.x + zone.w / 2) * scale}
          y={(zone.y + zone.h / 2 + 3) * scale}
          textAnchor="middle"
          fontSize={10 * scale}
          fontWeight={700}
          fill="white"
        >
          {zone.label}
        </text>
      )}
    </g>
  );
}

// ───────── Other product silhouettes ─────────

function MugSilhouette({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <svg viewBox="0 0 160 160" className="h-full max-h-full w-auto" role="img" aria-label="Aperçu mug">
      <path
        className="no-preview-fill"
        d="M 40 38 H 110 V 110 Q 110 130 90 130 H 60 Q 40 130 40 110 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.6}
      />
      <path
        d="M 110 60 H 130 Q 138 60 138 72 V 92 Q 138 104 130 104 H 110"
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
      />
      <ellipse cx={75} cy={42} rx={35} ry={5} fill="rgba(255,255,255,0.08)" />
    </svg>
  );
}

function TrophySilhouette({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <svg viewBox="0 0 160 160" className="h-full max-h-full w-auto" role="img" aria-label="Aperçu trophée">
      <path
        className="no-preview-fill"
        d="M 55 25 H 105 V 70 Q 105 95 80 95 Q 55 95 55 70 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.6}
      />
      <path d="M 55 38 H 38 Q 26 38 26 52 Q 26 70 50 74" fill="none" stroke={stroke} strokeWidth={1.6} />
      <path d="M 105 38 H 122 Q 134 38 134 52 Q 134 70 110 74" fill="none" stroke={stroke} strokeWidth={1.6} />
      <path d="M 80 95 V 115" fill="none" stroke={stroke} strokeWidth={1.6} />
      <rect x={62} y={115} width={36} height={10} rx={2} fill={fill} stroke={stroke} strokeWidth={1.6} className="no-preview-fill" />
      <rect x={50} y={128} width={60} height={8} rx={2} fill={fill} stroke={stroke} strokeWidth={1.6} className="no-preview-fill" />
    </svg>
  );
}

function KeychainSilhouette({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <svg viewBox="0 0 160 160" className="h-full max-h-full w-auto" role="img" aria-label="Aperçu porte-clés">
      <circle cx={45} cy={80} r={22} fill="none" stroke={stroke} strokeWidth={2.2} />
      <circle cx={45} cy={80} r={6} fill="none" stroke={stroke} strokeWidth={1.6} />
      <rect
        x={70}
        y={50}
        width={70}
        height={60}
        rx={6}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.6}
        className="no-preview-fill"
      />
      <rect x={82} y={68} width={46} height={6} rx={2} fill="rgba(74,98,116,0.25)" />
      <rect x={82} y={82} width={32} height={6} rx={2} fill="rgba(74,98,116,0.18)" />
    </svg>
  );
}

function GiftSilhouette({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <svg viewBox="0 0 160 160" className="h-full max-h-full w-auto" role="img" aria-label="Aperçu goodies">
      <rect
        x={30}
        y={60}
        width={100}
        height={70}
        rx={4}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.6}
        className="no-preview-fill"
      />
      <rect x={26} y={56} width={108} height={14} rx={3} fill={fill} stroke={stroke} strokeWidth={1.6} className="no-preview-fill" />
      <rect x={74} y={56} width={12} height={74} fill="rgba(74,98,116,0.18)" />
      <path d="M 80 56 Q 70 40 60 46 Q 56 52 80 56" fill="none" stroke={stroke} strokeWidth={1.6} />
      <path d="M 80 56 Q 90 40 100 46 Q 104 52 80 56" fill="none" stroke={stroke} strokeWidth={1.6} />
    </svg>
  );
}

function PlaceholderSilhouette() {
  return (
    <svg viewBox="0 0 160 160" className="h-full max-h-full w-auto" role="img" aria-label="Aperçu produit">
      <rect
        x={28}
        y={28}
        width={104}
        height={104}
        rx={10}
        fill="none"
        stroke="rgba(74,98,116,0.22)"
        strokeWidth={1.6}
        strokeDasharray="4 5"
      />
      <path
        d="M 60 100 L 78 78 L 92 92 L 110 70"
        fill="none"
        stroke="rgba(74,98,116,0.30)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={66} cy={62} r={6} fill="rgba(74,98,116,0.20)" />
    </svg>
  );
}
