const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('ipadAPI', {
    onDispatchData: (cb) => ipcRenderer.on('dispatch-data', (_e, data) => cb(data)),
  });
} catch (e) {
  console.error('Failed to expose ipadAPI:', e);
}
