// Preload 脚本 — 通过 contextBridge 安全暴露 API 给渲染进程
import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  getPlatform: (): string => process.platform,

  // 文件操作 (Lite+ 套餐)
  saveFile: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('save-file', filePath, content),
  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('read-file', filePath),

  // 事件监听
  onSyncStatusChange: (callback: (status: string) => void): void => {
    ipcRenderer.on('sync-status-change', (_event, status) => callback(status));
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
