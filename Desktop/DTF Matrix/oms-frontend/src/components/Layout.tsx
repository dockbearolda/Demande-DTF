import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ListChecks,
  KanbanSquare,
  Users,
  Palette,
  FileCheck2,
  FilePlus,
  FileText,
  HelpCircle,
  ChevronUp,
  Zap,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { useMetrics } from "@/hooks/useMetrics";
import { useDrafts } from "@/hooks/useDrafts";
import type { OrderStatus } from "@/lib/types";
import { clearCurrentUser, getCurrentUser, setCurrentUser } from "@/lib/currentUser";
import { OPERATEURS } from "@/features/new-order/constants";
import type { OperatorValue } from "@/features/new-order/types";

const ATTENTION_STATUSES: OrderStatus[] = ["DRAFT", "CONFIRMED"];
const AWAITING_BAT_STATUSES: OrderStatus[] = ["DRAFT", "CONFIRMED", "IN_PRODUCTION"];

type NavEntry = {
  to: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "orders" | "bat" | "drafts";
  /** Visually nested under its parent — rendered with a left indent. */
  child?: boolean;
  /** When true, the link only highlights on exact path match (no prefix
   *  match). Set on parents that have sub-items to avoid double-highlight. */
  exact?: boolean;
};

const SALES: NavEntry[] = [
  { to: "/orders/new", label: "Nouvelle demande", icon: FilePlus },
  { to: "/flash-devis", label: "Flash Devis", icon: Zap },
  { to: "/devis", label: "Devis", icon: FileText },
];

const PRODUCTION: NavEntry[] = [
  {
    to: "/orders",
    label: "Commandes",
    icon: ListChecks,
    badgeKey: "orders",
    exact: true,
  },
  {
    to: "/orders/drafts",
    label: "Brouillons",
    icon: FileText,
    badgeKey: "drafts",
    child: true,
  },
  { to: "/kanban", label: "Kanban", icon: KanbanSquare },
  { to: "/clients", label: "Clients", icon: Users },
];

const CREATION: NavEntry[] = [
  { to: "/studio-bat", label: "Studio BAT", icon: Palette, badgeKey: "bat" },
  { to: "/bat", label: "BAT", icon: FileCheck2 },
];

const CATALOG: NavEntry[] = [
  { to: "/catalogue", label: "Catalogue", icon: BookOpen },
];

function OmsLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="7" fill="var(--brand-duck-500)" />
      <rect x="6" y="6" width="6" height="16" rx="1.5" fill="var(--brand-sage-50)" />
      <rect x="14" y="6" width="3" height="16" rx="1.5" fill="var(--brand-sage-50)" opacity="0.85" />
      <rect x="19" y="6" width="3" height="16" rx="1.5" fill="var(--brand-sage-50)" opacity="0.6" />
    </svg>
  );
}

