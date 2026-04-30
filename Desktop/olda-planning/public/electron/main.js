const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const log    = require('electron-log/main');

// ── Logging setup ──────────────────────────────────────────────────────────
log.initialize();
log.transports.file.level   = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB rotate
log.transports.file.format  = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.info('========== App start ==========', {
  version: app.getVersion(),
  platform: process.platform,
  node: process.versions.node,
  electron: process.versions.electron,
  logPath: log.transports.file.getFile()?.path,
});

process.on('uncaughtException',  err => log.error('uncaughtException',  err));
process.on('unhandledRejection', err => log.error('unhandledRejection', err));

// ── GPU Acceleration & Cold-Start Flags ────────────────────────────────────
// Must be set before app 'ready' — ignored if called later.
// Bypass the Chromium GPU denylist (safe on controlled workstations).
app.commandLine.appendSwitch('ignore-gpu-blocklist');
// Hardware tile rasterization → 60 FPS GPU-composited animations.
app.commandLine.appendSwitch('enable-gpu-rasterization');
// Zero-copy GPU texture upload — eliminates CPU↔GPU memcpy on scroll/drag.
app.commandLine.appendSwitch('enable-zero-copy');

// ── State ──────────────────────────────────────────────────────────────────
const isDev = !app.isPackaged;

if (!isDev && process.platform === 'win32') {
  // Register the AppUserModelId so the taskbar pin, jump-list, and
  // Windows toast notifications resolve to this app (not generic Electron).
  app.setAppUserModelId('com.planningolda.app');
  // Remove the 60 FPS vsync cap in production — let the GPU scheduler decide.
  app.commandLine.appendSwitch('disable-frame-rate-limit');
}
let mainWindow      = null;
let workspacePath   = null;
let fileWatcher     = null;
let lastWrittenHash = null;   // sha1 of the last content we wrote — echo detection
const BACKUP_LIMIT  = 30;

const configFile  = () => path.join(app.getPath('userData'), 'config.json');
const dataDir     = () => path.join(workspacePath, 'planning-olda');
const dataFile    = () => path.join(dataDir(), 'data.json');
const tmpFile     = () => path.join(dataDir(), 'data.json.tmp');
const backupDir   = () => path.join(dataDir(), 'backups');
const crmFile     = () => path.join(dataDir(), 'crm.json');
const uploadsDir  = () => path.join(dataDir(), 'uploads');

const hashOf = s => crypto.createHash('sha1').update(s).digest('hex');

// ── Config ─────────────────────────────────────────────────────────────────
function loadConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
    if (cfg.workspacePath && fs.existsSync(cfg.workspacePath)) {
      workspacePath = cfg.workspacePath;
      log.info('Config loaded, workspace =', workspacePath);
    }
  } catch (e) { log.warn('No config yet:', e.message); }
}
function saveConfig() {
  try { fs.writeFileSync(configFile(), JSON.stringify({ workspacePath }, null, 2)); }
  catch (e) { log.error('saveConfig failed', e); }
}

// ── Dropbox conflict-copy detection ────────────────────────────────────────
function detectConflictFiles() {
  if (!workspacePath) return [];
  try {
    if (!fs.existsSync(dataDir())) return [];
    return fs.readdirSync(dataDir())
      .filter(f => /\(.*(conflict|conflicted copy).*\)/i.test(f))
      .map(f => path.join(dataDir(), f));
  } catch { return []; }
}

