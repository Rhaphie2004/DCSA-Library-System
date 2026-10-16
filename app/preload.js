const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("library", {
  call: (action, data = {}) => ipcRenderer.invoke("library:call", action, data),
});
