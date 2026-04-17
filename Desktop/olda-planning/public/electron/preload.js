const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Workspace
  getWorkspace:    ()       => ipcRenderer.invoke('workspace:get'),
  selectWorkspace: ()       => ipcRenderer.invoke('workspace:select'),
  setWorkspace:    (p)      => ipcRenderer.invoke('workspace:set', p),

  // Data
  loadData:        ()       => ipcRenderer.invoke('data:load'),
  saveData:        (items)  => ipcRenderer.invoke('data:save', items),

  // Real-time events from main process
  onDataChanged:        (cb) => ipcRenderer.on('data:changed',      (_, items) => cb(items)),
  onWorkspaceChanged:   (cb) => ipcRenderer.on('workspace:changed', (_, p)     => cb(p)),
  removeAllListeners:   ()   => {
    ipcRenderer.removeAllListeners('data:changed');
    ipcRenderer.removeAllListeners('workspace:changed');
  },
});
