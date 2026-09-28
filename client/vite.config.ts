// Vite 配置 — Electron + React + Tailwind
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import { existsSync, renameSync, rmSync } from 'fs';
import path from 'path';

/**
 * 把 preload 产物从 preload.js 改名为 preload.cjs。
 *
 * 为什么需要改名：本包 package.json 是 "type": "module"，同目录下的 .js 会被
 * 当作 ESM 解析，而 Electron 的 sandbox preload 必须是 CommonJS；用 .cjs 扩展名
 * 才能明确声明它是 CommonJS。产物的内容格式由 lib.formats = ['cjs'] 保证。
 */
function renameToCjs(): Plugin {
  return {
    name: 'rename-preload-to-cjs',
    apply: 'build',
    writeBundle(options) {
      const dir = options.dir || 'dist-electron';
      const from = path.resolve(__dirname, dir, 'preload.js');
      const to = path.resolve(__dirname, dir, 'preload.cjs');
      if (!existsSync(from)) return;
      // 先删旧文件，避免上一次的产物残留造成误判
      rmSync(to, { force: true });
      renameSync(from, to);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            // Preload 必须是 CommonJS 并输出为 .cjs，原因见下方注释。
            //
            // 这里只覆盖 lib.formats，fileName 沿用插件默认的 [name].js
            // （入口名是 preload，故产物为 preload.js），再在构建结束的
            // writeBundle 里改名成 preload.cjs。
            //
            // 踩过的坑：不能同时用 build.lib 和 build.rollupOptions.output 指定输出，
            // 否则 vite 的 lib 模式会把两者合并成**两个 output 都叫 preload.cjs**
            //   [{ format: 'es', entryFileNames: 'preload.cjs' },
            //    { format: 'cjs', entryFileNames: 'preload.cjs' }]
            // 两个格式并发写同一个文件、谁后写谁赢，产物便在「干净 CJS」与
            // 「带 export default 的 ESM 包装」之间随机交替，Electron 加载时报
            // SyntaxError: Unexpected token ':'。
            // 只改 formats 就不会出现第二个 output，产物稳定。
            lib: { formats: ['cjs'] },
            rollupOptions: {
              external: ['electron'],
            },
          },
          plugins: [renameToCjs()],
        },
      },
    ]),
    // 注意：**不要**加回 vite-plugin-electron-renderer。
    // 实测它会无视上面 lib.formats = ['cjs']，把 preload 产物改成
    // `import { contextBridge } from "electron"` 的 ESM（并在末尾写出一段残留代码），
    // 于是 Electron 的 sandbox preload 加载失败：
    //   Unable to load preload script
    //   SyntaxError: Cannot use import statement outside a module
    // 结果就是 window.electronAPI 一直不存在。
    // 本项目渲染进程不 import electron / Node 内置模块（原生能力全部走
    // window.electronAPI 与 HTTP 接口），因此该插件对本项目没有作用。
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
