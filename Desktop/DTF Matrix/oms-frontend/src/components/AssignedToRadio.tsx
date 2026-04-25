interface Operator {
  value: string;
  label: string;
}

interface AssignedToRadioProps {
  value: string;
  onChange: (value: string) => void;
  operators: Operator[];
}

export function AssignedToRadio({
  value,
  onChange,
  operators,
}: AssignedToRadioProps) {
  return (
    <div className="flex gap-4">
      {operators.map((op) => (
        <label key={op.value} className="flex items-center gap-2">
          <input
            type="radio"
            name="assigned_to"
            value={op.value}
            checked={value === op.value}
            onChange={(e) => onChange(e.target.value)}
            className="cursor-pointer"
          />
          <span className="text-sm" style={{ color: "var(--fg-2)" }}>
            {op.label}
          </span>
        </label>
      ))}
    </div>
  );
}
