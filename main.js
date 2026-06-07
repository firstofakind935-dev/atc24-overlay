const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const FULL_HEIGHT = 820;

let win;

function createWindow() {
  const { width, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width,
    height: FULL_HEIGHT,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setIgnoreMouseEvents(true, { forward: true });

  win.on('closed', () => {
    win = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Make transparent areas click-through, interactive areas receive clicks
ipcMain.on('set-ignore-mouse', (_event, ignore) => {
  if (!win) return;
  win.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.on('close-window', () => {
  if (!win) return;
  win.close();
});
