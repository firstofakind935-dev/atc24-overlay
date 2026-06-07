const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    resizeWindow: (expanded) => ipcRenderer.send('resize-window', expanded),
  });
} catch (e) {
  console.error('Failed to expose electronAPI:', e);
}
