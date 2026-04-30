import type { PlanningItem, ClientProfile, ClientInteraction, ClientFile } from './types';

export interface DataPayload {
  items:         PlanningItem[];
  fileUpdatedAt: string | null;
  conflicts:     string[];
}

export interface SaveResult {
  success?:      true;
  error?:        string;
  fileUpdatedAt?: string;
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface CRMPayload {
  profiles:     ClientProfile[];
  interactions: ClientInteraction[];
  files:        ClientFile[];
}

export interface UploadFileParams {
  clientKey:    string;
  sourcePath:   string;
  originalName: string;
  category:     string;
  description:  string;
  uploadedBy:   string;
}

interface ElectronAPI {
  getWorkspace:       () => Promise<string | null>;
  selectWorkspace:    () => Promise<string | null>;
  setWorkspace:       (p: string) => Promise<{ success?: true; error?: string; conflicts?: string[] }>;
  loadData:           () => Promise<DataPayload>;
  saveData:           (items: PlanningItem[]) => Promise<SaveResult>;
  onDataChanged:      (cb: (payload: DataPayload) => void) => void;
  onWorkspaceChanged: (cb: (path: string) => void) => void;
  removeAllListeners: () => void;
  log:                (level: LogLevel, ...args: unknown[]) => void;
  // CRM
  loadCRM:            () => Promise<CRMPayload>;
  saveCRM:            (data: CRMPayload) => Promise<{ success?: true; error?: string }>;
  uploadClientFile:   (params: UploadFileParams) => Promise<ClientFile | { error: string }>;
  openClientFile:     (relativePath: string) => Promise<{ success?: true; error?: string }>;
  deleteClientFile:   (relativePath: string) => Promise<{ success?: true; error?: string }>;
  selectFileForUpload: () => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
