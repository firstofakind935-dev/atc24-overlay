const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
    closeWindow: () => ipcRenderer.send('close-window'),
  });
} catch (e) {
  console.error('Failed to expose electronAPI:', e);
}
