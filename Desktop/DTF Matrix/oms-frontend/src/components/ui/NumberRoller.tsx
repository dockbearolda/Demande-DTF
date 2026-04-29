import type { CSSProperties } from "react";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function DigitCol({ char, rowH }: { char: string; rowH: number }) {
  if (!/\d/.test(char)) {
    return (
      <span style={{ display: "inline-block", lineHeight: `${rowH}px`, height: rowH }}>
        {char}
      </span>
    );
  }

  const d = parseInt(char, 10);

  return (
    <span
      style={{
        display: "inline-block",
        height: rowH,
        overflow: "hidden",
        verticalAlign: "top",
      }}
    >
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          transform: `translateY(${-d * rowH}px)`,
          transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
        }}
      >
        {DIGITS.map((n) => (
          <span key={n} style={{ display: "block", height: rowH, lineHeight: `${rowH}px` }}>
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Odometer-style digit roller. Each digit column slides vertically to its
 * new value on every change.
 *
 * Font styling (fontFamily, fontWeight, color) should be supplied via
 * `className` (Tailwind) or `style` on the outer span — inner digit spans
 * inherit everything via the CSS cascade, so there is no duplication.
 *
 * The `fontSize` prop (number, default 13) is the only value required at
 * render time because it determines the row height of each digit column.
 * Pass it whenever you use Tailwind font-size classes, e.g.:
 *   <NumberRoller value={x} fontSize={28} className="font-mono text-[28px] font-extrabold" />
 *
 * Columns are keyed from the right so integer digits animate in place when
 * the string grows (999 → 1 000) — only new columns appear on the left.
 */
export function NumberRoller({
  value,
  fontSize = 13,
  className,
  style,
}: {
  value: string;
  fontSize?: number;
  className?: string;
  style?: CSSProperties;
}) {
  // Auto-resolve from style.fontSize when available (inline-style users don't
  // need to pass fontSize twice); Tailwind users pass fontSize explicitly.
  const resolvedSize =
    typeof style?.fontSize === "number"
      ? style.fontSize
      : typeof style?.fontSize === "string"
        ? parseFloat(style.fontSize)
        : fontSize;
  const rowH = Math.ceil(resolvedSize * 1.5);
  const chars = Array.from(value);

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "flex-start", ...style }}
    >
      {chars.map((char, i) => (
        <DigitCol key={chars.length - 1 - i} char={char} rowH={rowH} />
      ))}
    </span>
  );
}
