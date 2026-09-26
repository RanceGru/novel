// Electron API 类型声明
export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => string;
  saveFile: (filePath: string, content: string) => Promise<void>;
  readFile: (filePath: string) => Promise<string>;
  onSyncStatusChange: (callback: (status: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
