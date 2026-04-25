interface SecteurChipsProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

export function SecteurChips({ value, onChange, options }: SecteurChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          style={
            value === option
              ? {
                  background: "var(--brand-duck-500)",
                  color: "var(--fg-on-primary)",
                  border: "1px solid transparent",
                }
              : {
                  background: "var(--brand-paper-hi)",
                  color: "var(--fg-2)",
                  border: "1px solid var(--brand-sage-100)",
                }
          }
          className="rounded-full px-3 py-1 text-sm font-medium transition"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
