const { contextBridge, ipcRenderer } = require('electron');

// ── Forward renderer crashes / warnings to main-process logs ───────────────
const forward = (level, ...args) => {
  try { ipcRenderer.send('renderer:log', level, ...args); } catch {}
};
window.addEventListener('error', e => {
  forward('error', 'window.error', e.message, e.filename + ':' + e.lineno, e.error?.stack);
});
window.addEventListener('unhandledrejection', e => {
  forward('error', 'unhandledrejection', e.reason?.message ?? String(e.reason), e.reason?.stack);
});

// ─────────────────────────────────────────────────────────────────────────────
// NATIVE EXECUTABLE GUARDS — kill the remaining Chromium tells.
// Runs in the renderer's isolated context with full DOM access.
// ─────────────────────────────────────────────────────────────────────────────

// 1) Kill the Chromium context menu globally — but preserve it in inputs so
//    Cut / Copy / Paste still works. This is the #1 webview giveaway.
window.addEventListener('contextmenu', e => {
  const t = e.target;
  const isInput = t && (
    t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.isContentEditable
  );
  if (!isInput) e.preventDefault();
}, { capture: true });

// 2) Kill HTML5 ghost-drag at the source — defense in depth with the CSS rule.
window.addEventListener('dragstart', e => {
  const t = e.target;
  // Allow drag on elements that explicitly opt in (dnd-kit handles its own
  // pointer-based drag and doesn't rely on the native HTML5 drag API).
  if (t && t.getAttribute && t.getAttribute('draggable') === 'true') return;
  e.preventDefault();
}, { capture: true });

// 3) Block the document-level "select all" gesture chain that triggers when
//    you triple-click on UI chrome. Inputs keep their default behavior.
window.addEventListener('selectstart', e => {
  const t = e.target;
  const isText = t && (
    t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.isContentEditable ||
    (t.closest && t.closest('input, textarea, [contenteditable="true"]'))
  );
  if (!isText) e.preventDefault();
}, { capture: true });

// 4) Suppress F7 caret browsing — pure browser tell, never used in native apps.
//    F5/Ctrl+R/Ctrl+P/Ctrl+F are intentionally left alone in dev so HMR-recovery
//    and search work; main.js can disable them in production builds via
//    BrowserWindow's `before-input-event` hook when NODE_ENV === 'production'.
window.addEventListener('keydown', e => {
  if (e.key === 'F7') e.preventDefault();
}, { capture: true });

contextBridge.exposeInMainWorld('electronAPI', {
  // Workspace
  getWorkspace:    ()       => ipcRenderer.invoke('workspace:get'),
  selectWorkspace: ()       => ipcRenderer.invoke('workspace:select'),
  setWorkspace:    (p)      => ipcRenderer.invoke('workspace:set', p),

  // Data — new shape: { items, fileUpdatedAt, conflicts }
  loadData:        ()       => ipcRenderer.invoke('data:load'),
  saveData:        (items)  => ipcRenderer.invoke('data:save', items),

  // Real-time events — payload shape: { items, fileUpdatedAt, conflicts }
  onDataChanged:      (cb) => ipcRenderer.on('data:changed',      (_, payload) => cb(payload)),
  onWorkspaceChanged: (cb) => ipcRenderer.on('workspace:changed', (_, p)       => cb(p)),
  removeAllListeners: ()   => {
    ipcRenderer.removeAllListeners('data:changed');
    ipcRenderer.removeAllListeners('workspace:changed');
  },

  // Structured logging from renderer
  log: (level, ...args) => forward(level, ...args),

  // CRM
  loadCRM:             ()       => ipcRenderer.invoke('crm:load'),
  saveCRM:             (data)   => ipcRenderer.invoke('crm:save', data),
  uploadClientFile:    (params) => ipcRenderer.invoke('crm:upload-file', params),
  openClientFile:      (rel)    => ipcRenderer.invoke('crm:open-file', rel),
  deleteClientFile:    (rel)    => ipcRenderer.invoke('crm:delete-file', rel),
  selectFileForUpload: ()       => ipcRenderer.invoke('crm:select-file'),
});
