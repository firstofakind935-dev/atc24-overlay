const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    resizeWindow: (expanded) => ipcRenderer.send('resize-window', expanded),
    closeWindow: () => ipcRenderer.send('close-window'),
  });
} catch (e) {
  console.error('Failed to expose electronAPI:', e);
}
