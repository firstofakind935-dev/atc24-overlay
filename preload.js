const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  resizeWindow: (expanded) => ipcRenderer.send('resize-window', expanded)
});
