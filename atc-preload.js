const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('atcAPI', {
    minimizeAtc: () => ipcRenderer.send('minimize-atc'),
    fetchAtis: () => ipcRenderer.invoke('fetch-atis'),
    toggleScope: () => ipcRenderer.send('toggle-scope'),
  });
} catch (e) {
  console.error('Failed to expose atcAPI:', e);
}
