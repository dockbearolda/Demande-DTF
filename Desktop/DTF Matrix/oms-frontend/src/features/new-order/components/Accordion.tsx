import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode, KeyboardEvent, TransitionEvent } from "react";

export interface AccordionItemProps {
  /** Stable id, used as React key + aria attribute target. */
  id: string;
  /** Whether the panel is currently expanded. */
  expanded: boolean;
  /** Header content — clickable surface that toggles expand/collapse. */
  header: ReactNode;
  /** Panel content — only rendered while `expanded` is true (anim wraps it). */
  children?: ReactNode;
  /** Called when the user clicks the header or hits Enter while focused. */
  onToggle: () => void;
  /** Optional callback fired when the user hits Escape inside the panel. */
  onEscape?: () => void;
  /** Optional CSS class on the root. */
  className?: string;
}

/**
 * Minimal in-house accordion item — no external dependency.
 *
 * - The header is a focusable surface (button-like div with role="button")
 *   so the wrapping element can host other clickable widgets (drag handle,
 *   menu) without nesting two interactive elements.
 * - Smooth open/close via CSS grid-rows trick (1fr ↔ 0fr) — no JS height
 *   measurement, no layout thrash.
 * - aria-expanded on the header, aria-controls + role="region" on the panel.
 */
export function AccordionItem({
  id,
  expanded,
  header,
  children,
  onToggle,
  onEscape,
  className,
}: AccordionItemProps) {
  const headerId = `accordion-header-${id}`;
  const panelId = `accordion-panel-${id}`;
  const panelRef = useRef<HTMLDivElement | null>(null);

  // While the panel is animating (or fully collapsed), keep `overflow-hidden`
  // so the close transition clips correctly. Once the open animation has
  // settled, allow overflow so popovers/dropdowns inside the panel (e.g. the
  // color picker) can escape the panel's bounding box instead of being cut off.
  const [transitioning, setTransitioning] = useState(false);
  const prevExpanded = useRef(expanded);
  useEffect(() => {
    if (prevExpanded.current === expanded) return;
    prevExpanded.current = expanded;
    setTransitioning(true);
  }, [expanded]);
  const onTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName === "grid-template-rows") setTransitioning(false);
    },
    [],
  );
  const allowOverflow = expanded && !transitioning;

  const onHeaderKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle],
  );

  const onPanelKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && onEscape) {
        e.stopPropagation();
        onEscape();
      }
    },
    [onEscape],
  );

  // Move focus into the panel's first interactive element when it opens —
  // helps keyboard users land directly on the editable area without an
  // extra Tab.
  useEffect(() => {
    if (!expanded) return;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([aria-hidden="true"])',
    );
    // Defer to give layout a tick to apply.
    const t = window.setTimeout(() => first?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(t);
  }, [expanded]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        id={headerId}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        onKeyDown={onHeaderKeyDown}
        className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 rounded-xl"
      >
        {header}
      </div>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        ref={panelRef}
        onKeyDown={onPanelKeyDown}
        onTransitionEnd={onTransitionEnd}
        className={`grid grid-cols-[minmax(0,1fr)] transition-[grid-template-rows] duration-300 ease-in-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div
          className={`min-w-0 ${allowOverflow ? "overflow-visible" : "overflow-hidden"}`}
        >
          {expanded ? children : null}
        </div>
      </div>
    </div>
  );
}

export interface AccordionProps {
  className?: string;
  children: ReactNode;
}

/** Vertical group of AccordionItems. Just adds spacing — no shared state,
 *  the parent decides which item is expanded (single-open or multi-open). */
export function Accordion({ className, children }: AccordionProps) {
  return <div className={`space-y-3 ${className ?? ""}`}>{children}</div>;
}

// Re-exported in case a consumer needs to namespace the imports.
export const useAccordionId = () => useId();
