const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
    closeWindow:          ()       => ipcRenderer.send('close-window'),
    toggleFlightEye:      ()       => ipcRenderer.send('toggle-flighteye'),
    toggleFlightEyeLarge: ()       => ipcRenderer.send('toggle-flighteye-large'),
    hideFlightEyeWindows: ()       => ipcRenderer.send('hide-flighteye-windows'),
    restoreFlightEyeWindows: ()    => ipcRenderer.send('restore-flighteye-windows'),
    toggleIpad:           ()       => ipcRenderer.send('toggle-ipad'),
    toggleAtc:            ()       => ipcRenderer.send('toggle-atc'),
    sendDispatchData:     (data)   => ipcRenderer.send('dispatch-data', data),
    onCabinSecured:       (cb)     => ipcRenderer.on('cabin-secured', (_e, label) => cb(label)),
  });
} catch (e) {
  console.error('Failed to expose electronAPI:', e);
}
