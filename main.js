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
let ipadWin;
let atcWin;

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

// ─── Persistent boarding state ────────────────────────────────────────────────
let boardingPath;
let boardingState = null;

function initBoarding() {
  boardingPath = path.join(app.getPath('userData'), 'boarding.json');
  try { boardingState = JSON.parse(fs.readFileSync(boardingPath, 'utf8')); }
  catch { boardingState = null; }
}

function persistBoarding() {
  try {
    if (boardingState) fs.writeFileSync(boardingPath, JSON.stringify(boardingState));
    else if (fs.existsSync(boardingPath)) fs.unlinkSync(boardingPath);
  } catch {}
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
  feWin.on('minimize', () => { saveBoundsOf('feSmall', feWin); feWin.hide(); });
  feWin.on('closed',   () => { feWin = null; });
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
  feLargeWin.on('minimize', () => {
    saveBoundsOf('feLarge', feLargeWin);
    feLargeWin.hide();
    if (feWin) feWin.show(); else createFlightEyeWindow();
  });
  feLargeWin.on('close', (e) => {
    e.preventDefault();
    saveBoundsOf('feLarge', feLargeWin);
    feLargeWin.hide();
    if (feWin) feWin.show(); else createFlightEyeWindow();
  });
  feLargeWin.on('closed', () => { feLargeWin = null; });
}

// ─── iPad popup ───────────────────────────────────────────────────────────────
function createIpadWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const def = { width: 680, height: 520, x: Math.round(width / 2 - 340), y: 60 };
  const b = getBounds('ipad', def);

  ipadWin = new BrowserWindow({
    width: b.width, height: b.height, x: b.x, y: b.y,
    frame: false, transparent: true,
    resizable: true, movable: true,
    skipTaskbar: true, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'ipad-preload.js'),
      contextIsolation: true, nodeIntegration: false, webviewTag: true,
      backgroundThrottling: false,   // keep boarding sim running while hidden
    },
  });

  ipadWin.loadFile('ipad.html');
  ipadWin.setAlwaysOnTop(true, 'pop-up-menu');

  ipadWin.webContents.on('did-finish-load', () => {
    if (lastDispatchData) {
      ipadWin.webContents.send('dispatch-data', lastDispatchData);
    }
  });

  ipadWin.on('resize', () => saveBoundsOf('ipad', ipadWin));
  ipadWin.on('move',   () => saveBoundsOf('ipad', ipadWin));
  ipadWin.on('minimize', () => { saveBoundsOf('ipad', ipadWin); ipadWin.hide(); });
  ipadWin.on('close', (e) => {
    e.preventDefault();
    saveBoundsOf('ipad', ipadWin);
    ipadWin.hide();
  });
  ipadWin.on('closed', () => { ipadWin = null; });
}

// ─── ATC controller station ───────────────────────────────────────────────────
function createAtcWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const def = { width: 540, height: 600, x: width - 560, y: 60 };
  const b = getBounds('atc', def);

  atcWin = new BrowserWindow({
    width: b.width, height: b.height, x: b.x, y: b.y,
    frame: false, transparent: false,
    resizable: true, movable: true,
    skipTaskbar: true, hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'atc-preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  atcWin.loadFile('atc.html');
  atcWin.setAlwaysOnTop(true, 'pop-up-menu');

  atcWin.on('resize', () => saveBoundsOf('atc', atcWin));
  atcWin.on('move',   () => saveBoundsOf('atc', atcWin));
  atcWin.on('minimize', () => { saveBoundsOf('atc', atcWin); atcWin.hide(); });
  atcWin.on('close', (e) => {
    e.preventDefault();
    saveBoundsOf('atc', atcWin);
    atcWin.hide();
  });
  atcWin.on('closed', () => { atcWin = null; });
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
  initBoarding();
  createWindow();
});

app.on('window-all-closed', () => {
  if (feLargeWin) { feLargeWin.removeAllListeners('close'); feLargeWin.close(); }
  if (ipadWin)    { ipadWin.removeAllListeners('close');    ipadWin.close(); }
  if (atcWin)     { atcWin.removeAllListeners('close');     atcWin.close(); }
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC ──────────────────────────────────────────────────────────────────────
let feWasVisible      = false;
let feLargeWasVisible = false;

ipcMain.on('set-ignore-mouse', (_e, ignore) => {
  if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.on('hide-flighteye-windows', () => {
  feWasVisible      = !!(feWin      && feWin.isVisible());
  feLargeWasVisible = !!(feLargeWin && feLargeWin.isVisible());
  if (feWin      && feWin.isVisible())      feWin.hide();
  if (feLargeWin && feLargeWin.isVisible()) feLargeWin.hide();
});

ipcMain.on('restore-flighteye-windows', () => {
  if (feWasVisible      && feWin)      feWin.show();
  if (feLargeWasVisible && feLargeWin) feLargeWin.show();
});

ipcMain.on('close-window', () => {
  if (feLargeWin) { feLargeWin.removeAllListeners('close'); feLargeWin.close(); }
  if (ipadWin)    { ipadWin.removeAllListeners('close');    ipadWin.close(); }
  if (atcWin)     { atcWin.removeAllListeners('close');     atcWin.close(); }
  if (feWin) feWin.close();
  if (win)   win.close();
});

ipcMain.on('toggle-flighteye', () => {
  if (feLargeWin && feLargeWin.isVisible()) feLargeWin.hide();
  if (!feWin) { createFlightEyeWindow(); return; }
  if (feWin.isVisible()) feWin.hide(); else feWin.show();
});

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

ipcMain.on('toggle-ipad', () => {
  if (!ipadWin) { createIpadWindow(); return; }
  if (ipadWin.isVisible()) {
    saveBoundsOf('ipad', ipadWin);
    ipadWin.hide();
  } else {
    ipadWin.show();
  }
});

ipcMain.on('minimize-ipad', () => {
  if (ipadWin) { saveBoundsOf('ipad', ipadWin); ipadWin.hide(); }
});

ipcMain.on('toggle-atc', () => {
  if (!atcWin) { createAtcWindow(); return; }
  if (atcWin.isVisible()) { saveBoundsOf('atc', atcWin); atcWin.hide(); }
  else { atcWin.show(); }
});

ipcMain.on('minimize-atc', () => {
  if (atcWin) { saveBoundsOf('atc', atcWin); atcWin.hide(); }
});

// Live ATIS/weather from the public ATC24 data service (fetched here to avoid CORS)
ipcMain.handle('fetch-atis', async () => {
  try {
    const res = await fetch('https://24data.ptfs.app/atis', { headers: { accept: 'application/json' } });
    if (!res.ok) return { error: 'HTTP ' + res.status };
    return await res.json();
  } catch (e) {
    return { error: String(e) };
  }
});

ipcMain.on('show-ipad', () => {
  if (ipadWin && !ipadWin.isVisible()) ipadWin.show();
});

ipcMain.on('cabin-secured', () => {
  if (win) win.webContents.send('cabin-secured');
});

ipcMain.on('get-boarding', (e) => { e.returnValue = boardingState; });
ipcMain.on('save-boarding', (_e, data) => { boardingState = data; persistBoarding(); });

// Forward dispatch data from main window → iPad (cache so late-opening iPad gets it)
let lastDispatchData = null;

ipcMain.on('dispatch-data', (_e, data) => {
  lastDispatchData = data;
  if (ipadWin && !ipadWin.isDestroyed()) {
    ipadWin.webContents.send('dispatch-data', data);
  }
});
