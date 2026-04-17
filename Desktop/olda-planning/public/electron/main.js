const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

const isDev = !app.isPackaged;

let mainWindow   = null;
let workspacePath = null;
let fileWatcher   = null;
let isSaving      = false; // prevents feedback loop on own writes

// ── Config (userData/config.json) ─────────────────────────────────────────────
const configFile  = () => path.join(app.getPath('userData'), 'config.json');
const dataDir     = () => path.join(workspacePath, 'planning-olda');
const dataFile    = () => path.join(dataDir(), 'data.json');

function loadConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configFile(), 'utf8'));
    if (cfg.workspacePath && fs.existsSync(cfg.workspacePath)) {
      workspacePath = cfg.workspacePath;
    }
  } catch {}
}

function saveConfig() {
  try {
    fs.writeFileSync(configFile(), JSON.stringify({ workspacePath }, null, 2));
  } catch {}
}

// ── File watcher ──────────────────────────────────────────────────────────────
function startWatching() {
  if (!workspacePath) return;
  if (fileWatcher) { fs.unwatchFile(dataFile()); fileWatcher = null; }

  const file = dataFile();
  if (!fs.existsSync(file)) return;

  fs.watchFile(file, { interval: 1000, persistent: false }, () => {
    if (isSaving) return; // skip events triggered by our own write
    try {
      const raw   = fs.readFileSync(file, 'utf8');
      const data  = JSON.parse(raw);
      mainWindow?.webContents.send('data:changed', data.items ?? []);
    } catch {}
  });

  fileWatcher = true;
}

function stopWatching() {
  if (workspacePath && fileWatcher) {
    try { fs.unwatchFile(dataFile()); } catch {}
    fileWatcher = null;
  }
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(app.getAppPath(), 'out', 'index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { stopWatching(); mainWindow = null; });
}

// ── Menu ──────────────────────────────────────────────────────────────────────
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
        { label: 'DevTools',      accelerator: 'F12',          click: () => mainWindow?.webContents.toggleDevTools() },
        { type: 'separator' },
        { label: 'Zoom +',        accelerator: 'CmdOrCtrl+=',  click: () => { if (mainWindow) mainWindow.webContents.zoomFactor += 0.1; } },
        { label: 'Zoom −',        accelerator: 'CmdOrCtrl+-',  click: () => { if (mainWindow) mainWindow.webContents.zoomFactor -= 0.1; } },
        { label: 'Zoom original', accelerator: 'CmdOrCtrl+0',  click: () => { if (mainWindow) mainWindow.webContents.zoomFactor = 1;   } },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

// Returns the current workspace path (null if not set)
ipcMain.handle('workspace:get', () => workspacePath);

// Opens a folder picker and returns the chosen path (or null)
ipcMain.handle('workspace:select', () => {
  const result = dialog.showOpenDialogSync(mainWindow, {
    properties: ['openDirectory'],
    title: 'Sélectionner le dossier Dropbox partagé',
    buttonLabel: 'Choisir ce dossier',
  });
  return result?.[0] ?? null;
});

// Confirms the workspace path, creates the data dir, starts watching
ipcMain.handle('workspace:set', (_, newPath) => {
  stopWatching();
  workspacePath = newPath;
  saveConfig();
  try {
    if (!fs.existsSync(dataDir())) fs.mkdirSync(dataDir(), { recursive: true });
  } catch (e) {
    return { error: e.message };
  }
  startWatching();
  return { success: true };
});

// Returns all planning items from the JSON file
ipcMain.handle('data:load', () => {
  if (!workspacePath) return [];
  try {
    const raw = fs.readFileSync(dataFile(), 'utf8');
    return JSON.parse(raw).items ?? [];
  } catch {
    return [];
  }
});

// Writes all planning items to the JSON file
ipcMain.handle('data:save', (_, items) => {
  if (!workspacePath) return { error: 'no_workspace' };
  try {
    if (!fs.existsSync(dataDir())) fs.mkdirSync(dataDir(), { recursive: true });
    isSaving = true;
    fs.writeFileSync(dataFile(), JSON.stringify({ items, updatedAt: new Date().toISOString() }, null, 2));
    setTimeout(() => { isSaving = false; }, 1200); // reset after Dropbox debounce
    return { success: true };
  } catch (e) {
    isSaving = false;
    return { error: e.message };
  }
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.on('ready', () => {
  loadConfig();
  createMenu();
  createWindow();
  startWatching();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
