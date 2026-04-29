/**
 * Runtime registry for TextileModel instances.
 *
 * Today the source of truth for textile references is the supplier catalog
 * (`/catalog/supplier/tree`). It's fetched once on app boot and every model is
 * registered here so all the legacy `TEXTILE_MODELS.find(...)` lookups
 * scattered through the codebase resolve via the same single API call —
 * `getTextileModel(id)`.
 *
 * Static `TEXTILE_MODELS` from constants.ts is kept as a fallback for
 * (a) tests that don't mount the app and (b) old persisted drafts that still
 * point at legacy ids like `CGTU01-F`.
 */
import { TEXTILE_MODELS } from "./constants";
import type { TextileModel } from "./types";

const runtime = new Map<string, TextileModel>();
const listeners = new Set<() => void>();

export function registerTextileModel(model: TextileModel): void {
  runtime.set(model.id, model);
  for (const fn of listeners) fn();
}

export function registerTextileModels(models: ReadonlyArray<TextileModel>): void {
  for (const m of models) runtime.set(m.id, m);
  for (const fn of listeners) fn();
}

export function clearRuntimeCatalog(): void {
  runtime.clear();
  for (const fn of listeners) fn();
}

export function subscribeRuntimeCatalog(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTextileModel(id: string): TextileModel | undefined {
  return runtime.get(id) ?? TEXTILE_MODELS.find((m) => m.id === id);
}

export function getAllTextileModels(): TextileModel[] {
  // Runtime wins over static when ids collide — supplier catalog is fresher.
  const merged = new Map<string, TextileModel>();
  for (const m of TEXTILE_MODELS) merged.set(m.id, m);
  for (const [id, m] of runtime.entries()) merged.set(id, m);
  return [...merged.values()];
}

export function getTextileModelsByTarget(
  target: TextileModel["target"],
): TextileModel[] {
  return getAllTextileModels().filter((m) => m.target === target);
}
