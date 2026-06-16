const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('scopeAPI', {
    minimizeScope: () => ipcRenderer.send('minimize-scope'),
  });
} catch (e) {
  console.error('Failed to expose scopeAPI:', e);
}
