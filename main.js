const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs   = require('fs');

const FULL_HEIGHT     = 820;
const FE_WIDTH        = 420;
const FE_HEIGHT       = 300;
const FE_LARGE_HEIGHT = 560;
const BAR_HEIGHT      = 52;

let win;
let feWin;
let feLargeWin;
let clWin;
let spWin;
let chartsWin;

// ─── Persistent bounds ────────────────────────────────────────────────────────
let settingsPath;
let boundsCache = {};

function initSettings() {
  settingsPath = path.join(app.getPath('userData'), 'window-bounds.json');
  try { boundsCache = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
  catch { boundsCache = {}; }
}

function saveBoundsOf(key, w) {
  if (!w || w.isDestroyed()) return;
  boundsCache[key] = w.getBounds();
  try { fs.writeFileSync(settingsPath, JSON.stringify(boundsCache, null, 2)); }
  catch {}
}

function getBounds(key, defaults) {
  return Object.assign({}, defaults, boundsCache[key] || {});
}

// ─── Small Flight Eye widget ──────────────────────────────────────────────────
function createFlightEyeWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const def = { width: FE_WIDTH, height: FE_HEIGHT,
                x: width - FE_WIDTH - 12, y: height - FE_HEIGHT - 12 };
  const b = getBounds('feSmall', def);

  feWin = new BrowserWindow({
    width: b.width, height: b.height, x: b.x, y: b.y,
    frame: false, transparent: false,
    resizable: true, movable: true,
    skipTaskbar: true, hasShadow: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, webviewTag: true },
  });

  feWin.loadFile('flighteye.html');
  feWin.setAlwaysOnTop(true, 'pop-up-menu');

  feWin.on('resize',   () => saveBoundsOf('feSmall', feWin));
  feWin.on('move',     () => saveBoundsOf('feSmall', feWin));
  feWin.on('minimize', () => {
    saveBoundsOf('feSmall', feWin);
    feWin.hide();
  });
  feWin.on('closed', () => { feWin = null; });
}

// ─── Large Flight Eye popup ───────────────────────────────────────────────────
function createFlightEyeLargeWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const largeW = Math.round(width * 0.78);
  const def = { width: largeW, height: FE_LARGE_HEIGHT,
                x: Math.round((width - largeW) / 2), y: BAR_HEIGHT };
  const b = getBounds('feLarge', def);

  feLargeWin = new BrowserWindow({
    width: b.width, height: b.height, x: b.x, y: b.y,
    frame: false, transparent: false,
    resizable: true, movable: true,
    skipTaskbar: true, hasShadow: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, webviewTag: true },
  });

  feLargeWin.loadFile('flighteye-large.html');
  feLargeWin.setAlwaysOnTop(true, 'pop-up-menu');

  feLargeWin.on('resize', () => saveBoundsOf('feLarge', feLargeWin));
  feLargeWin.on('move',   () => saveBoundsOf('feLarge', feLargeWin));

  // Minimize → save + hide, restore small
  feLargeWin.on('minimize', () => {
    saveBoundsOf('feLarge', feLargeWin);
    feLargeWin.hide();
    if (feWin) feWin.show(); else createFlightEyeWindow();
  });

  // Close from renderer (window.close()) → save + hide, restore small
  feLargeWin.on('close', (e) => {
    e.preventDefault();
    saveBoundsOf('feLarge', feLargeWin);
    feLargeWin.hide();
    if (feWin) feWin.show(); else createFlightEyeWindow();
  });

  feLargeWin.on('closed', () => { feLargeWin = null; });
}

// ─── Charts popup ────────────────────────────────────────────────────────────
function createChartsWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const def = { width: Math.round(width * 0.7), height: Math.round(height * 0.8),
                x: Math.round(width * 0.15), y: 60 };
  const b = getBounds('charts', def);

  chartsWin = new BrowserWindow({
    width: b.width, height: b.height, x: b.x, y: b.y,
    frame: false, transparent: false,
    resizable: true, movable: true,
    skipTaskbar: true, hasShadow: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, webviewTag: true },
  });

  chartsWin.loadFile('charts.html');
  chartsWin.setAlwaysOnTop(true, 'pop-up-menu');

  chartsWin.on('resize', () => saveBoundsOf('charts', chartsWin));
  chartsWin.on('move',   () => saveBoundsOf('charts', chartsWin));
  chartsWin.on('minimize', () => {
    saveBoundsOf('charts', chartsWin);
    chartsWin.hide();
  });
  chartsWin.on('close', (e) => {
    e.preventDefault();
    saveBoundsOf('charts', chartsWin);
    chartsWin.hide();
  });
  chartsWin.on('closed', () => { chartsWin = null; });
}

