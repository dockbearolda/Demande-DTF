'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  MeasuringStrategy,
  CollisionDetection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { PlanningItem, STAGES, Stage, OPERATORS, OperatorKey, NoteAlertTag } from '@/lib/types';
import { useClientNotes } from '@/lib/hooks/useClientNotes';
import type { DataPayload } from '@/lib/electron';
import { useProfile } from '@/lib/context/ProfileContext';
import { KanbanBoard, type ItemBatchInfo } from '@/components/planning/KanbanBoard';
import { PlanningCard } from '@/components/planning/PlanningCard';
import { EditItemModal } from '@/components/planning/EditItemModal';
import { QuickAddModal } from '@/components/planning/QuickAddModal';
import { ProductionCategoryModal } from '@/components/planning/ProductionCategoryModal';
import { ArchiveModal } from '@/components/planning/ArchiveModal';
import { ClientDirectoryModal } from '@/components/planning/ClientDirectoryModal';
import { ClientCRMModal } from '@/components/planning/ClientCRMModal';
import { WorkspaceSetup } from '@/components/planning/WorkspaceSetup';
import { OldaLogo } from '@/components/OldaLogo';
import { getClientStatsAsync, getTop3, ClientStats, Top3Client, invalidateAnalyticsCache } from '@/lib/analytics';
import { useKanbanKeyboard } from '@/lib/hooks/useKanbanKeyboard';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
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
  ChevronRight,
} from 'lucide-react';

// ── Per-item merge: local ⊕ remote with LWW, preserving unsaved locals ─────
// persistedIds = the set of ids that were in the file the last time we saved/loaded.
// An id missing from `incoming` that IS in persistedIds → deleted remotely (drop).
// An id missing from `incoming` that is NOT in persistedIds → unsaved local creation
// that hasn't been flushed to disk yet (keep).
function mergeItems(
  local:        PlanningItem[],
  incoming:     PlanningItem[],
  persistedIds: Set<string>,
): PlanningItem[] {
  const out = new Map<string, PlanningItem>();
  for (const it of incoming) out.set(it.id, it);
  for (const it of local) {
    const remote = out.get(it.id);
    if (!remote) {
      if (!persistedIds.has(it.id)) out.set(it.id, it);
      // else: was in last-persisted snapshot, now gone → deleted on other machine
    } else {
      const lu = Date.parse(it.updatedAt     || '') || 0;
      const ru = Date.parse(remote.updatedAt || '') || 0;
      if (lu > ru) out.set(it.id, it);
    }
  }
  return Array.from(out.values());
}

// ── Aimantation : si la carte dépasse de >50% dans une colonne différente,
//    on force le drop sur cette colonne. Sinon fallback closestCenter (pour
//    l'ordre des cartes dans la même colonne).
const magneticColumnCollision: CollisionDetection = (args) => {
  const { active, droppableContainers, collisionRect } = args;

  if (active.data.current?.type !== 'card' || !collisionRect) {
    return closestCenter(args);
  }

  const activeStage: Stage | undefined = active.data.current?.stage;
  const cardArea = collisionRect.width * collisionRect.height;
  if (cardArea <= 0) return closestCenter(args);

  let bestContainer: typeof droppableContainers[number] | null = null;
  let bestRatio = 0.5; // seuil : >50% pour s'aimanter

  for (const container of droppableContainers) {
    const id = String(container.id);
    // On ne considère que les droppables de colonne (stage key directe).
    // Les ids `col-<stage>` sont les sortables de header : on les ignore pour
    // éviter les doublons et garder le drop côté contenu de la colonne.
    if (!(id in STAGES)) continue;
    if (id === activeStage) continue; // même colonne → pas d'aimantation

    const rect = container.rect.current;
    if (!rect) continue;

    const xOverlap = Math.max(0, Math.min(collisionRect.right, rect.right) - Math.max(collisionRect.left, rect.left));
    const yOverlap = Math.max(0, Math.min(collisionRect.bottom, rect.bottom) - Math.max(collisionRect.top, rect.top));
    const overlapArea = xOverlap * yOverlap;
    const ratio = overlapArea / cardArea;

    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestContainer = container;
    }
  }

  if (bestContainer) {
    return [{ id: bestContainer.id, data: { droppableContainer: bestContainer, value: bestRatio } }];
  }

  return closestCenter(args);
};

