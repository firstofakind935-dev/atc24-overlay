const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
    closeWindow: () => ipcRenderer.send('close-window'),
    toggleFlightEye: () => ipcRenderer.send('toggle-flighteye'),
    toggleFlightEyeLarge: () => ipcRenderer.send('toggle-flighteye-large'),
    hideFlightEyeWindows: () => ipcRenderer.send('hide-flighteye-windows'),
    restoreFlightEyeWindows: () => ipcRenderer.send('restore-flighteye-windows'),
  });
} catch (e) {
  console.error('Failed to expose electronAPI:', e);
}
