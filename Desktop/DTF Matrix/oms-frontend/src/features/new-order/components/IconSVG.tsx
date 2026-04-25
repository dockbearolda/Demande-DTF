interface IconSVGProps {
  type: "shirt" | "keys" | "cup" | "trophy" | "gift" | "box";
  className?: string;
  size?: number;
}

export function IconSVG({ type, className = "", size = 24 }: IconSVGProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (type) {
    case "shirt":
      return (
        <svg {...common}>
          <path d="M8 3 L4 6 L6 9 L8 8 V20 H16 V8 L18 9 L20 6 L16 3 L14 4 Q12 6 10 4 Z" />
        </svg>
      );
    case "keys":
      return (
        <svg {...common}>
          <circle cx="8" cy="14" r="4" />
          <path d="M11 14 L20 14 L20 17 M17 14 L17 17" />
        </svg>
      );
    case "cup":
      return (
        <svg {...common}>
          <path d="M5 6 H17 V14 Q17 18 13 18 H9 Q5 18 5 14 Z" />
          <path d="M17 8 H20 Q21 8 21 10 V12 Q21 14 20 14 H17" />
          <path d="M5 21 H17" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M8 4 H16 V10 Q16 14 12 14 Q8 14 8 10 Z" />
          <path d="M8 6 H5 Q3 6 3 8 Q3 10 5 11 H8" />
          <path d="M16 6 H19 Q21 6 21 8 Q21 10 19 11 H16" />
          <path d="M12 14 V18" />
          <path d="M8 20 H16" />
          <path d="M10 18 H14 V20 H10 Z" />
        </svg>
      );
    case "gift":
      return (
        <svg {...common}>
          <path d="M4 9 H20 V11 H4 Z" />
          <path d="M5 11 V20 H19 V11" />
          <path d="M12 9 V20" />
          <path d="M9 9 Q7 9 7 7 Q7 5 9 5 Q11 5 12 9" />
          <path d="M15 9 Q17 9 17 7 Q17 5 15 5 Q13 5 12 9" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path d="M3 7 L12 3 L21 7 V17 L12 21 L3 17 Z" />
          <path d="M3 7 L12 11 L21 7" />
          <path d="M12 11 V21" />
        </svg>
      );
    default:
      return null;
  }
}