export default function PlanningPage() {
  const { activeProfile, clearProfile } = useProfile();
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);

  // ── Dropbox / Workspace (Electron IPC) ───────────────────────────────────
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  // null = checking, '' = not configured, string = ok
  const [workspace, setWorkspace] = useState<string | null>(null);

  // Sync baselines — what we last wrote to (or read from) disk.
  // Used by mergeItems() to distinguish "deleted remotely" from "unsaved local".
  const lastPersistedIdsRef  = React.useRef<Set<string>>(new Set());
  const lastPersistedJsonRef = React.useRef<string>('[]');

  // Remote payload deferred while the user is mid-drag so the drop isn't torn out.
  const pendingRemoteRef = React.useRef<DataPayload | null>(null);
  const isDraggingRef    = React.useRef<boolean>(false);
  const applyRemoteRef   = React.useRef<(p: DataPayload) => void>(() => {});

  // Mount-time: load, subscribe to remote changes once. No double-subscription.
  useEffect(() => {
    if (!isElectron) { setWorkspace('dev'); return; }
    let cancelled = false;

    const applyRemote = (payload: DataPayload) => {
      setItems(prev => {
        const merged = mergeItems(prev, payload.items, lastPersistedIdsRef.current);
        lastPersistedIdsRef.current  = new Set(payload.items.map(i => i.id));
        lastPersistedJsonRef.current = JSON.stringify(payload.items);
        return merged;
      });
      if (payload.conflicts?.length) {
        window.electronAPI!.log('warn', 'Dropbox conflict copies detected', payload.conflicts);
      }
    };
    applyRemoteRef.current = applyRemote;

    (async () => {
      const p = await window.electronAPI!.getWorkspace();
      if (cancelled) return;
      setWorkspace(p ?? '');
      if (!p) return;
      const payload = await window.electronAPI!.loadData();
      if (cancelled) return;
      lastPersistedIdsRef.current  = new Set(payload.items.map(i => i.id));
      lastPersistedJsonRef.current = JSON.stringify(payload.items);
      setItems(payload.items);
      if (payload.conflicts?.length) {
        window.electronAPI!.log('warn', 'Dropbox conflict copies detected at load', payload.conflicts);
      }
    })();

    const handleRemote = (payload: DataPayload) => {
      if (isDraggingRef.current) { pendingRemoteRef.current = payload; return; }
      applyRemote(payload);
    };
    window.electronAPI!.onDataChanged(handleRemote);

    return () => { cancelled = true; window.electronAPI!.removeAllListeners(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save effect — only fires when items actually differ from last-persisted snapshot.
  // This breaks the watcher → setItems → save → watcher feedback loop.
  useEffect(() => {
    if (!isElectron || !workspace || workspace === 'dev') return;
    const currentJson = JSON.stringify(items);
    if (currentJson === lastPersistedJsonRef.current) return; // nothing new to save
    const timer = setTimeout(async () => {
      const snapshot     = items;
      const snapshotJson = JSON.stringify(snapshot);
      const result = await window.electronAPI!.saveData(snapshot);
      if (result?.success) {
        lastPersistedIdsRef.current  = new Set(snapshot.map(i => i.id));
        lastPersistedJsonRef.current = snapshotJson;
      } else {
        window.electronAPI!.log('error', 'saveData failed', result?.error);
      }
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, workspace]);

  const handleWorkspaceConfirmed = async (p: string) => {
    setWorkspace(p);
    const payload = await window.electronAPI!.loadData();
    lastPersistedIdsRef.current  = new Set(payload.items.map(i => i.id));
    lastPersistedJsonRef.current = JSON.stringify(payload.items);
    setItems(payload.items);
    // No re-subscribe — the mount effect already listens.
  };

  // ── Operator quick-filter (null = show all) ───────────────────────────────
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // ── Search query — filtre client + produit + note ─────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const visibleItems = useMemo(() => {
    let list = activeFilter ? items.filter(i => i.assignedTo === activeFilter) : items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        i.clientName.toLowerCase().includes(q) ||
        i.product.toLowerCase().includes(q) ||
        (i.note ?? '').toLowerCase().includes(q) ||
        (i.lines ?? []).some(l => l.product.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, activeFilter, searchQuery]);

  // ── Batch info — dynamic grouping by client (excludes archived cards) ──────
  const itemBatchInfo = useMemo<Map<string, ItemBatchInfo>>(() => {
    const activeItems = items.filter(
      i => i.stage !== 'archived' && i.status !== 'archived_unresponsive',
    );

    // Group by clientId (preferred) or normalized clientName
    const buckets = new Map<string, PlanningItem[]>();
    for (const item of activeItems) {
      const key =
        item.clientId != null
          ? `id:${item.clientId}`
          : `name:${item.clientName.toLowerCase().trim()}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(item);
      buckets.set(key, bucket);
    }

    // Sort each bucket by createdAt for stable 1, 2, 3… ordering
    for (const bucket of buckets.values()) {
      bucket.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    // Build the per-item result map
    const result = new Map<string, ItemBatchInfo>();
    for (const bucket of buckets.values()) {
      const total = bucket.length;
      const allInFacturation = bucket.every(i => i.stage === 'facturation');
      bucket.forEach((item, idx) => {
        result.set(item.id, { index: idx + 1, total, allInFacturation });
      });
    }
    return result;
  }, [items]);

  const batchReadyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, info] of itemBatchInfo) {
      if (info.allInFacturation) ids.add(id);
    }
    return ids;
  }, [itemBatchInfo]);

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


  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<PlanningItem | null>(null);

  // Production Drop State
  const [pendingDrop, setPendingDrop] = useState<{
    itemId: string;
    targetStage: Stage;
    fromStage?: Stage; // set for keyboard-initiated drops (enables rollback on Escape)
  } | null>(null);

  // True while the production sector modal is open — prevents Shift+Arrow moves
  const isPendingDropRef = useRef(false);
  isPendingDropRef.current = pendingDrop !== null;

  // Archive Modal State
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isClientDirectoryOpen, setIsClientDirectoryOpen] = useState(false);

  // Analytics
  const [allStats, setAllStats] = useState<Record<string, ClientStats>>({});
  const [top3, setTop3]         = useState<Top3Client[]>([]);

  // Undo delete (optimistic)
  const [undoDelete, setUndoDelete] = useState<{ item: PlanningItem; timer: ReturnType<typeof setTimeout> } | null>(null);

  // Client Modal
  const [clientModalName, setClientModalName] = useState<string | null>(null);

  const openClientModal = useCallback((clientName: string) => {
    setClientModalName(clientName);
  }, []);

  const clientModalStats = useMemo(() => {
    if (!clientModalName) return null;
    const key = clientModalName.trim().toLowerCase();
    return allStats[key] ?? {
      clientName: clientModalName,
      orders: [], rfm: { recency: 1, frequency: 1, monetary: 1, total: 3 },
      tags: [], sparkline: [0,0,0,0,0,0], sparklineLabels: ['','','','','',''],
      totalOrders: 0, totalQty: 0, avgQty: 0,
      lastOrderDate: null, trend: 'stable' as const, ghostedCount: 0,
    };
  }, [clientModalName, allStats]);

  const clientModalKey = useMemo(
    () => clientModalName ? clientModalName.trim().toLowerCase() : null,
    [clientModalName],
  );

  // Client notes (Journal d'activité)
  const { addNote, deleteNote, getNotesForClient, getTopAlertTag } = useClientNotes();

  const clientModalNotes = useMemo(
    () => clientModalKey ? getNotesForClient(clientModalKey) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientModalKey, getNotesForClient],
  );

  const handleAddClientNote = useCallback((content: string, alertTag: NoteAlertTag | null) => {
    if (!clientModalKey) return;
    addNote(clientModalKey, content, alertTag, activeProfile ?? '');
  }, [clientModalKey, addNote, activeProfile]);

  const clientTopAlertTag = useMemo(
    () => clientModalKey ? getTopAlertTag(clientModalKey) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientModalKey, getTopAlertTag],
  );

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

  const handleProductionKeyboardDrop = useCallback((itemId: string, fromStage: Stage) => {
    setPendingDrop({ itemId, targetStage: 'production', fromStage });
  }, []);

  const handleWhatsApp = useCallback((item: PlanningItem) => {
    const senderLabel = OPERATORS.find(op => op.key === activeProfile)?.label ?? 'OLDA';
    const message = `Bonjour, c'est ${senderLabel}\nVos produits sont prêts et disponibles à l'atelier.\nNous sommes ouverts du :\nLundi au vendredi,\nde 9h00 à 18h00, en continu.\nN'hésitez pas à passer quand cela vous arrange !`;
    const url = buildWhatsAppUrl(item.clientPhone, message, { defaultCountryCode: '590' });
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [activeProfile]);

  useKanbanKeyboard({
    items: visibleItems,
    columnOrder,
    focusedCardId,
    setFocusedCardId,
    setItems,
    isDraggingRef,
    onProductionDrop: handleProductionKeyboardDrop,
    isPendingDropRef,
    onWhatsApp: handleWhatsApp,
    batchReadyIds,
  });

  // Global grabbing cursor while dragging — CSS handles it via body attribute
  React.useEffect(() => {
    if (activeId) {
      document.body.setAttribute('data-dragging', 'true');
    } else {
      document.body.removeAttribute('data-dragging');
    }
    return () => { document.body.removeAttribute('data-dragging'); };
  }, [activeId]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    isDraggingRef.current = true;
    setActiveId(active.id as string);
    // For cards: data is { type:'card', item, stage }; for columns: { type:'column', stageId }
    const data = active.data.current;
    setActiveItem(data?.type === 'card' ? data.item : null);
  };

  // Flush any remote payload that arrived while the user was dragging
  const flushPendingRemote = () => {
    isDraggingRef.current = false;
    if (pendingRemoteRef.current) {
      const p = pendingRemoteRef.current;
      pendingRemoteRef.current = null;
      applyRemoteRef.current(p);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveItem(null);

    // Drop is complete — flush any remote update that arrived mid-drag.
    // Scheduled via microtask so our local drop-state update lands first.
    queueMicrotask(flushPendingRemote);

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
        // ── Reorder within same column — only allocate new objects for cards whose
        // position actually changed. Preserves React.memo equality for untouched cards.
        setItems(prev => {
          const stageItems = prev
            .filter(i => i.stage === activeCard.stage)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          const oldIdx = stageItems.findIndex(i => i.id === activeId);
          const newIdx = stageItems.findIndex(i => i.id === overId);
          if (oldIdx === -1 || newIdx === -1) return prev;
          const reordered = arrayMove(stageItems, oldIdx, newIdx).map((item, pos) =>
            item.position === pos ? item : { ...item, position: pos }
          );
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
                ? { ...i, stage: targetStage, position: insertAt, updatedAt: new Date().toISOString() }
                : i
            );
            const newTargetItems = updated
              .filter(i => i.stage === targetStage)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((item, pos) => (item.position === pos ? item : { ...item, position: pos }));
            return [
              ...updated.filter(i => i.stage !== targetStage),
              ...newTargetItems,
            ];
          });
        }
      }
      return;
    }

    // 2b'. Dropped over a column sortable (col-demande) — normalise to stage key
    if (!overCard && !overIsStage && overId.startsWith('col-')) {
      const targetStage = overId.slice(4) as Stage;
      if (!(targetStage in STAGES) || activeCard.stage === targetStage) return;
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

  const handleProductionCategorySelect = useCallback((family: string) => {
    setPendingDrop(currentPending => {
      if (currentPending) {
        setItems(prev => prev.map(item => {
          if (item.id === currentPending.itemId) {
            return {
              ...item,
              stage: currentPending.targetStage,
              sectors: [family as any],
              updatedAt: new Date().toISOString(),
            };
          }
          return item;
        }));
      }
      return null;
    });
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    // Clear any pending undo
    setUndoDelete(prev => { if (prev) clearTimeout(prev.timer); return null; });
    // Optimistic removal
    setItems(prev => prev.filter(i => i.id !== id));
    const timer = setTimeout(() => setUndoDelete(null), 6000);
    setUndoDelete({ item, timer });
  }, [items]);

  const handleUndoDelete = useCallback(() => {
    setUndoDelete(prev => {
      if (!prev) return null;
      clearTimeout(prev.timer);
      setItems(current => [prev.item, ...current]);
      return null;
    });
  }, []);

  const handleEditItemClick = useCallback((item: PlanningItem) => {
    setItemToEdit(item);
    setIsEditModalOpen(true);
  }, []);

  const handleSaveItem = useCallback((updatedItem: PlanningItem) => {
    const now = new Date().toISOString();
    if (!updatedItem.id) {
      updatedItem.id        = (crypto as Crypto).randomUUID();
      updatedItem.createdAt = now;
      updatedItem.updatedAt = now;
      setItems(prev => [updatedItem, ...prev]);
    } else {
      updatedItem.updatedAt = now;
      setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    }
    setIsEditModalOpen(false);
    setItemToEdit(null);
  }, []);

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const handleCreateNewItem = useCallback(() => setIsQuickAddOpen(true), []);

  // ── Cmd+Z / Ctrl+Z — undo last delete ───────────────────────────────────
  useEffect(() => {
    const handleUndo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        const target = e.target as HTMLElement;
        const isInput = ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.contentEditable === 'true';
        if (isInput) return;
        e.preventDefault();
        handleUndoDelete();
      }
    };
    window.addEventListener('keydown', handleUndo);
    return () => window.removeEventListener('keydown', handleUndo);
  }, [handleUndoDelete]);

  // ── ⌘K / Ctrl+K — focus search ───────────────────────────────────────────
  useEffect(() => {
    const handleCmdK = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleCmdK);
    return () => window.removeEventListener('keydown', handleCmdK);
  }, []);

  // ── Global spacebar to open quick add modal ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement;
      const isInputField = ['INPUT', 'TEXTAREA'].includes(target.tagName) ||
                         target.contentEditable === 'true';
      // Laisser l'espace faire son travail normal dans les champs texte
      if (isInputField) return;
      // Quand le modal est ouvert, on laisse le modal gérer l'espace (valider).
      if (isQuickAddOpen) return;
      // Sinon on bloque l'espace (évite d'activer un bouton focus) et on ouvre.
      e.preventDefault();
      handleCreateNewItem();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickAddOpen, handleCreateNewItem]);

  const handleQuickArchive = useCallback((id: string) => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, stage: 'archived', archivedAt: now, updatedAt: now } : item
    ));
  }, []);

  const handleAssign = useCallback((itemId: string, operator: string | null) => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(i =>
      i.id === itemId
        ? { ...i, assignedTo: (operator ?? '') as PlanningItem['assignedTo'], updatedAt: now }
        : i
    ));
  }, []);

  const handleToggleUrgent = useCallback((id: string) => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, isUrgent: !i.isUrgent, updatedAt: now } : i
    ));
  }, []);

  const handleToggleHold = useCallback((id: string) => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      return i.status === 'on_hold'
        ? { ...i, status: '' as const,        updatedAt: now }
        : { ...i, status: 'on_hold' as const, updatedAt: now };
    }));
  }, []);

  const handleNoteChange = useCallback((id: string, note: string) => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(i => i.id === id ? { ...i, note, updatedAt: now } : i));
  }, []);

  const handleCloseUnresponsive = useCallback((id: string) => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(i =>
      i.id === id
        ? { ...i, stage: 'archived' as const, status: 'archived_unresponsive' as const, archivedAt: now, updatedAt: now }
        : i
    ));
    invalidateAnalyticsCache();
  }, []);

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
        collisionDetection={magneticColumnCollision}
        measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <main className="main-content">
          <header className="top-nav">
            <div className="nav-left">
              <div className="nav-brand">
                <div className="nav-brand-icon">
                  <OldaLogo size={16} color="#f7f5f1" />
                </div>
                <span className="nav-brand-title">Production</span>
                <ChevronRight size={14} strokeWidth={1.75} className="nav-brand-chevron" />
                <span className="nav-brand-sub">Kanban</span>
              </div>
              <span className="nav-divider" aria-hidden="true" />
            </div>

            <div className="nav-center">
              <div className="search-bar search-bar--command">
                <Search size={18} strokeWidth={1.75} className="search-icon" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Rechercher une commande, un client..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setSearchQuery(''); searchRef.current?.blur(); } }}
                />
              </div>
            </div>

            <div className="nav-right">
              {/* ── Global operator quick-filter ── */}
              <div className="op-filter-cluster op-filter-cluster--mono" role="group" aria-label="Filtrer par opérateur">
                {OPERATORS.map(op => (
                  <button
                    key={op.key}
                    className={[
                      'op-filter-chip',
                      activeFilter === op.key  ? 'op-filter-chip--active'   : '',
                      activeFilter && activeFilter !== op.key ? 'op-filter-chip--dim' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setActiveFilter(prev => prev === op.key ? null : op.key)}
                    title={`Filtrer : ${op.label}`}
                    aria-pressed={activeFilter === op.key}
                    style={activeFilter === op.key
                      ? { '--op-active-bg': op.bg, '--op-active-color': op.color } as React.CSSProperties
                      : undefined}
                  >
                    {op.initial}
                  </button>
                ))}
              </div>

              <span className="nav-divider" aria-hidden="true" />

              <div className="nav-actions nav-actions--naked">
                <button
                  className="nav-action-btn ghost-nav-btn"
                  aria-label="Commandes sans réponse"
                  onClick={() => setIsGhostPanelOpen(true)}
                  title={`${ghostOrders.length} commande${ghostOrders.length !== 1 ? 's' : ''} sans réponse`}
                >
                  <Ghost
                    strokeWidth={1.75}
                    size={16}
                    style={ghostOrders.length > 0 ? { color: '#dc2626' } : undefined}
                  />
                  {ghostOrders.length > 0 && (
                    <span className="ghost-nav-badge">{ghostOrders.length}</span>
                  )}
                </button>
                <button
                  className="nav-action-btn"
                  aria-label="Base Clients"
                  onClick={() => setIsClientDirectoryOpen(true)}
                  title="Base Clients"
                >
                  <BookUser strokeWidth={1.75} size={16} />
                </button>
                <button
                  className="nav-action-btn"
                  aria-label="Archives"
                  onClick={() => setIsArchiveModalOpen(true)}
                  title="Archives"
                >
                  <Package strokeWidth={1.75} size={16} />
                </button>
              </div>

              <span className="nav-divider" aria-hidden="true" />

              <button
                className="btn-primary-pill"
                aria-label="Nouvelle commande"
                onClick={handleCreateNewItem}
              >
                <Plus strokeWidth={2.5} size={14} />
                <span>Nouvelle commande</span>
              </button>
            </div>
          </header>

          <div className="grid-container">
            <KanbanBoard
              items={visibleItems}
              columnOrder={columnOrder}
              onDelete={handleDeleteItem}
              onEdit={handleEditItemClick}
              onQuickArchive={handleQuickArchive}
              onClientClick={openClientModal}
              onAssign={handleAssign}
              onToggleUrgent={handleToggleUrgent}
              onToggleHold={handleToggleHold}
              onCloseUnresponsive={handleCloseUnresponsive}
              onNoteChange={handleNoteChange}
              onCreateNew={handleCreateNewItem}
              focusedCardId={focusedCardId}
              onCardFocus={setFocusedCardId}
              itemBatchInfo={itemBatchInfo}
              onWhatsApp={handleWhatsApp}
            />
          </div>
        </main>

        <DragOverlay
          dropAnimation={{
            duration: 120,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Card overlay — static lift, zero animation layers */}
          {activeItem && !activeId?.startsWith('col-') ? (
            <div style={{ transform: 'scale(1.025) rotate(1.5deg)', transformOrigin: '50% 50%', cursor: 'grabbing' }}>
              <PlanningCard item={activeItem} isOverlay />
            </div>
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

      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSave={(item) => {
          handleSaveItem(item);
          setIsQuickAddOpen(false);
        }}
      />

      <ProductionCategoryModal
        isOpen={pendingDrop !== null}
        onClose={() => {
          // Keyboard drop: revert card to its original stage on Escape
          if (pendingDrop?.fromStage) {
            const { itemId, fromStage } = pendingDrop;
            const now = new Date().toISOString();
            setItems(prev => {
              const targetCount = prev.filter(i => i.stage === fromStage).length;
              return prev.map(i =>
                i.id === itemId
                  ? { ...i, stage: fromStage, position: targetCount, updatedAt: now }
                  : i
              );
            });
          }
          setPendingDrop(null);
        }}
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
        allStats={allStats}
        activeProfile={activeProfile ?? ''}
        onClientClick={openClientModal}
      />

      {undoDelete && (
        <div className="undo-toast" role="status" aria-live="polite">
          <span className="undo-toast-glyph">✓</span>
          <span className="undo-toast-msg">
            <b>{undoDelete.item.clientName}</b> supprimée.
          </span>
          <button className="undo-toast-btn" onClick={handleUndoDelete}>
            Annuler
          </button>
        </div>
      )}

      <ClientCRMModal
        stats={clientModalStats}
        isOpen={clientModalName !== null}
        onClose={() => setClientModalName(null)}
        clientKey={clientModalKey}
        notes={clientModalNotes}
        onAddNote={handleAddClientNote}
        onDeleteNote={deleteNote}
        currentOperator={activeProfile ?? ''}
        topAlertTag={clientTopAlertTag}
      />

      {/* ── Ghost orders panel — commandes sans réponse ── */}
      {isGhostPanelOpen && (
        <div
          className="qa-overlay"
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

