'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { PlanningItem, STAGES, Stage, OPERATORS, OperatorKey } from '@/lib/types';
import { useProfile } from '@/lib/context/ProfileContext';
import { KanbanBoard } from '@/components/planning/KanbanBoard';
import { PlanningCard } from '@/components/planning/PlanningCard';
import { EditItemModal } from '@/components/planning/EditItemModal';
import { ProductionCategoryModal } from '@/components/planning/ProductionCategoryModal';
import { ArchiveModal } from '@/components/planning/ArchiveModal';
import { ClientDirectoryModal } from '@/components/planning/ClientDirectoryModal';
import { ClientModal } from '@/components/planning/ClientModal';
import { ConfirmModal } from '@/components/planning/ConfirmModal';
import { WorkspaceSetup } from '@/components/planning/WorkspaceSetup';
import { getClientStatsAsync, getTop3, ClientStats, Top3Client, invalidateAnalyticsCache } from '@/lib/analytics';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Bell,
  Settings,
  UserCircle,
  Hash,
  Menu,
  Search,
  Grid3X3,
  HelpCircle,
  Plus,
  Package,
  Ghost,
  X,
  BookUser,
} from 'lucide-react';

export default function PlanningPage() {
  const { activeProfile, clearProfile } = useProfile();
  const [items, setItems] = useState<PlanningItem[]>([]);

  // ── Dropbox / Workspace (Electron IPC) ───────────────────────────────────
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  // null = checking, '' = not configured, string = ok
  const [workspace, setWorkspace] = useState<string | null>(null);

  useEffect(() => {
    if (!isElectron) { setWorkspace('dev'); return; }
    window.electronAPI!.getWorkspace().then(p => {
      setWorkspace(p ?? '');
      if (p) window.electronAPI!.loadData().then(d => { if (d.length) setItems(d); });
    });
    window.electronAPI!.onDataChanged(newItems => setItems(newItems));
    return () => window.electronAPI!.removeAllListeners();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to Dropbox whenever items change (debounced)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isElectron || !workspace || workspace === 'dev') return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      window.electronAPI!.saveData(items);
    }, 600);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const handleWorkspaceConfirmed = async (p: string) => {
    setWorkspace(p);
    const loaded = await window.electronAPI!.loadData();
    setItems(loaded);
    window.electronAPI!.onDataChanged(newItems => setItems(newItems));
  };

  // ── Operator quick-filter (null = show all) ───────────────────────────────
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const visibleItems = useMemo(
    () => activeFilter ? items.filter(i => i.assignedTo === activeFilter) : items,
    [items, activeFilter],
  );

  // Column order — persisted in localStorage (read client-side only)
  const DEFAULT_ORDER: Stage[] = ['demande', 'devis', 'accepted', 'production', 'facturation'];
  const [columnOrder, setColumnOrder] = useState<Stage[]>(DEFAULT_ORDER);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('olda-column-order');
      if (saved) {
        const parsed: Stage[] = JSON.parse(saved);
        const valid = parsed.filter((s): s is Stage => s in STAGES);
        const missing = DEFAULT_ORDER.filter(s => !valid.includes(s));
        if (valid.length > 0) setColumnOrder([...valid, ...missing]);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Recompute analytics whenever items change (deferred, non-blocking)
  useEffect(() => {
    invalidateAnalyticsCache();
    getClientStatsAsync(items, stats => {
      setAllStats(stats);
      setTop3(getTop3(stats));
    });
  }, [items]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<PlanningItem | null>(null);

  // Real-time drop target tracking (for insertion indicator)
  const [overId, setOverId] = useState<string | null>(null);

  // Velocity tracking for inertia-based drop animation
  const dragVelocity = React.useRef({ x: 0, y: 0 });
  const lastDelta    = React.useRef({ x: 0, y: 0, t: 0 });
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<PlanningItem | null>(null);

  // Production Drop State
  const [pendingDrop, setPendingDrop] = useState<{ itemId: string, targetStage: Stage } | null>(null);

  // Archive Modal State
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isClientDirectoryOpen, setIsClientDirectoryOpen] = useState(false);

  // Analytics
  const [allStats, setAllStats] = useState<Record<string, ClientStats>>({});
  const [top3, setTop3]         = useState<Top3Client[]>([]);

  // Confirm delete modal
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Client Modal
  const [clientModalName, setClientModalName] = useState<string | null>(null);

  const openClientModal = (clientName: string) => {
    setClientModalName(clientName);
  };

  const clientModalStats = useMemo(() => {
    if (!clientModalName) return null;
    const key = clientModalName.trim().toLowerCase();
    return allStats[key] ?? null;
  }, [clientModalName, allStats]);

  // Ghost orders panel — commandes sans réponse
  const [isGhostPanelOpen, setIsGhostPanelOpen] = useState(false);
  const ghostOrders = useMemo(
    () => items
      .filter(i => i.status === 'archived_unresponsive')
      .sort((a, b) => (b.archivedAt ?? b.updatedAt ?? '').localeCompare(a.archivedAt ?? a.updatedAt ?? '')),
    [items]
  );
  const ghostClients = useMemo(
    () => Object.values(allStats).filter(s => s.ghostedCount >= 2).sort((a, b) => b.ghostedCount - a.ghostedCount),
    [allStats]
  );

  // ── Sensors: 5px distance (pointer) + 150ms delay (touch) ────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Global grabbing cursor while dragging
  React.useEffect(() => {
    if (activeId) {
      document.body.style.cursor = 'grabbing';
    } else {
      document.body.style.cursor = '';
    }
    return () => { document.body.style.cursor = ''; };
  }, [activeId]);

  // Track pointer velocity for inertia on drop
  const handleDragMove = (event: DragMoveEvent) => {
    const now = performance.now();
    const dt  = now - lastDelta.current.t;
    if (dt > 8) {
      dragVelocity.current = {
        x: (event.delta.x - lastDelta.current.x) / dt * 1000,
        y: (event.delta.y - lastDelta.current.y) / dt * 1000,
      };
      lastDelta.current = { x: event.delta.x, y: event.delta.y, t: now };
    }
  };

  // Track real-time collision target for the insertion indicator
  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? (event.over.id as string) : null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    // Reset velocity and over tracking on each new drag
    dragVelocity.current = { x: 0, y: 0 };
    setOverId(null);
    lastDelta.current    = { x: 0, y: 0, t: performance.now() };
    // For cards: data is { type:'card', item, stage }; for columns: { type:'column', stageId }
    const data = active.data.current;
    setActiveItem(data?.type === 'card' ? data.item : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveItem(null);
    setOverId(null);

    if (!over || active.id === over.id) return;

    // ── 1. Column reorder ─────────────────────────────────────────────────
    if (active.data.current?.type === 'column') {
      const activeColId = (active.id as string).replace('col-', '') as Stage;
      const overColId   = (over.id   as string).replace('col-', '') as Stage;
      const oldIndex = columnOrder.indexOf(activeColId);
      const newIndex = columnOrder.indexOf(overColId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
        setColumnOrder(newOrder);
        try { localStorage.setItem('olda-column-order', JSON.stringify(newOrder)); } catch {}
      }
      return;
    }

    // ── 2. Card drag ──────────────────────────────────────────────────────
    const activeId = active.id as string;
    const overId   = over.id   as string;

    const activeCard = items.find(i => i.id === activeId);
    if (!activeCard) return;

    const overCard    = items.find(i => i.id === overId);
    const overIsStage = Object.keys(STAGES).includes(overId);

    // 2a. Dropped over another card
    if (overCard) {
      const sameColumn = overCard.stage === activeCard.stage;

      if (sameColumn) {
        // ── Reorder within same column ──
        setItems(prev => {
          // Rebuild the column's ordered list
          const stageItems  = prev
            .filter(i => i.stage === activeCard.stage)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          const oldIdx = stageItems.findIndex(i => i.id === activeId);
          const newIdx = stageItems.findIndex(i => i.id === overId);
          const reordered = arrayMove(stageItems, oldIdx, newIdx)
            .map((item, pos) => ({ ...item, position: pos }));
          return [
            ...prev.filter(i => i.stage !== activeCard.stage),
            ...reordered,
          ];
        });
      } else {
        // ── Move to a different column (insert at overCard's position) ──
        const targetStage = overCard.stage;
        if (targetStage === 'production' && activeCard.stage !== 'production') {
          setPendingDrop({ itemId: activeId, targetStage });
        } else {
          setItems(prev => {
            const targetItems = prev
              .filter(i => i.stage === targetStage)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            const insertAt = targetItems.findIndex(i => i.id === overId);
            const updated = prev.map(i =>
              i.id === activeId
                ? { ...i, stage: targetStage, position: insertAt, updatedAt: '2026-04-16T00:00:00.000Z' }
                : i
            );
            // Re-normalise positions in target column
            const newTargetItems = updated
              .filter(i => i.stage === targetStage)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((item, pos) => ({ ...item, position: pos }));
            return [
              ...updated.filter(i => i.stage !== targetStage),
              ...newTargetItems,
            ];
          });
        }
      }
      return;
    }

    // 2b. Dropped over an empty column area
    if (overIsStage) {
      const targetStage = overId as Stage;
      if (activeCard.stage === targetStage) return;
      if (targetStage === 'production' && activeCard.stage !== 'production') {
        setPendingDrop({ itemId: activeId, targetStage });
      } else {
        setItems(prev => {
          const targetCount = prev.filter(i => i.stage === targetStage).length;
          return prev.map(i =>
            i.id === activeId
              ? { ...i, stage: targetStage, position: targetCount, updatedAt: new Date().toISOString() }
              : i
          );
        });
      }
    }
  };

  const handleProductionCategorySelect = (family: string) => {
    if (pendingDrop) {
      setItems((prev) => prev.map(item => {
        if (item.id === pendingDrop.itemId) {
          return {
            ...item,
            stage: pendingDrop.targetStage,
            sectors: [family as any],
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      }));
    }
    setPendingDrop(null);
  };

  const handleDeleteItem = (id: string) => {
    setConfirmId(id);
  };

  const confirmDelete = () => {
    if (confirmId) setItems(prev => prev.filter(i => i.id !== confirmId));
    setConfirmId(null);
  };

  const handleEditItemClick = (item: PlanningItem) => {
    setItemToEdit(item);
    setIsEditModalOpen(true);
  };

  const handleSaveItem = (updatedItem: PlanningItem) => {
    if (!updatedItem.id) {
      // Logic for new item
      updatedItem.id = Date.now().toString();
      updatedItem.createdAt = '2026-04-16T00:00:00.000Z';
      updatedItem.updatedAt = '2026-04-16T00:00:00.000Z';
      setItems((prev) => [updatedItem, ...prev]);
    } else {
      // Logic for existing item
      setItems((prev) => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    }
    setIsEditModalOpen(false);
    setItemToEdit(null);
  };

  const handleCreateNewItem = () => {
    setItemToEdit(null);
    setIsEditModalOpen(true);
  };

  const handleQuickArchive = (id: string) => {
    setItems((prev) => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          stage: 'archived',
          archivedAt: '2026-04-16T00:00:00.000Z',
          updatedAt: '2026-04-16T00:00:00.000Z'
        };
      }
      return item;
    }));
  };

  // ── Inline operator assignment ─────────────────────────────────────────────
  const handleAssign = (itemId: string, operator: string | null) => {
    setItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, assignedTo: (operator ?? '') as PlanningItem['assignedTo'] } : i
    ));
  };

  // ── Urgent flag toggle ────────────────────────────────────────────────────
  const handleToggleUrgent = (id: string) => {
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, isUrgent: !i.isUrgent } : i
    ));
  };

  // ── On-hold toggle — preserves previous status on resume ─────────────────
  const handleToggleHold = (id: string) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      return i.status === 'on_hold'
        ? { ...i, status: '' as const }
        : { ...i, status: 'on_hold' as const };
    }));
  };

  // ── Clôturer Sans réponse — archive with unresponsive status ─────────────
  // Called after PlanningCard's ghost-dissolve animation (≈420ms delay)
  const handleCloseUnresponsive = (id: string) => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(i =>
      i.id === id
        ? { ...i, stage: 'archived' as const, status: 'archived_unresponsive' as const, archivedAt: now, updatedAt: now }
        : i
    ));
    invalidateAnalyticsCache();
  };

  // Show workspace setup on first launch (Electron only, not yet configured)
  if (isElectron && workspace === '') {
    return <WorkspaceSetup onConfirm={handleWorkspaceConfirmed} />;
  }

  // Still checking workspace
  if (workspace === null) return null;

  return (
    <div className="app-container">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <main className="main-content">
          <header className="top-nav">
            <div className="nav-left">
              <button
                className="icon-btn"
                aria-label="Nouvelle carte"
                onClick={handleCreateNewItem}
                style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              >
                <Plus strokeWidth={2} size={20} />
              </button>

              {/* ── Global operator quick-filter ── */}
              <div className="op-filter-cluster" role="group" aria-label="Filtrer par opérateur">
                {OPERATORS.map(op => (
                  <button
                    key={op.key}
                    className={[
                      'op-filter-avatar',
                      activeFilter === op.key  ? 'op-filter-avatar--active'   : '',
                      activeFilter && activeFilter !== op.key ? 'op-filter-avatar--dim' : '',
                    ].filter(Boolean).join(' ')}
                    style={{ background: op.bg, color: op.color } as React.CSSProperties}
                    onClick={() => setActiveFilter(prev => prev === op.key ? null : op.key)}
                    title={`Filtrer : ${op.label}`}
                    aria-pressed={activeFilter === op.key}
                  >
                    {op.initial}
                  </button>
                ))}
              </div>
            </div>

            <div className="nav-center">
              <div className="search-bar">
                <Search size={20} strokeWidth={1.5} className="search-icon" />
                <input type="text" placeholder="Rechercher des commandes, clients..." />
              </div>
            </div>

            <div className="nav-right">
              <div className="nav-actions">
                <button
                  className="icon-btn ghost-nav-btn"
                  aria-label="Commandes sans réponse"
                  onClick={() => setIsGhostPanelOpen(true)}
                  title={`${ghostOrders.length} commande${ghostOrders.length !== 1 ? 's' : ''} sans réponse`}
                  style={{ background: 'var(--surface-variant)', color: ghostOrders.length > 0 ? '#dc2626' : 'var(--on-surface-variant)' }}
                >
                  <Ghost strokeWidth={1.5} size={20} />
                  {ghostOrders.length > 0 && (
                    <span className="ghost-nav-badge">{ghostOrders.length}</span>
                  )}
                </button>
                <button
                  className="icon-btn"
                  aria-label="Répertoire clients"
                  onClick={() => setIsClientDirectoryOpen(true)}
                  style={{ background: 'var(--surface-variant)', color: 'var(--on-surface-variant)' }}
                  title="Répertoire clients"
                >
                  <BookUser strokeWidth={1.5} size={20} />
                </button>
                <button
                  className="icon-btn"
                  aria-label="Archives"
                  onClick={() => setIsArchiveModalOpen(true)}
                  style={{ background: 'var(--surface-variant)', color: 'var(--on-surface-variant)' }}
                  title="Voir les archives"
                >
                  <Package strokeWidth={1.5} size={20} />
                </button>
              </div>
            </div>
          </header>

          <div className="grid-container">
            <KanbanBoard
              items={visibleItems}
              columnOrder={columnOrder}
              activeItem={activeItem}
              overId={overId}
              onDelete={handleDeleteItem}
              onEdit={handleEditItemClick}
              onQuickArchive={handleQuickArchive}
              onClientClick={openClientModal}
              onAssign={handleAssign}
              onToggleUrgent={handleToggleUrgent}
              onToggleHold={handleToggleHold}
              onCloseUnresponsive={handleCloseUnresponsive}
            />
          </div>
        </main>

        <DragOverlay
          dropAnimation={{
            // Velocity-aware duration: fast release → longer arc with inertia
            duration: (() => {
              const speed = Math.hypot(dragVelocity.current.x, dragVelocity.current.y);
              return speed > 600 ? 520 : 380;
            })(),
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // spring-like bounce
          }}
        >
          {/* Card overlay — Framer Motion lift: scale + deep shadow + slight tilt */}
          {activeItem && !activeId?.startsWith('col-') ? (
            <motion.div
              initial={{ scale: 1, rotate: 0 }}
              animate={{ scale: 1.025, rotate: 1.5 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25, mass: 0.8 }}
              style={{ transformOrigin: '50% 50%', cursor: 'grabbing' }}
            >
              <PlanningCard item={activeItem} isOverlay />
            </motion.div>
          ) : null}

          {/* Column overlay — lightweight ghost pill */}
          {activeId?.startsWith('col-') ? (() => {
            const stageId = activeId.replace('col-', '') as Stage;
            const cfg = STAGES[stageId];
            const count = items.filter(i => i.stage === stageId).length;
            return (
              <div className="col-drag-overlay">
                <span className="col-drag-overlay-dot" style={{ background: cfg.color }} />
                <span className="col-drag-overlay-label">{cfg.label}</span>
                <span className="col-drag-overlay-count">{count}</span>
              </div>
            );
          })() : null}
        </DragOverlay>
      </DndContext>
      
      {/* Modification Modal */}
      <EditItemModal
        isOpen={isEditModalOpen}
        item={itemToEdit}
        onClose={() => {
          setIsEditModalOpen(false);
          setItemToEdit(null);
        }}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />

      <ProductionCategoryModal
        isOpen={pendingDrop !== null}
        onClose={() => setPendingDrop(null)}
        onSelectCategory={handleProductionCategorySelect}
      />

      <ArchiveModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        items={items}
      />

      <ClientDirectoryModal
        isOpen={isClientDirectoryOpen}
        onClose={() => setIsClientDirectoryOpen(false)}
      />

      <ConfirmModal
        isOpen={confirmId !== null}
        message="Supprimer cette commande définitivement ?"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmId(null)}
      />

      <ClientModal
        stats={clientModalStats}
        isOpen={clientModalName !== null}
        onClose={() => setClientModalName(null)}
      />

      {/* ── Ghost orders panel — commandes sans réponse ── */}
      {isGhostPanelOpen && (
        <div
          className="qa-overlay"
          style={{ zIndex: 300 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setIsGhostPanelOpen(false); }}
        >
          <div className="ghost-panel" role="dialog" aria-modal="true" aria-label="Commandes sans réponse">
            <div className="ghost-panel-header">
              <div className="ghost-panel-title">
                <Ghost size={15} strokeWidth={2} className="ghost-panel-icon" />
                <span>Sans réponse</span>
                <span className="ghost-panel-count">{ghostOrders.length}</span>
              </div>
              <button className="qa-close" onClick={() => setIsGhostPanelOpen(false)} aria-label="Fermer">
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="ghost-panel-body">
              {ghostOrders.length === 0 && (
                <div className="ghost-panel-empty">Aucune commande sans réponse</div>
              )}
              {ghostOrders.map(order => (
                <div key={order.id} className="ghost-panel-row">
                  <div className="ghost-panel-avatar">
                    <Ghost size={13} strokeWidth={2} />
                  </div>
                  <div className="ghost-panel-info">
                    <span className="ghost-panel-name">{order.clientName}</span>
                    <span className="ghost-panel-meta">
                      {order.product}{order.quantity ? ` · ${order.quantity}` : ''}
                    </span>
                    {order.archivedAt && (
                      <span className="ghost-panel-date">
                        {format(new Date(order.archivedAt), 'd MMM yyyy', { locale: fr })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

