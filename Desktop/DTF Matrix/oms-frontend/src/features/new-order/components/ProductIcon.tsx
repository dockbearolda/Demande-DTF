import type { Target } from "../types";

export type ProductTarget = Target | "BEBE";

const STROKE = "#94a3b8"; // slate-400
const FILL   = "#f1f5f9"; // slate-100
const BG     = "#f8fafc"; // slate-50

interface IconProps { size: number }

function HommeIcon({ size }: IconProps) {
  // T-shirt col ras-du-cou, épaules larges, coupe droite
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.5 3.5 L4.5 5.5 L1.5 9 L6.5 10.2 L6.5 21 L17.5 21 L17.5 10.2 L22.5 9 L19.5 5.5 L14.5 3.5 C13.2 6.8 10.8 6.8 9.5 3.5Z"
        fill={FILL} stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <line x1="6.5" y1="10.2" x2="6.5" y2="12.5" stroke={STROKE} strokeWidth="0.75" strokeLinecap="round" opacity="0.5" />
      <line x1="17.5" y1="10.2" x2="17.5" y2="12.5" stroke={STROKE} strokeWidth="0.75" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function FemmeIcon({ size }: IconProps) {
  // T-shirt col en V, coupe légèrement cintrée
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.5 4 L5 5.5 L2 9 L7 10.2 L7 21 L17 21 L17 10.2 L22 9 L19 5.5 L14.5 4 L12 8.5 L9.5 4Z"
        fill={FILL} stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <line x1="7" y1="10.2" x2="7" y2="13" stroke={STROKE} strokeWidth="0.75" strokeLinecap="round" opacity="0.5" />
      <line x1="17" y1="10.2" x2="17" y2="13" stroke={STROKE} strokeWidth="0.75" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function EnfantIcon({ size }: IconProps) {
  // T-shirt enfant — manches larges, poche poitrine
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 3.5 L3.5 5.5 L1 9.5 L6.5 11 L6.5 21 L17.5 21 L17.5 11 L23 9.5 L20.5 5.5 L15 3.5 C13.5 7 10.5 7 9 3.5Z"
        fill={FILL} stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <rect x="10.5" y="12.5" width="3" height="2.5" rx="0.5" fill="none" stroke={STROKE} strokeWidth="0.85" opacity="0.5" />
    </svg>
  );
}

function BebeIcon({ size }: IconProps) {
  // Body bébé — languette crotch avec deux pressions
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 3.5 L4.5 5 L2 8.5 L6.5 9.5 L6.5 19 L10 19 L10 21.5 L14 21.5 L14 19 L17.5 19 L17.5 9.5 L22 8.5 L19.5 5 L15 3.5 C13.5 6.5 10.5 6.5 9 3.5Z"
        fill={FILL} stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="11" cy="21.5" r="0.9" fill={STROKE} />
      <circle cx="13" cy="21.5" r="0.9" fill={STROKE} />
    </svg>
  );
}

interface ProductIconProps {
  target: ProductTarget | null;
  /** SVG rendered size in px — defaults to 22 for 40px containers, use 32 for 60px containers */
  size?: number;
  className?: string;
}

export function ProductIcon({ target, size = 22, className = "" }: ProductIconProps) {
  const key: ProductTarget = target ?? "HOMME";

  return (
    <div
      className={`flex h-full w-full items-center justify-center ${className}`}
      style={{ background: BG }}
      aria-hidden="true"
    >
      {key === "FEMME"  ? <FemmeIcon  size={size} /> :
       key === "ENFANT" ? <EnfantIcon size={size} /> :
       key === "BEBE"   ? <BebeIcon   size={size} /> :
                          <HommeIcon  size={size} />}
    </div>
  );
}
