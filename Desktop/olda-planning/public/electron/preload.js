const { contextBridge, ipcRenderer } = require('electron');

// Expose secure IPC methods to React frontend
contextBridge.exposeInMainWorld('electronAPI', {
  // Workspace management (Phase 2)
  selectWorkspace: () => ipcRenderer.invoke('get-workspace-path'),
  saveWorkspacePath: (path) => ipcRenderer.invoke('save-workspace-path', path),
  getWorkspacePath: () => ipcRenderer.invoke('get-workspace-path'),

  // Data operations (Phase 3)
  // These will be expanded with CRUD operations for orders, workflows, notes, etc.

  // Listen to IPC events from main process
  onDataChange: (callback) => {
    ipcRenderer.on('data-changed', (event, data) => callback(data));
  },

  removeDataChangeListener: () => {
    ipcRenderer.removeAllListeners('data-changed');
  },
});