// ─── Scratchpad popup ────────────────────────────────────────────────────────
function createScratchpadWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const def = { width: 420, height: 340, x: Math.round(width / 2 - 210), y: 60 };
  const b = getBounds('scratchpad', def);

  spWin = new BrowserWindow({
    width: b.width, height: b.height, x: b.x, y: b.y,
    frame: false, transparent: false,
    resizable: true, movable: true,
    skipTaskbar: true, hasShadow: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  spWin.loadFile('scratchpad.html');
  spWin.setAlwaysOnTop(true, 'pop-up-menu');

  spWin.on('resize', () => saveBoundsOf('scratchpad', spWin));
  spWin.on('move',   () => saveBoundsOf('scratchpad', spWin));
  spWin.on('minimize', () => {
    saveBoundsOf('scratchpad', spWin);
    spWin.hide();
  });
  spWin.on('close', (e) => {
    e.preventDefault();
    saveBoundsOf('scratchpad', spWin);
    spWin.hide();
  });
  spWin.on('closed', () => { spWin = null; });
}

// ─── Checklist popup ─────────────────────────────────────────────────────────
function createChecklistWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const def = { width: 300, height: 490, x: width - 320, y: 60 };
  const b = getBounds('checklist', def);

  clWin = new BrowserWindow({
    width: b.width, height: b.height, x: b.x, y: b.y,
    frame: false, transparent: false,
    resizable: true, movable: true,
    skipTaskbar: true, hasShadow: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  clWin.loadFile('checklist.html');
  clWin.setAlwaysOnTop(true, 'pop-up-menu');

  clWin.on('resize', () => saveBoundsOf('checklist', clWin));
  clWin.on('move',   () => saveBoundsOf('checklist', clWin));
  clWin.on('minimize', () => {
    saveBoundsOf('checklist', clWin);
    clWin.hide();
  });
  clWin.on('close', (e) => {
    e.preventDefault();
    saveBoundsOf('checklist', clWin);
    clWin.hide();
  });
  clWin.on('closed', () => { clWin = null; });
}

// ─── Main overlay ─────────────────────────────────────────────────────────────
function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width, height: FULL_HEIGHT, x: 0, y: 0,
    frame: false, transparent: true,
    resizable: false, movable: false,
    skipTaskbar: true, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, webviewTag: true,
    },
  });

  win.loadFile('index.html');
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  initSettings();
  createWindow();
});

app.on('window-all-closed', () => {
  if (feLargeWin)  { feLargeWin.removeAllListeners('close');  feLargeWin.close(); }
  if (clWin)       { clWin.removeAllListeners('close');       clWin.close(); }
  if (spWin)       { spWin.removeAllListeners('close');       spWin.close(); }
  if (chartsWin)   { chartsWin.removeAllListeners('close');   chartsWin.close(); }
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC ──────────────────────────────────────────────────────────────────────
let feWasVisible      = false;
let feLargeWasVisible = false;

ipcMain.on('set-ignore-mouse', (_e, ignore) => {
  if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
});

// Called when main bar shrinks to pill — hides Flight Eye windows
ipcMain.on('hide-flighteye-windows', () => {
  feWasVisible      = !!(feWin      && feWin.isVisible());
  feLargeWasVisible = !!(feLargeWin && feLargeWin.isVisible());
  if (feWin      && feWin.isVisible())      feWin.hide();
  if (feLargeWin && feLargeWin.isVisible()) feLargeWin.hide();
});

// Called when pill is clicked and bar is restored
ipcMain.on('restore-flighteye-windows', () => {
  if (feWasVisible      && feWin)      feWin.show();
  if (feLargeWasVisible && feLargeWin) feLargeWin.show();
});

ipcMain.on('close-window', () => {
  if (feLargeWin)  { feLargeWin.removeAllListeners('close');  feLargeWin.close(); }
  if (clWin)       { clWin.removeAllListeners('close');       clWin.close(); }
  if (spWin)       { spWin.removeAllListeners('close');       spWin.close(); }
  if (chartsWin)   { chartsWin.removeAllListeners('close');   chartsWin.close(); }
  if (feWin)  feWin.close();
  if (win)    win.close();
});

// Toggle small — also hides large if open
ipcMain.on('toggle-flighteye', () => {
  if (feLargeWin && feLargeWin.isVisible()) feLargeWin.hide();
  if (!feWin) { createFlightEyeWindow(); return; }
  if (feWin.isVisible()) feWin.hide(); else feWin.show();
});

ipcMain.on('toggle-charts', () => {
  if (!chartsWin) { createChartsWindow(); return; }
  if (chartsWin.isVisible()) {
    saveBoundsOf('charts', chartsWin);
    chartsWin.hide();
  } else {
    chartsWin.show();
  }
});

ipcMain.on('toggle-scratchpad', () => {
  if (!spWin) { createScratchpadWindow(); return; }
  if (spWin.isVisible()) {
    saveBoundsOf('scratchpad', spWin);
    spWin.hide();
  } else {
    spWin.show();
  }
});

ipcMain.on('toggle-checklist', () => {
  if (!clWin) { createChecklistWindow(); return; }
  if (clWin.isVisible()) {
    saveBoundsOf('checklist', clWin);
    clWin.hide();
  } else {
    clWin.show();
  }
});

// Toggle large — also hides small; restores small when large closes
ipcMain.on('toggle-flighteye-large', () => {
  if (feWin && feWin.isVisible()) feWin.hide();

  if (!feLargeWin) { createFlightEyeLargeWindow(); return; }

  if (feLargeWin.isVisible()) {
    saveBoundsOf('feLarge', feLargeWin);
    feLargeWin.hide();
    if (feWin) feWin.show(); else createFlightEyeWindow();
  } else {
    feLargeWin.show();
  }
});
