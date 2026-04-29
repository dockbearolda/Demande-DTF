import { Info } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, side = "top" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePos = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const contentWidth = 280;
      const contentHeight = 80;
      const gap = 8;

      let top = 0,
        left = 0;

      switch (side) {
        case "top":
          top = rect.top - contentHeight - gap;
          left = rect.left + rect.width / 2 - contentWidth / 2;
          break;
        case "bottom":
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2 - contentWidth / 2;
          break;
        case "left":
          top = rect.top + rect.height / 2 - contentHeight / 2;
          left = rect.left - contentWidth - gap;
          break;
        case "right":
          top = rect.top + rect.height / 2 - contentHeight / 2;
          left = rect.right + gap;
          break;
      }

      left = Math.max(8, Math.min(left, window.innerWidth - contentWidth - 8));
      setPos({ top, left });
    };

    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);

    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, side]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        aria-label="Plus d'information"
      >
        <Info size={16} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: 280,
            }}
            className="z-50 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-600 shadow-lg"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
