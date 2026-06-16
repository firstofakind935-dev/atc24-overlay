const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('atcAPI', {
    minimizeAtc: () => ipcRenderer.send('minimize-atc'),
  });
} catch (e) {
  console.error('Failed to expose atcAPI:', e);
}
