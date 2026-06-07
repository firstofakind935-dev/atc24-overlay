const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const BAR_HEIGHT  = 52;
const FULL_HEIGHT = 820;

let win;

function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width,
    height: BAR_HEIGHT,
    x: 0,
    y: 0,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.on('closed', () => {
    win = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('resize-window', (_event, expanded) => {
  if (!win) return;
  if (typeof expanded !== 'boolean') return;
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win.setSize(width, expanded ? FULL_HEIGHT : BAR_HEIGHT);
});

ipcMain.on('close-window', () => {
  if (!win) return;
  win.close();
});
