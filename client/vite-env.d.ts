/// <reference types="vite/client" />
/// <reference types="vite-plugin-electron/electron-env" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