function NavItem({
  entry,
  badge,
  onClick,
}: {
  entry: NavEntry;
  badge?: number;
  onClick?: () => void;
}) {
  const Icon = entry.icon;
  return (
    <NavLink
      to={entry.to}
      end={entry.to === "/" || entry.exact === true}
      onClick={onClick}
      className={({ isActive }) =>
        `relative flex items-center gap-2.5 rounded-[8px] py-2 text-[13px] transition-colors ${
          entry.child ? "pl-9 pr-3" : "px-3"
        } ${isActive ? "olda-nav-item--active" : "olda-nav-item"}`
      }
      style={{ outline: "none" }}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
                width: 2,
                height: 20,
                borderRadius: 2,
                background: "var(--brand-duck-300)",
              }}
            />
          )}
          <Icon
            size={16}
            strokeWidth={isActive ? 2.0 : 1.75}
            style={{ flexShrink: 0 }}
          />
          <span
            style={{
              flex: 1,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--fg-1)" : "var(--fg-2)",
              letterSpacing: "-0.005em",
            }}
          >
            {entry.label}
          </span>
          {typeof badge === "number" && badge > 0 && (
            <span
              style={{
                minWidth: 20,
                height: 18,
                padding: "0 6px",
                borderRadius: 999,
                background: "var(--brand-sage-50)",
                color: "var(--fg-2)",
                fontSize: 11,
                fontWeight: 600,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Mono", ui-monospace, monospace',
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: "var(--fg-4)",
        padding: "16px 12px 6px",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<OperatorValue | null>(() => getCurrentUser());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const meEntry = OPERATEURS.find((op) => op.value === me);
  const initial = meEntry?.initial ?? "?";
  const name = meEntry?.name ?? "Session";

  function switchTo(v: OperatorValue) {
    setCurrentUser(v);
    setMe(v);
    setOpen(false);
  }

  function logout() {
    setOpen(false);
    setMe(null);
    // SessionGate s'abonne aux changements via subscribeCurrentUser et se
    // remontera automatiquement, sans perdre les drafts en localStorage.
    clearCurrentUser();
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          background: open ? "rgba(107,129,145,0.08)" : "transparent",
          border: "none",
          color: "var(--fg-1)",
          textAlign: "left",
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          aria-hidden="true"
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, var(--brand-duck-300), var(--brand-duck-500))",
            color: "var(--fg-on-primary)",
            fontSize: 11,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {initial}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--fg-1)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
        <ChevronUp
          size={14}
          strokeWidth={1.75}
          style={{
            color: "var(--fg-3)",
            transform: open ? "rotate(0)" : "rotate(180deg)",
            transition: "transform 180ms cubic-bezier(0.32,0.72,0,1)",
          }}
        />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(74,98,116,0.14)",
            borderRadius: 10,
            boxShadow: "var(--shadow-1)",
            padding: 4,
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: "6px 10px 4px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--fg-4)",
              textTransform: "uppercase",
            }}
          >
            Changer de session
          </div>
          {OPERATEURS.map((op) => {
            const active = op.value === me;
            return (
              <button
                key={op.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => switchTo(op.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 6,
                  background: active ? "rgba(107,129,145,0.10)" : "transparent",
                  border: "none",
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: "var(--fg-1)",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    e.currentTarget.style.background = "rgba(107,129,145,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = active
                    ? "rgba(107,129,145,0.10)"
                    : "transparent";
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "rgba(74,98,116,0.12)",
                    color: "var(--fg-1)",
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {op.initial}
                </span>
                <span style={{ flex: 1 }}>{op.name}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--fg-3)",
                    }}
                  >
                    ●
                  </span>
                )}
              </button>
            );
          })}
          <div
            aria-hidden="true"
            style={{
              height: 1,
              margin: "4px 6px",
              background: "rgba(74,98,116,0.12)",
            }}
          />
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 10px",
              borderRadius: 6,
              background: "transparent",
              border: "none",
              textAlign: "left",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--fg-2)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(107,129,145,0.08)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  badges,
  onNavigate,
}: {
  badges: { orders: number; bat: number; drafts: number };
  onNavigate?: () => void;
}) {
  const renderItem = (entry: NavEntry) => (
    <NavItem
      key={`${entry.to}:${entry.label}`}
      entry={entry}
      badge={entry.badgeKey ? badges[entry.badgeKey] : undefined}
      onClick={onNavigate}
    />
  );

  return (
    <>
      <div
        style={{
          padding: "20px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <OmsLogo />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--fg-1)",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            OMS Matrix
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--fg-3)",
              lineHeight: 1.3,
            }}
          >
            DTF Matrix
          </div>
        </div>
      </div>

      <nav
        aria-label="Navigation principale"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 8px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <GroupLabel>Vente</GroupLabel>
        {SALES.map(renderItem)}

        <GroupLabel>Production</GroupLabel>
        {PRODUCTION.map(renderItem)}

        <GroupLabel>Création</GroupLabel>
        {CREATION.map(renderItem)}

        <GroupLabel>Catalogue</GroupLabel>
        {CATALOG.map(renderItem)}
      </nav>

      <div
        style={{
          padding: "8px 8px 12px",
          borderTop: "1px solid rgba(74,98,116,0.10)",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <ProfileMenu />
        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            background: "transparent",
            border: "none",
            color: "var(--fg-2)",
            fontSize: 13,
            fontWeight: 500,
            textAlign: "left",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(107,129,145,0.06)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <HelpCircle size={16} strokeWidth={1.75} />
          <span>Aide</span>
        </button>
      </div>
    </>
  );
}

const SIDEBAR_STYLES = `
.olda-sidebar {
  width: 224px;
  background: rgba(235, 234, 232, 0.82);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  border-right: 1px solid rgba(74, 98, 116, 0.14);
}
.olda-nav-item {
  color: var(--fg-2);
}
.olda-nav-item:hover {
  background: rgba(107, 129, 145, 0.06);
  color: var(--fg-1);
}
.olda-nav-item--active {
  background: rgba(107, 129, 145, 0.12);
  color: var(--fg-1);
}
.olda-nav-item--active:hover {
  background: rgba(107, 129, 145, 0.16);
}
`;

export function Layout({ children }: { children?: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  // Compteurs sidebar : on tape `/kanban/metrics` (single-row aggregate côté
  // backend) au lieu de tirer 200 commandes pour les filtrer ici. Économie
  // de bande passante + JSON parse à chaque rendu Layout.
  const { data: metrics } = useMetrics();
  const { data: drafts = [] } = useDrafts();

  const badges = useMemo(() => {
    const byStatus = metrics?.by_status ?? ({} as Record<OrderStatus, number>);
    const sumStatuses = (statuses: OrderStatus[]) =>
      statuses.reduce((acc, s) => acc + (byStatus[s] ?? 0), 0);
    return {
      orders: sumStatuses(ATTENTION_STATUSES),
      bat: sumStatuses(AWAITING_BAT_STATUSES),
      drafts: drafts.length,
    };
  }, [metrics, drafts.length]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Mobile sidebar : Esc ferme le menu, et tab-trap basique pour empêcher le
  // focus de sortir vers le contenu derrière l'overlay.
  const mobileAsideRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const root = mobileAsideRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // Focus initial sur le premier élément du menu pour les lecteurs d'écran.
    const first = mobileAsideRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    first?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        overflow: "hidden",
        background: "var(--brand-paper)",
      }}
    >
      <style>{SIDEBAR_STYLES}</style>

      <aside
        className="olda-sidebar"
        style={{
          display: "none",
          flexDirection: "column",
          height: "100%",
          flexShrink: 0,
        }}
        data-desktop-sidebar
        aria-label="Navigation principale"
      >
        <SidebarContent badges={badges} />
      </aside>
      <style>{`@media (min-width: 768px) { aside[data-desktop-sidebar] { display: flex !important; } }`}</style>

      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 40 }}
        >
          <div
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(32, 41, 48, 0.45)",
              backdropFilter: "blur(2px)",
            }}
          />
          <aside
            ref={mobileAsideRef}
            className="olda-sidebar"
            style={{
              position: "relative",
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              height: "100%",
              boxShadow: "var(--shadow-1)",
            }}
            aria-label="Navigation principale"
          >
            <SidebarContent
              badges={badges}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flex: 1,
          minWidth: 0,
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            height: 56,
            padding: "0 16px",
            background: "rgba(244, 244, 242, 0.82)",
            backdropFilter: "blur(20px) saturate(180%)",
            borderBottom: "1px solid rgba(74, 98, 116, 0.10)",
          }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
            className="md:hidden"
            style={{
              marginLeft: -8,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 40,
              width: 40,
              borderRadius: 8,
              background: "transparent",
              border: "none",
              color: "var(--fg-2)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div
            className="md:hidden"
            style={{ fontSize: 14, fontWeight: 700, color: "var(--fg-1)" }}
          >
            OMS Matrix
          </div>
        </header>

        <main
          className="app-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            padding: 24,
          }}
        >
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
