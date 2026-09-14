const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cablab", {
  openJob: () => ipcRenderer.invoke("job:open"),
  saveJob: (filePath, text) => ipcRenderer.invoke("job:save", filePath, text),
  openDxf: () => ipcRenderer.invoke("dxf:open"),
  readSettings: () => ipcRenderer.invoke("settings:read"),
  writeSettings: (text) => ipcRenderer.invoke("settings:write", text),
  log: (line) => ipcRenderer.invoke("log:append", line),
  logDump: (text) => ipcRenderer.invoke("log:dump", text),
  openLogs: () => ipcRenderer.invoke("log:open"),
  flags: {
    migratedGenerators: process.env.CABLAB_MIGRATED_GENERATORS === "1",
  },
  versions: { electron: process.versions.electron, chrome: process.versions.chrome },
});
