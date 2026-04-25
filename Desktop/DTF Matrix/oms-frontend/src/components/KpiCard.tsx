import { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "danger" | "success";
  hint?: string;
}

export function KpiCard({ label, value, tone = "neutral", hint }: Props) {
  const border =
    tone === "danger"
      ? "var(--color-danger)"
      : tone === "success"
        ? "var(--status-delivered-bg, #16a34a)"
        : "var(--brand-sage-100)";
  const bg =
    tone === "danger"
      ? "color-mix(in srgb, var(--color-danger) 8%, var(--brand-paper))"
      : tone === "success"
        ? "color-mix(in srgb, var(--status-delivered-bg, #16a34a) 8%, var(--brand-paper))"
        : "var(--brand-paper)";
  const valueColor =
    tone === "danger"
      ? "var(--color-danger)"
      : tone === "success"
        ? "var(--status-delivered-bg, #16a34a)"
        : "var(--fg-1)";

  return (
    <div
      className="rounded-xl p-5 transition-colors"
      style={{ border: `1px solid ${border}`, background: bg, boxShadow: "var(--shadow-1)" }}
    >
      <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--fg-3)" }}>
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums" style={{ color: valueColor }}>
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs" style={{ color: "var(--fg-3)" }}>{hint}</div>
      ) : null}
    </div>
  );
}
