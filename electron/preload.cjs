const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('desktopStudio', {
  getTtsKeyStatus: () => ipcRenderer.invoke('tts:get-key-status'),
  saveTtsApiKey: (apiKey) => ipcRenderer.invoke('tts:save-api-key', apiKey),
  synthesizeTts: (payload) => ipcRenderer.invoke('tts:synthesize', payload)
});
