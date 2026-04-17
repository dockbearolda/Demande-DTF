import type { PlanningItem } from './types';

interface ElectronAPI {
  getWorkspace:          ()              => Promise<string | null>;
  selectWorkspace:       ()              => Promise<string | null>;
  setWorkspace:          (p: string)     => Promise<{ success?: true; error?: string }>;
  loadData:              ()              => Promise<PlanningItem[]>;
  saveData:              (items: PlanningItem[]) => Promise<{ success?: true; error?: string }>;
  onDataChanged:         (cb: (items: PlanningItem[]) => void) => void;
  onWorkspaceChanged:    (cb: (path: string) => void) => void;
  removeAllListeners:    ()              => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