// ── Backups (per successful save) ──────────────────────────────────────────
function rotateBackups() {
  try {
    if (!fs.existsSync(backupDir())) return;
    const entries = fs.readdirSync(backupDir())
      .filter(f => f.startsWith('data-') && f.endsWith('.json'))
      .sort();
    while (entries.length > BACKUP_LIMIT) {
      const oldest = entries.shift();
      try { fs.unlinkSync(path.join(backupDir(), oldest)); } catch {}
    }
  } catch (e) { log.warn('rotateBackups failed:', e.message); }
}
function writeBackup(content) {
  try {
    if (!fs.existsSync(backupDir())) fs.mkdirSync(backupDir(), { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(backupDir(), `data-${stamp}.json`), content);
    rotateBackups();
  } catch (e) { log.warn('writeBackup failed:', e.message); }
}

// ── Watcher ────────────────────────────────────────────────────────────────
function startWatching() {
  if (!workspacePath) return;
  if (fileWatcher) { fs.unwatchFile(dataFile()); fileWatcher = null; }
  const file = dataFile();
  if (!fs.existsSync(file)) return;

  fs.watchFile(file, { interval: 1000, persistent: false }, () => {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const h   = hashOf(raw);
      if (h === lastWrittenHash) return; // echo of our own write — ignore
      const parsed = JSON.parse(raw);
      log.info('watch: external change, items=', (parsed.items ?? []).length,
               'fileUpdatedAt=', parsed.updatedAt);
      mainWindow?.webContents.send('data:changed', {
        items: parsed.items ?? [],
        fileUpdatedAt: parsed.updatedAt ?? null,
        conflicts: detectConflictFiles(),
      });
    } catch (e) { log.error('watch: read/parse failed', e); }
  });
  fileWatcher = true;
  log.info('watch: started on', file);
}
function stopWatching() {
  if (workspacePath && fileWatcher) {
    try { fs.unwatchFile(dataFile()); } catch {}
    fileWatcher = null;
    log.info('watch: stopped');
  }
}

// ── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    // ── Native premium chrome ────────────────────────────────────────────
    // macOS: merge traffic lights into the top-nav (hiddenInset).
    // Windows: frameless with overlay controls (min/max/close) on the right.
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 14, y: 14 } } : {}),
    ...(isWin ? {
      titleBarOverlay: {
        color: 'rgba(255, 255, 255, 0)',
        symbolColor: '#334155',
        height: 40,
      },
    } : {}),
    // Prevents the white-flash at boot — background matches the app gradient.
    backgroundColor: '#f5f7fa',
    // macOS only: native vibrancy blur behind the app window.
    ...(isMac ? { vibrancy: 'under-window', visualEffectState: 'active' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  // On Windows, path.join yields "C:\…\out\index.html" — not a valid file URL.
  // pathToFileURL produces the correctly-encoded "file:///C:/…/out/index.html".
  const startUrl = isDev
    ? 'http://localhost:3000'
    : pathToFileURL(path.join(app.getAppPath(), 'out', 'index.html')).href;

  mainWindow.loadURL(startUrl);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });
  mainWindow.webContents.on('render-process-gone', (_e, d) => log.error('render-process-gone', d));
  mainWindow.webContents.on('did-fail-load',       (_e, code, desc, url) =>
    log.error('did-fail-load', { code, desc, url }));

  // Block browser shortcuts that have no meaning in a packaged desktop app.
  // F5 / Ctrl+R → reload, F12 → DevTools, Ctrl+F → find, Ctrl+P → print,
  // Ctrl+U → view-source. All meaningless (and disorienting) in production.
  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F5' || input.key === 'F12') { event.preventDefault(); return; }
      const mod = input.control || input.meta;
      if (mod && ['r', 'f', 'p', 'u'].includes(input.key.toLowerCase())) event.preventDefault();
    });
  }
  mainWindow.on('closed', () => { stopWatching(); mainWindow = null; });
}

