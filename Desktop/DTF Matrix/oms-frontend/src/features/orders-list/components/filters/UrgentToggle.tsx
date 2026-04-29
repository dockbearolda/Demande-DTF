interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
}

function IconFlame() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2s4 4 4 8a4 4 0 1 1-8 0c0-1.5.5-2.5 1-3.5C10 4 12 2 12 2z" />
      <path d="M6 14c0 4 3 7 6 7s6-3 6-7" />
    </svg>
  );
}

/**
 * Toggle "Urgents seulement" — pill ambre quand actif, neutre sinon.
 * Token DS `--color-urgent` / `--color-urgent-soft`.
 */
export function UrgentToggle({ value, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 32,
        padding: "0 12px",
        borderRadius: 999,
        border: "1px solid",
        borderColor: value ? "var(--color-urgent)" : "var(--brand-sage-100)",
        background: value ? "var(--color-urgent-soft)" : "var(--brand-paper-hi)",
        color: value ? "var(--color-urgent-ink)" : "var(--fg-2)",
        fontSize: 12.5,
        fontWeight: value ? 700 : 500,
        whiteSpace: "nowrap",
      }}
    >
      <IconFlame />
      Urgents
    </button>
  );
}
