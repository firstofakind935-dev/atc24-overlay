const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('ipadAPI', {
    onDispatchData: (cb) => ipcRenderer.on('dispatch-data', (_e, data) => cb(data)),
    minimizeIpad: () => ipcRenderer.send('minimize-ipad'),
    showIpad: () => ipcRenderer.send('show-ipad'),
    cabinSecured: () => ipcRenderer.send('cabin-secured'),
  });
} catch (e) {
  console.error('Failed to expose ipadAPI:', e);
}
