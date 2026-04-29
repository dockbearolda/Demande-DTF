/**
 * Persistance locale (localStorage) des annotations qui n'ont pas encore
 * d'endpoint backend dédié — commentaires internes, pièces jointes,
 * historique applicatif. Stocké par order_id et namespacé sous `dtf:journal`.
 *
 * NB : ce fichier n'est volontairement pas un store global zustand/react-query
 * pour rester trivial à inspecter dans les devtools.
 */

import type { AssignedTo } from "./types";

const KEY = "dtf:order-journal:v1";

export type CommentMention = "L" | "C" | "M";

export interface OrderComment {
  id: string;
  author: AssignedTo;
  body: string;
  mentions: CommentMention[];
  createdAt: string; // ISO
}

export interface OrderAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  /** Chemin relatif (Dropbox shared folder) — ici on stocke le nom seul,
   *  l'upload réel est out-of-scope pour ce prompt. */
  path: string;
  uploadedBy: AssignedTo | null;
  uploadedAt: string;
}

export type ActivityKind =
  | "created"
  | "status"
  | "assigned"
  | "field"
  | "comment"
  | "attachment";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  at: string;
  author: AssignedTo | null;
  /** Description concaténée — ex. "Statut → BAT_SENT", "Assigné à Loïc". */
  label: string;
  detail?: string;
}

export interface OrderJournal {
  comments: OrderComment[];
  attachments: OrderAttachment[];
  activity: ActivityEvent[];
}

function readAll(): Record<string, OrderJournal> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed != null ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, OrderJournal>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

function emptyJournal(): OrderJournal {
  return { comments: [], attachments: [], activity: [] };
}

export function loadJournal(orderId: string): OrderJournal {
  const all = readAll();
  return all[orderId] ?? emptyJournal();
}

export function saveJournal(orderId: string, journal: OrderJournal): void {
  const all = readAll();
  all[orderId] = journal;
  writeAll(all);
}

export function appendComment(
  orderId: string,
  author: AssignedTo,
  body: string,
): OrderComment {
  const journal = loadJournal(orderId);
  const mentions = extractMentions(body);
  const comment: OrderComment = {
    id: cryptoId(),
    author,
    body,
    mentions,
    createdAt: new Date().toISOString(),
  };
  journal.comments.push(comment);
  journal.activity.unshift({
    id: cryptoId(),
    kind: "comment",
    at: comment.createdAt,
    author,
    label: "Commentaire ajouté",
    detail: body.slice(0, 80),
  });
  saveJournal(orderId, journal);
  return comment;
}

export function appendAttachment(
  orderId: string,
  file: File,
  uploader: AssignedTo | null,
): OrderAttachment {
  const journal = loadJournal(orderId);
  const att: OrderAttachment = {
    id: cryptoId(),
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    path: `/dropbox/oms/${orderId}/${file.name}`,
    uploadedBy: uploader,
    uploadedAt: new Date().toISOString(),
  };
  journal.attachments.push(att);
  journal.activity.unshift({
    id: cryptoId(),
    kind: "attachment",
    at: att.uploadedAt,
    author: uploader,
    label: "Pièce jointe ajoutée",
    detail: file.name,
  });
  saveJournal(orderId, journal);
  return att;
}

export function removeAttachment(orderId: string, attachmentId: string): void {
  const journal = loadJournal(orderId);
  journal.attachments = journal.attachments.filter((a) => a.id !== attachmentId);
  saveJournal(orderId, journal);
}

export function logFieldChange(
  orderId: string,
  author: AssignedTo | null,
  label: string,
  detail?: string,
): void {
  const journal = loadJournal(orderId);
  journal.activity.unshift({
    id: cryptoId(),
    kind: "field",
    at: new Date().toISOString(),
    author,
    label,
    detail,
  });
  saveJournal(orderId, journal);
}

export function logStatusChange(
  orderId: string,
  author: AssignedTo | null,
  fromStatus: string,
  toStatus: string,
): void {
  const journal = loadJournal(orderId);
  journal.activity.unshift({
    id: cryptoId(),
    kind: "status",
    at: new Date().toISOString(),
    author,
    label: "Changement de statut",
    detail: `${fromStatus} → ${toStatus}`,
  });
  saveJournal(orderId, journal);
}

export function logAssignment(
  orderId: string,
  author: AssignedTo | null,
  to: AssignedTo | null,
): void {
  const journal = loadJournal(orderId);
  journal.activity.unshift({
    id: cryptoId(),
    kind: "assigned",
    at: new Date().toISOString(),
    author,
    label: to ? `Assigné à ${to}` : "Désassignée",
  });
  saveJournal(orderId, journal);
}

const MENTION_RE = /@(loic|charlie|melina|loïc|mélina)\b/gi;
const MENTION_MAP: Record<string, CommentMention> = {
  loic: "L",
  "loïc": "L",
  charlie: "C",
  melina: "M",
  "mélina": "M",
};

export function extractMentions(body: string): CommentMention[] {
  const set = new Set<CommentMention>();
  for (const match of body.matchAll(MENTION_RE)) {
    const key = match[1].toLowerCase();
    const code = MENTION_MAP[key];
    if (code) set.add(code);
  }
  return Array.from(set);
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