// ── Menu ───────────────────────────────────────────────────────────────────
function createMenu() {
  const template = [
    {
      label: 'Planning OLDA',
      submenu: [
        {
          label: 'Changer de dossier Dropbox…',
          click: async () => {
            const selected = dialog.showOpenDialogSync(mainWindow, {
              properties: ['openDirectory'],
              title: 'Sélectionner le dossier Dropbox partagé',
            });
            if (selected?.[0]) {
              stopWatching();
              workspacePath = selected[0];
              saveConfig();
              mainWindow?.webContents.send('workspace:changed', workspacePath);
              startWatching();
            }
          },
        },
        {
          label: 'Ouvrir le dossier des logs',
          click: () => {
            const logPath = log.transports.file.getFile()?.path;
            if (logPath) require('electron').shell.showItemInFolder(logPath);
          },
        },
        { type: 'separator' },
        { label: 'Quitter', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { label: 'Annuler',  accelerator: 'CmdOrCtrl+Z', role: 'undo'  },
        { label: 'Rétablir', accelerator: 'CmdOrCtrl+Y', role: 'redo'  },
        { type: 'separator' },
        { label: 'Couper',   accelerator: 'CmdOrCtrl+X', role: 'cut'   },
        { label: 'Copier',   accelerator: 'CmdOrCtrl+C', role: 'copy'  },
        { label: 'Coller',   accelerator: 'CmdOrCtrl+V', role: 'paste' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { label: 'Recharger',     accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { label: 'DevTools',      accelerator: 'F12',         click: () => mainWindow?.webContents.toggleDevTools() },
        { type: 'separator' },
        { label: 'Zoom +',        accelerator: 'CmdOrCtrl+=', click: () => { if (mainWindow) mainWindow.webContents.zoomFactor += 0.1; } },
        { label: 'Zoom −',        accelerator: 'CmdOrCtrl+-', click: () => { if (mainWindow) mainWindow.webContents.zoomFactor -= 0.1; } },
        { label: 'Zoom original', accelerator: 'CmdOrCtrl+0', click: () => { if (mainWindow) mainWindow.webContents.zoomFactor = 1; } },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC ────────────────────────────────────────────────────────────────────
ipcMain.handle('workspace:get', () => workspacePath);

ipcMain.handle('workspace:select', () => {
  const result = dialog.showOpenDialogSync(mainWindow, {
    properties: ['openDirectory'],
    title: 'Sélectionner le dossier Dropbox partagé',
    buttonLabel: 'Choisir ce dossier',
  });
  return result?.[0] ?? null;
});

ipcMain.handle('workspace:set', (_, newPath) => {
  stopWatching();
  workspacePath = newPath;
  saveConfig();
  try {
    if (!fs.existsSync(dataDir())) fs.mkdirSync(dataDir(), { recursive: true });
  } catch (e) { log.error('workspace:set mkdir failed', e); return { error: e.message }; }
  startWatching();
  return { success: true, conflicts: detectConflictFiles() };
});

ipcMain.handle('data:load', () => {
  if (!workspacePath) return { items: [], fileUpdatedAt: null, conflicts: [] };
  try {
    const raw    = fs.readFileSync(dataFile(), 'utf8');
    const parsed = JSON.parse(raw);
    const items  = parsed.items ?? [];
    log.info('data:load items=', items.length, 'fileUpdatedAt=', parsed.updatedAt);
    return { items, fileUpdatedAt: parsed.updatedAt ?? null, conflicts: detectConflictFiles() };
  } catch (e) {
    log.warn('data:load failed (first run?):', e.message);
    return { items: [], fileUpdatedAt: null, conflicts: detectConflictFiles() };
  }
});

ipcMain.handle('data:save', (_, items) => {
  if (!workspacePath) return { error: 'no_workspace' };
  try {
    if (!fs.existsSync(dataDir())) fs.mkdirSync(dataDir(), { recursive: true });
    const payload = { items, updatedAt: new Date().toISOString() };
    const content = JSON.stringify(payload, null, 2);

    // Atomic write: tmp → rename
    fs.writeFileSync(tmpFile(), content);
    fs.renameSync(tmpFile(), dataFile());

    lastWrittenHash = hashOf(content);
    writeBackup(content);
    log.info('data:save items=', items.length, 'fileUpdatedAt=', payload.updatedAt);
    return { success: true, fileUpdatedAt: payload.updatedAt };
  } catch (e) {
    log.error('data:save failed', e);
    try { if (fs.existsSync(tmpFile())) fs.unlinkSync(tmpFile()); } catch {}
    return { error: e.message };
  }
});

// Renderer log channel
ipcMain.on('renderer:log', (_, level, ...args) => {
  const fn = log[level] || log.info;
  fn('[renderer]', ...args);
});

// ── CRM IPC ────────────────────────────────────────────────────────────────

const EMPTY_CRM = { profiles: [], interactions: [], files: [], updatedAt: null };

ipcMain.handle('crm:load', () => {
  if (!workspacePath) return EMPTY_CRM;
  try {
    const raw = fs.readFileSync(crmFile(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return EMPTY_CRM;
  }
});

ipcMain.handle('crm:save', (_, data) => {
  if (!workspacePath) return { error: 'no_workspace' };
  try {
    if (!fs.existsSync(dataDir())) fs.mkdirSync(dataDir(), { recursive: true });
    const payload = { ...data, updatedAt: new Date().toISOString() };
    fs.writeFileSync(crmFile(), JSON.stringify(payload, null, 2));
    log.info('crm:save profiles=', data.profiles.length, 'interactions=', data.interactions.length, 'files=', data.files.length);
    return { success: true };
  } catch (e) {
    log.error('crm:save failed', e);
    return { error: e.message };
  }
});

ipcMain.handle('crm:upload-file', (_, { clientKey, sourcePath, originalName, category, description, uploadedBy }) => {
  if (!workspacePath) return { error: 'no_workspace' };
  try {
    const clientDir = path.join(uploadsDir(), clientKey.replace(/[^a-z0-9_-]/gi, '_'));
    if (!fs.existsSync(clientDir)) fs.mkdirSync(clientDir, { recursive: true });

    const ext      = path.extname(originalName) || '';
    const id       = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fileName = `${id}${ext}`;
    const destPath = path.join(clientDir, fileName);
    const relPath  = path.join('uploads', clientKey.replace(/[^a-z0-9_-]/gi, '_'), fileName);

    fs.copyFileSync(sourcePath, destPath);
    const stat = fs.statSync(destPath);

    const fileRecord = {
      id,
      clientKey,
      name: fileName,
      originalName,
      category,
      mimeType: mimeFromExt(ext),
      size: stat.size,
      relativePath: relPath,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      description: description || '',
    };
    log.info('crm:upload-file', originalName, '->', destPath);
    return fileRecord;
  } catch (e) {
    log.error('crm:upload-file failed', e);
    return { error: e.message };
  }
});

ipcMain.handle('crm:open-file', (_, relativePath) => {
  if (!workspacePath) return { error: 'no_workspace' };
  try {
    const abs = path.join(dataDir(), relativePath);
    shell.openPath(abs);
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('crm:delete-file', (_, relativePath) => {
  if (!workspacePath) return { error: 'no_workspace' };
  try {
    const abs = path.join(dataDir(), relativePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
    return { success: true };
  } catch (e) {
    log.error('crm:delete-file failed', e);
    return { error: e.message };
  }
});

ipcMain.handle('crm:select-file', () => {
  const result = dialog.showOpenDialogSync(mainWindow, {
    title: 'Sélectionner un fichier à joindre',
    properties: ['openFile'],
    filters: [
      { name: 'Documents & Images', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'xls', 'xlsx'] },
      { name: 'Tous les fichiers', extensions: ['*'] },
    ],
  });
  return result?.[0] ?? null;
});

function mimeFromExt(ext) {
  const map = {
    '.pdf':  'application/pdf',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.doc':  'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls':  'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
app.on('ready', () => {
  loadConfig();
  createMenu();
  createWindow();
  startWatching();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate',          () => { if (!mainWindow) createWindow(); });
