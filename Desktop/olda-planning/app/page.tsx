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

// ── Helper: build a mock item with all required v2 fields ─────────────────
const D = '2026-04-16T00:00:00.000Z';
type MockInput = Omit<PlanningItem, 'sectors' | 'createdBy' | 'isUrgent'> & { family: string };
const m = (o: MockInput): PlanningItem => ({
  ...o,
  sectors:   [o.family as PlanningItem['sectors'][0]],
  createdBy: 'loic',
  isUrgent:  false,
});

// MOCK DATA GENERATED FROM USER DATA
const MOCK_ITEMS: PlanningItem[] = [
  m({ id: '1',  clientType: 'PRO', clientId: 101, clientName: 'Thierry',            family: 'TROTEC',   product: 'Noir/jaune TOR-05',                             quantity: '1',   note: 'Noir/jaune TOR-05',                             deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'PRODUIT_RECUPERE',    stage: 'archived',     assignedTo: 'charlie', createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '2',  clientType: 'PRO', clientId: 102, clientName: 'Eddy Couteaux',      family: 'TROTEC',   product: 'x20 couteaux',                                  quantity: '1',   note: 'x20 couteaux',                                  deliveryDate: new Date('2026-03-31T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_DEVISER',           stage: 'devis',        assignedTo: 'charlie', createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '3',  clientType: 'PRO', clientId: 103, clientName: 'Vincent',            family: 'TROTEC',   product: '4.50 euros / 1',                                quantity: '20',  note: '4.50 euros / 1',                                deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'CLIENT_PREVENU',      stage: 'archived',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '4',  clientType: 'PRO', clientId: 104, clientName: 'Patrice',            family: 'TEXTILES', product: 'Casquette',                                     quantity: '1',   note: 'Casquette',                                     deliveryDate: new Date('2026-04-15T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_VALIDATION',  stage: 'accepted',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '5',  clientType: 'PRO', clientId: 105, clientName: 'Shima',              family: 'TROTEC',   product: 'Tasses',                                        quantity: '1',   note: 'Tasses',                                        deliveryDate: new Date('2026-03-19T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_PRODUIRE',          stage: 'archived',     assignedTo: 'charlie', createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '6',  clientType: 'PRO', clientId: 106, clientName: 'Aloha',              family: 'TEXTILES', product: 'T-shirts N300',                                 quantity: '100', note: 'T-shirts N300',                                 deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'CLIENT_PREVENU',      stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '7',  clientType: 'PRO', clientId: 107, clientName: 'Beach Life',         family: 'TEXTILES', product: 'Tshirt - mix',                                  quantity: '1',   note: 'mix',                                           deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'PREVENIR_CLIENT',     stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '8',  clientType: 'PRO', clientId: 108, clientName: 'Oceano Immo',        family: 'TROTEC',   product: 'Autre - enseigne',                              quantity: '1',   note: 'enseigne',                                      deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_VALIDATION',  stage: 'accepted',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '9',  clientType: 'PRO', clientId: 109, clientName: '100 % Villas',       family: 'TROTEC',   product: 'Autre - enseigne',                              quantity: '1',   note: 'enseigne',                                      deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_VALIDATION',  stage: 'accepted',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '10', clientType: 'PRO', clientId: 110, clientName: 'Raid Des Gendarmes', family: 'UV',       product: 'Autre - Bon cadeau',                            quantity: '1',   note: 'Bon cadeau',                                    deliveryDate: new Date('2026-05-01T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_PREPARER',          stage: 'production',   assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '11', clientType: 'PRO', clientId: 111, clientName: 'Caribbean Luxury',   family: 'GOODIES',  product: 'Autre - attente arrivé marchandise',            quantity: '1',   note: 'attente arrivé marchandise',                    deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_DEVISER',           stage: 'devis',        assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '12', clientType: 'PRO', clientId: 112, clientName: 'Blackswan Sbh',      family: 'UV',       product: 'Autre',                                         quantity: '1',   note: '',                                              deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_PREPARER',          stage: 'production',   assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '13', clientType: 'PRO', clientId: 113, clientName: 'Julien Pharmacie',   family: 'TEXTILES', product: 'Textile - Tote bag',                            quantity: '1',   note: 'Tote bag',                                      deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_DEVISER',           stage: 'devis',        assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '14', clientType: 'PRO', clientId: 114, clientName: 'Soualiga Elevator',  family: 'TEXTILES', product: 'Tshirt - t-shirt pro',                          quantity: '16',  note: 't-shirt pro',                                   deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'PREVENIR_CLIENT',     stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '15', clientType: 'PRO', clientId: 115, clientName: 'Soualiga Elevator',  family: 'TEXTILES', product: 'Textile - sweet',                               quantity: '1',   note: 'sweet',                                         deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_MARCHANDISE', stage: 'accepted',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '16', clientType: 'PRO', clientId: 116, clientName: 'Cool Sxm',           family: 'TEXTILES', product: 'Accessoire - Drapeau',                          quantity: '1',   note: 'Drapeau',                                       deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'EN_PRODUCTION',       stage: 'production',   assignedTo: '',        createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '17', clientType: 'PRO', clientId: 117, clientName: 'N Sea Stem',         family: 'TEXTILES', product: 'Tshirt',                                        quantity: '1',   note: '',                                              deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'CLIENT_PREVENU',      stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '18', clientType: 'PRO', clientId: 118, clientName: 'Adèle Solea',        family: 'TEXTILES', product: 'AV + AR logo perso x1',                         quantity: '1',   note: 'AV + AR logo perso x1',                         deliveryDate: new Date('2026-03-06T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'PREVENIR_CLIENT',     stage: 'archived',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '19', clientType: 'PRO', clientId: 119, clientName: 'SAS INN Cabana',     family: 'TROTEC',   product: 'Ecrito pour villa',                             quantity: '85',  note: 'Ecrito pour villa',                             deliveryDate: new Date('2026-03-06T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'PREVENIR_CLIENT',     stage: 'archived',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '20', clientType: 'PRO', clientId: 120, clientName: 'Achille',            family: 'TEXTILES', product: 'Logo Aloha x2 320mm',                           quantity: '2',   note: 'Logo Aloha x2 320mm',                           deliveryDate: new Date('2026-03-18T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'MAQUETTE_A_FAIRE',    stage: 'demande',      assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '21', clientType: 'PRO', clientId: 121, clientName: 'Radeau Bleu',        family: 'TEXTILES', product: 'Logo Radeau Bleu rose bébé',                    quantity: '2',   note: 'Logo Radeau Bleu rose bébé',                    deliveryDate: new Date('2026-03-11T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'CLIENT_PREVENU',      stage: 'archived',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '22', clientType: 'PRO', clientId: 122, clientName: 'Les Tamarains',      family: 'GOODIES',  product: 'Gravure sur trophée',                           quantity: '1',   note: 'attente ordre facture via thom',                deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_FACTURER',          stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '23', clientType: 'PRO', clientId: 123, clientName: 'SAS Les Jardiniers', family: 'TEXTILES', product: 'K3025 Gris',                                    quantity: '50',  note: 'K3025 Gris',                                    deliveryDate: new Date('2026-04-03T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_MARCHANDISE', stage: 'accepted',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '24', clientType: 'PRO', clientId: 124, clientName: 'Le Martin',          family: 'UV',       product: 'PC plexi - logo + nom et n° de chambre',        quantity: '1',   note: 'PC plexi - logo + nom et n° de chambre',        deliveryDate: new Date('2026-03-16T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'MANQUE_INFORMATION',  stage: 'demande',      assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '25', clientType: 'PRO', clientId: 125, clientName: 'Villa Kyanéa',       family: 'TROTEC',   product: 'Panneau entrée seulement lettre',               quantity: '1',   note: 'Panneau entrée seulement lettre',               deliveryDate: new Date('2026-03-13T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'MANQUE_INFORMATION',  stage: 'demande',      assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '26', clientType: 'PRO', clientId: 126, clientName: 'HD Factory',         family: 'GOODIES',  product: 'Deviser liste de goodies',                      quantity: '1',   note: 'Deviser liste de goodies',                      deliveryDate: new Date('2026-04-01T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_DEVISER',           stage: 'devis',        assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '27', clientType: 'PRO', clientId: 127, clientName: 'HD Factory',         family: 'TEXTILES', product: 'K3025IC gris foncé',                            quantity: '20',  note: 'K3025IC gris foncé',                            deliveryDate: new Date('2026-04-01T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_VALIDATION',  stage: 'accepted',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '28', clientType: 'PRO', clientId: 128, clientName: 'Ocean 82 Djaya',     family: 'TROTEC',   product: 'Gravure sur socle de bougie',                   quantity: '5',   note: 'Gravure sur socle de bougie',                   deliveryDate: new Date('2026-03-11T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_VALIDATION',  stage: 'accepted',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '29', clientType: 'PRO', clientId: 129, clientName: 'Malika',             family: 'TROTEC',   product: 'Devis pour 120 shot + éventail',                quantity: '120', note: 'Devis pour 120 shot + éventail',                deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_DEVISER',           stage: 'archived',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '30', clientType: 'PRO', clientId: 130, clientName: 'ASP',                family: 'TROTEC',   product: 'Trophées',                                      quantity: '2',   note: 'Trophées',                                      deliveryDate: new Date('2026-03-06T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_DEVISER',           stage: 'archived',     assignedTo: '',        createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '31', clientType: 'PRO', clientId: 131, clientName: 'Karibuni restaurant',family: 'TEXTILES', product: 'H-001 Almond Green',                            quantity: '60',  note: 'H-001 Almond Green',                            deliveryDate: new Date('2026-03-20T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_MARCHANDISE', stage: 'accepted',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '32', clientType: 'PRO', clientId: 132, clientName: 'Villa Riviera',      family: 'TEXTILES', product: 'F-006 + Polo K240 + K239',                      quantity: '1',   note: 'F-006 + Polo K240 + K239',                      deliveryDate: new Date('2026-03-20T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_MARCHANDISE', stage: 'accepted',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '33', clientType: 'PRO', clientId: 133, clientName: 'Zoé',                family: 'UV',       product: 'Ecriteau boîte aux lettres',                    quantity: '1',   note: 'Ecriteau boîte aux lettres',                    deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'TERMINE',             stage: 'archived',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '34', clientType: 'PRO', clientId: 134, clientName: 'Soualiga Elevator',  family: 'GOODIES',  product: 'sticker 100 x 100',                             quantity: '50',  note: 'sticker 100 x 100',                             deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_MARCHANDISE', stage: 'accepted',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '35', clientType: 'PRO', clientId: 135, clientName: 'Sea You',            family: 'TEXTILES', product: 'LYCRA 5 S / 5 M / 5 L TOR-04',                 quantity: '15',  note: 'LYCRA 5 S / 5 M / 5 L TOR-04',                 deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_FACTURER',          stage: 'facturation',  assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '36', clientType: 'PRO', clientId: 136, clientName: 'Sea You',            family: 'TEXTILES', product: 'CROP TOP',                                      quantity: '150', note: 'CROP TOP',                                      deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_FACTURER',          stage: 'facturation',  assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '37', clientType: 'PRO', clientId: 137, clientName: 'Iguana Fitness',     family: 'TEXTILES', product: 'Tshirt - Sur mesure',                           quantity: '1',   note: 'Sur mesure',                                    deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'TERMINE',             stage: 'archived',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '38', clientType: 'PRO', clientId: 138, clientName: 'Ctos Asprojexpose',  family: 'GOODIES',  product: 'Autre - Tote bag + trophées',                   quantity: '1',   note: 'Tote bag + trophées',                           deliveryDate: new Date('2026-03-05T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'PREVENIR_CLIENT',     stage: 'archived',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '39', clientType: 'PRO', clientId: 139, clientName: '3sp',                family: 'TEXTILES', product: 'Polo entreprise + enfant',                      quantity: '1',   note: 'Polo entreprise + enfant',                      deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'PREVENIR_CLIENT',     stage: 'archived',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '40', clientType: 'PRO', clientId: 140, clientName: 'Karibuni',           family: 'TEXTILES', product: 'Tshirt',                                        quantity: '12',  note: '',                                              deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'TERMINE',             stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '41', clientType: 'PRO', clientId: 141, clientName: 'Intérieur Design',   family: 'TEXTILES', product: 'Tshirt',                                        quantity: '1',   note: '',                                              deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_MARCHANDISE', stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '42', clientType: 'PRO', clientId: 142, clientName: 'Friendly Padel Club',family: 'GOODIES',  product: 'Trophées',                                      quantity: '12',  note: 'Trophées',                                      deliveryDate: new Date('2026-03-06T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'PRODUIT_RECUPERE',    stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '43', clientType: 'PRO', clientId: 143, clientName: 'Antoine Brasero',    family: 'TEXTILES', product: 'Voir message loic + prépa',                     quantity: '1',   note: 'Voir message loic + prépa',                     deliveryDate: new Date('2026-03-04T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_MONTER_NETTOYER',   stage: 'archived',     assignedTo: '',        createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '44', clientType: 'PRO', clientId: 144, clientName: 'la chingona',        family: 'AUTRES',   product: 'Devis DTF hauteur 110 / Qté 55 / sans pose',    quantity: '1',   note: 'Devis DTF hauteur 110 / Qté 55 / sans pose',    deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_DEVISER',           stage: 'devis',        assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '45', clientType: 'PRO', clientId: 145, clientName: 'Cool SXM',           family: 'TEXTILES', product: 'Devis + Maquette drapeau',                      quantity: '1',   note: 'Devis + Maquette drapeau',                      deliveryDate: new Date('2026-03-20T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_VALIDATION',  stage: 'accepted',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '46', clientType: 'PRO', clientId: 146, clientName: 'SOTHEBYS',           family: 'TROTEC',   product: 'Plateau en chene',                              quantity: '50',  note: 'Plateau en chene',                              deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_VALIDATION',  stage: 'accepted',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '47', clientType: 'PRO', clientId: 147, clientName: 'Watt sun Fabrice',   family: 'TEXTILES', product: 'H-012 Navy x5 + Noir x5 L H-014 Blanc x10',    quantity: '25',  note: 'H-012 Navy x5 + Noir x5 L H-014 Blanc x10',    deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_VALIDATION',  stage: 'accepted',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '48', clientType: 'PRO', clientId: 148, clientName: 'Ligue De Football Sxm',family: 'TROTEC', product: 'Produit',                                       quantity: '1',   note: '',                                              deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'CLIENT_PREVENU',      stage: 'archived',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '49', clientType: 'PRO', clientId: 149, clientName: 'Estelle',            family: 'TROTEC',   product: 'Devis pour PC',                                 quantity: '1',   note: 'Devis pour PC',                                 deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_DEVISER',           stage: 'devis',        assignedTo: 'charlie', createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '50', clientType: 'PRO', clientId: 150, clientName: 'Jessica',            family: 'TROTEC',   product: '1x Verre Ti-punch',                             quantity: '1',   note: '1x Verre Ti-punch',                             deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'TERMINE',             stage: 'archived',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '51', clientType: 'PRO', clientId: 151, clientName: 'KARIBUNI',           family: 'TEXTILES', product: 'Produit',                                       quantity: '60',  note: '',                                              deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_DEVISER',           stage: 'devis',        assignedTo: '',        createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '52', clientType: 'PRO', clientId: 152, clientName: 'AFS',                family: 'TEXTILES', product: 'x50 T-shirts',                                  quantity: '1',   note: 'x50 T-shirts',                                  deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'CLIENT_PREVENU',      stage: 'archived',     assignedTo: 'melina',  createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '53', clientType: 'PRO', clientId: 153, clientName: 'eden',               family: 'AUTRES',   product: 'Produit',                                       quantity: '1',   note: '',                                              deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_DEVISER',           stage: 'devis',        assignedTo: '',        createdAt: D, updatedAt: D, archivedAt: null }),
  m({ id: '54', clientType: 'PRO', clientId: 154, clientName: 'Guymamalou',         family: 'TROTEC',   product: 'Produit',                                       quantity: '1',   note: '',                                              deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'A_DEVISER',           stage: 'archived',     assignedTo: 'charlie', createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '55', clientType: 'PRO', clientId: 155, clientName: 'Friendly Upcycling', family: 'GOODIES',  product: 'roue toune adulte + junior',                    quantity: '2',   note: 'roue toune adulte + junior',                    deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_VALIDATION',  stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '56', clientType: 'PRO', clientId: 156, clientName: 'MAD EVENTS',         family: 'TEXTILES', product: 'T-shirts',                                      quantity: '100', note: 'T-shirts',                                      deliveryDate: new Date('2026-03-26T12:00:00Z').toISOString(), planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_MARCHANDISE', stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '57', clientType: 'PRO', clientId: 157, clientName: 'Le Voyager',         family: 'TEXTILES', product: 'sous traitance flocage',                        quantity: '1',   note: 'sous traitance flocage',                        deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'MANQUE_INFORMATION',  stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '58', clientType: 'PRO', clientId: 158, clientName: 'Teck Val',           family: 'TEXTILES', product: 't-shirt boulot',                                quantity: '1',   note: 't-shirt boulot',                                deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'MANQUE_INFORMATION',  stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: D    }),
  m({ id: '59', clientType: 'PRO', clientId: 159, clientName: 'Iguana',             family: 'TEXTILES', product: '1 dabardeur + 1 t-shirt oversize',              quantity: '2',   note: '1 dabardeur + 1 t-shirt oversize',              deliveryDate: D,                                              planningDate: null, needsMockup: false, mockupStatus: '', mockupCompletedAt: null, status: 'ATTENTE_VALIDATION',  stage: 'archived',     assignedTo: 'loic',    createdAt: D, updatedAt: D, archivedAt: D    }),
];

export default function PlanningPage() {
  const { activeProfile, clearProfile } = useProfile();
  const [items, setItems] = useState<PlanningItem[]>(MOCK_ITEMS);

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

