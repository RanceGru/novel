import { contextBridge, ipcRenderer } from "electron";
const electronAPI = {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getPlatform: () => process.platform,
  // 文件操作 (Lite+ 套餐)
  saveFile: (filePath, content) => ipcRenderer.invoke("save-file", filePath, content),
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  // 事件监听
  onSyncStatusChange: (callback) => {
    ipcRenderer.on("sync-status-change", (_event, status) => callback(status));
  }
};
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
