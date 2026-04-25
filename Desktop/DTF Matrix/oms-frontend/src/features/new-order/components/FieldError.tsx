import type { ReactNode } from "react";

interface Props {
  id: string;
  /** When falsy the slot stays in DOM but hidden — preserves layout. */
  message?: string | ReactNode;
}

/**
 * FieldError — accessible inline error message.
 *
 * Pair with the controlling field via `aria-describedby={id}` and
 * `aria-invalid="true"`. The element keeps `role="alert"` so the message
 * is announced by assistive tech the moment validation fails.
 *
 * Reserves vertical space (min-h) to avoid layout shift on toggle.
 */
export function FieldError({ id, message }: Props) {
  const visible = !!message;
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={`mt-1.5 flex min-h-[18px] items-start gap-1 text-[12px] font-medium leading-tight transition-opacity duration-150 ${
        visible ? "text-rose-700 opacity-100" : "opacity-0"
      }`}
    >
      {visible && (
        <>
          <WarnIcon className="mt-[1px] h-3.5 w-3.5 flex-none text-rose-700" aria-hidden="true" />
          <span>{message}</span>
        </>
      )}
    </p>
  );
}

function WarnIcon({ className, ...rest }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
